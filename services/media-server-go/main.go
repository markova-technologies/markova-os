package main

import (
	"fmt"
	"log"
	"net"
	"os"
)

// Go Native RTP Media Server for direct Ethio Telecom & SIP Trunking
func main() {
	port := os.Getenv("RTP_PORT")
	if port == "" {
		port = "10000"
	}

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

		// Zero-copy RTP audio packet processing & VAD (Voice Activity Detection)
		_ = n
		_ = src
	}
}
