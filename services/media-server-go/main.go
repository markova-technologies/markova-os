package main

import (
	"encoding/json"
	"bytes"
	"encoding/binary"
	"fmt"
	"log"
	"math"
	"net"
	"net/http"
	"os"

	"github.com/pion/webrtc/v3"
)

type OfferRequest struct {
	SDP  string `json:"sdp"`
	Type string `json:"type"`
}

type OfferResponse struct {
	SDP  string `json:"sdp"`
	Type string `json:"type"`
}

func handleWebRTCOffer(w http.ResponseWriter, r *http.Request) {
	var offer OfferRequest
	if err := json.NewDecoder(r.Body).Decode(&offer); err != nil {
		http.Error(w, "Invalid JSON body", http.StatusBadRequest)
		return
	}

	config := webrtc.Configuration{
		ICEServers: []webrtc.ICEServer{
			{URLs: []string{"stun:stun.l.google.com:19302"}},
			{
				URLs:           []string{"turn:coturn:3478"},
				Username:       os.Getenv("TURN_USERNAME"),
				Credential:     os.Getenv("TURN_PASSWORD"),
				CredentialType: webrtc.ICECredentialTypePassword,
			},
		},
	}

	peerConnection, err := webrtc.NewPeerConnection(config)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to create peer connection: %v", err), http.StatusInternalServerError)
		return
	}

	peerConnection.OnTrack(func(track *webrtc.TrackRemote, receiver *webrtc.RTPReceiver) {
		log.Printf("≡ƒÄÖ∩╕Å WebRTC track arrived: ID=%s, Codec=%s", track.ID(), track.Codec().MimeType)
		buf := make([]byte, 1500)
		for {
			n, _, err := track.Read(buf)
			if err != nil {
				return
			}
			_ = n
		}
	})

	if err := peerConnection.SetRemoteDescription(webrtc.SessionDescription{
		Type: webrtc.SDPTypeOffer,
		SDP:  offer.SDP,
	}); err != nil {
		http.Error(w, fmt.Sprintf("Failed to set remote description: %v", err), http.StatusInternalServerError)
		return
	}

	answer, err := peerConnection.CreateAnswer(nil)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to create answer: %v", err), http.StatusInternalServerError)
		return
	}

	if err := peerConnection.SetLocalDescription(answer); err != nil {
		http.Error(w, fmt.Sprintf("Failed to set local description: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(OfferResponse{
		SDP:  answer.SDP,
		Type: answer.Type.String(),
	})
}

func runRTPServer(port string) {
	"sync/atomic"
	"time"
)

// RTPHeader represents the fixed 12-byte RTP header per RFC 3550
type RTPHeader struct {
	Version        uint8
	Padding        bool
	Extension      bool
	CSRCCount      uint8
	Marker         bool
	PayloadType    uint8
	SequenceNumber uint16
	Timestamp      uint32
	SSRC           uint32
}

const (
	rtpMinHeaderSize   = 12
	vadEnergyThreshold = 500.0 // G.711 ╬╝-law RMS energy threshold for voice activity
	forwardURLEnvKey   = "VOICE_RUNTIME_URL"
)

var (
	packetsReceived uint64
	voiceFrames     uint64
	silenceFrames   uint64
)

// parseRTPHeader parses the fixed 12-byte RTP header from a raw UDP packet.
// Returns the parsed header, audio payload slice, and any error.
func parseRTPHeader(buf []byte) (*RTPHeader, []byte, error) {
	if len(buf) < rtpMinHeaderSize {
		return nil, nil, fmt.Errorf("packet too short: %d bytes (minimum %d)", len(buf), rtpMinHeaderSize)
	}

	h := &RTPHeader{}
	h.Version = (buf[0] >> 6) & 0x03
	h.Padding = (buf[0]>>5)&0x01 == 1
	h.Extension = (buf[0]>>4)&0x01 == 1
	h.CSRCCount = buf[0] & 0x0F
	h.Marker = (buf[1]>>7)&0x01 == 1
	h.PayloadType = buf[1] & 0x7F
	h.SequenceNumber = binary.BigEndian.Uint16(buf[2:4])
	h.Timestamp = binary.BigEndian.Uint32(buf[4:8])
	h.SSRC = binary.BigEndian.Uint32(buf[8:12])

	if h.Version != 2 {
		return nil, nil, fmt.Errorf("invalid RTP version %d (expected 2)", h.Version)
	}

	// Skip past the fixed header + optional CSRC list (4 bytes per CSRC)
	headerSize := rtpMinHeaderSize + int(h.CSRCCount)*4

	// Skip optional header extension (RFC 3550 ┬º5.3.1)
	if h.Extension {
		if len(buf) < headerSize+4 {
			return nil, nil, fmt.Errorf("packet truncated in extension header")
		}
		extLen := int(binary.BigEndian.Uint16(buf[headerSize+2 : headerSize+4]))
		headerSize += 4 + extLen*4
	}

	if len(buf) <= headerSize {
		return h, []byte{}, nil
	}

	payload := buf[headerSize:]

	// Strip padding bytes if present (padding length is in the last byte)
	if h.Padding && len(payload) > 0 {
		padLen := int(payload[len(payload)-1])
		if padLen > 0 && padLen < len(payload) {
			payload = payload[:len(payload)-padLen]
		}
	}

	return h, payload, nil
}

