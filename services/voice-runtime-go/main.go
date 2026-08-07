package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/redis/go-redis/v9"
	"github.com/markova/voice-runtime-go/buffer"
	"github.com/markova/voice-runtime-go/stt"
	"github.com/markova/voice-runtime-go/vad"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type AudioFrame struct {
	Event     string `json:"event"`
	StreamSid string `json:"streamSid"`
	Start     struct {
		CallSid string `json:"callSid"`
	} `json:"start"`
	Media struct {
		Payload string `json:"payload"`
	} `json:"media"`
}

var (
	activeStreams = make(map[string]*websocket.Conn)
	streamsMutex  sync.RWMutex
	redisClient   *redis.Client
)

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"OK","service":"voice-runtime-go","version":"1.1.0"}`))
}

type streamSession struct {
	conn    *websocket.Conn
	vad     *vad.VAD
	buffer  *buffer.AudioBuffer
	stt     *stt.GroqSTT
	sid     string
	orchURL string
}

func publishTranscript(orchURL, streamSid, transcript string) {
	if redisClient != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		err := redisClient.XAdd(ctx, &redis.XAddArgs{
			Stream: "markova_transcripts",
			MaxLen: 10000,
			Values: map[string]interface{}{
				"call_sid":   streamSid,
				"transcript": transcript,
				"ts":         time.Now().UnixMilli(),
			},
		}).Err()
		if err == nil {
			log.Printf("✅ Transcript published to Redis stream [%s]", streamSid)
			return
		}
		log.Printf("⚠️ Redis XAdd failed (%v), falling back to HTTP POST", err)
	}

	payload, _ := json.Marshal(map[string]string{
		"SpeechResult": transcript,
		"CallSid":      streamSid,
	})
	resp, err := http.Post(
		orchURL+"/handle-input",
		"application/json",
		bytes.NewBuffer(payload),
	)
	if err != nil {
		log.Printf("⚠️ Orchestrator forward error for %s: %v", streamSid, err)
		return
	}
	defer resp.Body.Close()
	log.Printf("✅ Orchestrator HTTP forward complete [%s]: HTTP %d", streamSid, resp.StatusCode)
}

func handleStream(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Upgrade error: %v", err)
		return
	}
	defer conn.Close()

	streamSid := r.URL.Query().Get("streamSid")
	if streamSid == "" {
		streamSid = fmt.Sprintf("stream_%d", time.Now().UnixNano())
	}

	orchURL := os.Getenv("ORCHESTRATOR_URL")
	if orchURL == "" {
		orchURL = "http://orchestrator:6000"
	}

	session := &streamSession{
		conn:    conn,
		vad:     &vad.VAD{},
		buffer:  &buffer.AudioBuffer{},
		stt:     stt.NewGroqSTT(),
		sid:     streamSid,
		orchURL: orchURL,
	}

	streamsMutex.Lock()
	activeStreams[streamSid] = conn
	streamsMutex.Unlock()

	log.Printf("🎙️ Go Voice Runtime Connected: %s", streamSid)

	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			log.Printf("Stream %s read error: %v", streamSid, err)
			break
		}

		var frame AudioFrame
		if err := json.Unmarshal(message, &frame); err != nil {
			continue
		}

		switch frame.Event {
		case "start":
			log.Printf("▶️ Stream started: %s (callSid: %s)", streamSid, frame.Start.CallSid)

		case "media":
			audioBytes, err := base64.StdEncoding.DecodeString(frame.Media.Payload)
			if err != nil {
				continue
			}

			// VAD: check if this frame has speech
			isSpeech, speechEnded := session.vad.ProcessMulaw(audioBytes)

			if isSpeech {
				session.buffer.Append(audioBytes)
			}

			if speechEnded && session.buffer.Size() > 0 {
				accumulated := session.buffer.Flush()
				// Dispatch to Groq STT in a goroutine (non-blocking, next frame continues)
				go func(audio []byte, sid string) {
					transcript, err := session.stt.Transcribe(audio, "am")
					if err != nil {
						log.Printf("❌ STT error for %s: %v", sid, err)
						return
					}
					if transcript == "" {
						return
					}
					log.Printf("📝 Transcript [%s]: %s", sid, transcript)
					publishTranscript(session.orchURL, sid, transcript)
				}(accumulated, streamSid)
			}

		case "stop":
			log.Printf("🛑 Go Stream stopped: %s", streamSid)
			// Flush any remaining audio
			if remaining := session.buffer.Flush(); len(remaining) > 500 {
				go func(audio []byte) {
					transcript, _ := session.stt.Transcribe(audio, "am")
					if transcript != "" {
						publishTranscript(session.orchURL, streamSid, transcript)
					}
				}(remaining)
			}
			goto CleanExit
		}
	}

CleanExit:
	streamsMutex.Lock()
	delete(activeStreams, streamSid)
	streamsMutex.Unlock()
	log.Printf("🔌 Go Voice Stream closed: %s", streamSid)
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "5008"
	}

	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis://redis:6379"
	}
	opts, err := redis.ParseURL(redisURL)
	if err == nil {
		redisClient = redis.NewClient(opts)
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		if err := redisClient.Ping(ctx).Err(); err != nil {
			log.Printf("⚠️ Redis unavailable: %v (will fallback to HTTP POST)", err)
		} else {
			log.Printf("✅ Connected to Redis at %s", redisURL)
		}
		cancel()
	}

	http.HandleFunc("/health", handleHealth)
	http.HandleFunc("/v1/voice/stream", handleStream)

	log.Printf("⚡ Ultra-Low Latency Go Voice Runtime Server listening on port %s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
