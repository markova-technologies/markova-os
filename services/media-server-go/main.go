package main

import (
	"encoding/json"
	"fmt"
	"log"
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
		log.Printf("🎙️ WebRTC track arrived: ID=%s, Codec=%s", track.ID(), track.Codec().MimeType)
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
	addr, err := net.ResolveUDPAddr("udp", ":"+port)
	if err != nil {
		log.Fatalf("UDP resolve error: %v", err)
	}

	conn, err := net.ListenUDP("udp", addr)
	if err != nil {
		log.Fatalf("UDP listen error: %v", err)
	}
	defer conn.Close()

	log.Printf("🎙️ Go Native RTP Media Server listening on UDP port %s", port)

	buf := make([]byte, 1500)
	for {
		n, src, err := conn.ReadFromUDP(buf)
		if err != nil {
			log.Printf("RTP read error: %v", err)
			continue
		}
		_ = n
		_ = src
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

	log.Printf("⚡ Media Server WebRTC/DTLS-SRTP signaling server listening on HTTP port %s", httpPort)
	if err := http.ListenAndServe(":"+httpPort, nil); err != nil {
		log.Fatalf("HTTP server failed: %v", err)
	}
}