// mulawDecode decodes a single G.711 ╬╝-law (PCMU) byte to 16-bit linear PCM.
// Based on ITU-T G.711 specification.
func mulawDecode(b byte) int16 {
	b = ^b
	sign := b & 0x80
	exponent := (b >> 4) & 0x07
	mantissa := b & 0x0F
	sample := (int16(mantissa)<<1 | 1) << (exponent + 2)
	sample -= 0x21
	if sign == 0 {
		return -sample
	}
	return sample
}

// computeEnergy calculates the RMS energy of a G.711 ╬╝-law audio payload.
// Used for Voice Activity Detection (VAD).
func computeEnergy(payload []byte) float64 {
	if len(payload) == 0 {
		return 0
	}
	var sumSq float64
	for _, b := range payload {
		linear := mulawDecode(b)
		sumSq += float64(linear) * float64(linear)
	}
	return math.Sqrt(sumSq / float64(len(payload)))
}

// forwardAudioFrame POSTs a raw audio payload to the downstream voice runtime.
// Sends RTP metadata as HTTP headers so the receiver can correlate streams.
func forwardAudioFrame(payload []byte, ssrc uint32, seqNum uint16, forwardURL string) {
	if forwardURL == "" || len(payload) == 0 {
		return
	}

	req, err := http.NewRequest("POST", forwardURL+"/v1/rtp/frame", bytes.NewReader(payload))
	if err != nil {
		log.Printf("ΓÜá∩╕Å  forwardAudioFrame: failed to build request: %v", err)
		return
	}
	req.Header.Set("Content-Type", "application/octet-stream")
	req.Header.Set("X-RTP-SSRC", fmt.Sprintf("%d", ssrc))
	req.Header.Set("X-RTP-Seq", fmt.Sprintf("%d", seqNum))
	req.Header.Set("X-Payload-Type", "0") // PCMU

	client := &http.Client{Timeout: 50 * time.Millisecond}
	resp, err := client.Do(req)
	if err != nil {
		// Non-fatal: voice runtime may not be up yet
		return
	}
	resp.Body.Close()
}

// Go Native RTP Media Server for direct Ethio Telecom & SIP Trunking
func main() {
	port := os.Getenv("RTP_PORT")
	if port == "" {
		port = "10000"
	}

	// Optional: forward voice-active frames to voice-runtime-go or similar
	forwardURL := os.Getenv(forwardURLEnvKey)

	addr, err := net.ResolveUDPAddr("udp", ":"+port)
	if err != nil {
		log.Fatalf("UDP resolve error: %v", err)
	}

	conn, err := net.ListenUDP("udp", addr)
	if err != nil {
		log.Fatalf("UDP listen error: %v", err)
	}
	defer conn.Close()

	// Increase socket receive buffer to handle burst RTP traffic (2 MB)
	if err := conn.SetReadBuffer(2 * 1024 * 1024); err != nil {
		log.Printf("ΓÜá∩╕Å  Could not set UDP read buffer size: %v", err)
	}

	log.Printf("≡ƒÄÖ∩╕Å  Go Native RTP Media Server listening on UDP port %s", port)
	if forwardURL != "" {
		log.Printf("≡ƒôí Forwarding voice frames to: %s/v1/rtp/frame", forwardURL)
	} else {
		log.Printf("ΓÜá∩╕Å  %s not set ΓÇö VAD active, forwarding disabled", forwardURLEnvKey)
	}

	// Background stats reporter (every 30s)
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			log.Printf("≡ƒôè RTP Stats ΓÇö received: %d | voice: %d | silence: %d",
				atomic.LoadUint64(&packetsReceived),
				atomic.LoadUint64(&voiceFrames),
				atomic.LoadUint64(&silenceFrames),
			)
		}
	}()

	buf := make([]byte, 1500) // Standard Ethernet MTU
	for {
		n, src, err := conn.ReadFromUDP(buf)
		if err != nil {
			log.Printf("RTP read error from %s: %v", src, err)
			continue
		}
		_ = n
		_ = src

		atomic.AddUint64(&packetsReceived, 1)

		// Parse RTP header to extract audio payload
		header, payload, parseErr := parseRTPHeader(buf[:n])
		if parseErr != nil {
			log.Printf("ΓÜá∩╕Å  Invalid RTP packet from %s: %v", src, parseErr)
			continue
		}

		// VAD: compute RMS energy on ╬╝-law payload to detect voice activity
		energy := computeEnergy(payload)
		isVoice := energy >= vadEnergyThreshold

		if isVoice {
			atomic.AddUint64(&voiceFrames, 1)
			// Forward active voice frames to downstream processor (non-blocking)
			if forwardURL != "" {
				go forwardAudioFrame(payload, header.SSRC, header.SequenceNumber, forwardURL)
			}
		} else {
			atomic.AddUint64(&silenceFrames, 1)
		}
	}
}

func main() {
	rtpPort := os.Getenv("RTP_PORT")
	if rtpPort == "" {
		rtpPort = "10000"
	}
	go runRTPServer(rtpPort)

	httpPort := os.Getenv("PORT")
	if httpPort == "" {
		httpPort = "5012"
	}

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "OK", "service": "media-server-go", "webrtc_srtp": "enabled"})
	})
	http.HandleFunc("/v1/webrtc/offer", handleWebRTCOffer)

	log.Printf("ΓÜí Media Server WebRTC/DTLS-SRTP signaling server listening on HTTP port %s", httpPort)
	if err := http.ListenAndServe(":"+httpPort, nil); err != nil {
		log.Fatalf("HTTP server failed: %v", err)
	}
}

