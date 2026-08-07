package stt

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"time"
	"encoding/binary"
)

const groqSTTURL = "https://api.groq.com/openai/v1/audio/transcriptions"

// The same Amharic vocabulary prompt used in main.py
const amharicPrompt = "ሰላም የጂኤም ፈርኒቸር ደንበኛ ድጋፍ ነኝ። ሶፋ ዋጋ how much ነው? discount አለ? delivery free ነው? ወንበር price ስንት ነው? አልጋ ጠረጴዛ ካቢኔ ዋርድሮብ"

type GroqSTT struct {
	APIKey     string
	HTTPClient *http.Client
}

func NewGroqSTT() *GroqSTT {
	return &GroqSTT{
		APIKey:     os.Getenv("GROQ_API_KEY"),
		HTTPClient: &http.Client{Timeout: 15 * time.Second},
	}
}

type transcriptionResponse struct {
	Text string `json:"text"`
}

// Transcribe sends mulaw audio to Groq Whisper and returns the transcript.
// Audio is sent as WAV; the mulaw bytes are wrapped in a minimal WAV header.
func (g *GroqSTT) Transcribe(mulawAudio []byte, lang string) (string, error) {
	wavBytes := wrapMulawAsWAV(mulawAudio)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)

	filePart, err := writer.CreateFormFile("file", "audio.wav")
	if err != nil {
		return "", err
	}
	filePart.Write(wavBytes)

	writer.WriteField("model", "whisper-large-v3-turbo")
	writer.WriteField("language", lang)
	writer.WriteField("prompt", amharicPrompt)
	writer.Close()

	req, _ := http.NewRequest("POST", groqSTTURL, &body)
	req.Header.Set("Authorization", "Bearer "+g.APIKey)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := g.HTTPClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("groq stt request failed: %w", err)
	}
	defer resp.Body.Close()

	respBytes, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("groq stt error %d: %s", resp.StatusCode, string(respBytes))
	}

	var result transcriptionResponse
	json.Unmarshal(respBytes, &result)
	return result.Text, nil
}

// wrapMulawAsWAV generates a valid WAV header for 8kHz, 1-channel, 8-bit mulaw audio
func wrapMulawAsWAV(mulawData []byte) []byte {
	dataLen := uint32(len(mulawData))
	fileLen := dataLen + 36

	var buf bytes.Buffer
	// ChunkID
	buf.WriteString("RIFF")
	// ChunkSize
	binary.Write(&buf, binary.LittleEndian, fileLen)
	// Format
	buf.WriteString("WAVE")
	// Subchunk1ID
	buf.WriteString("fmt ")
	// Subchunk1Size (16 for PCM/Mulaw basic)
	binary.Write(&buf, binary.LittleEndian, uint32(16))
	// AudioFormat (7 for Mulaw)
	binary.Write(&buf, binary.LittleEndian, uint16(7))
	// NumChannels
	binary.Write(&buf, binary.LittleEndian, uint16(1))
	// SampleRate (8000 Hz)
	binary.Write(&buf, binary.LittleEndian, uint32(8000))
	// ByteRate (8000 * 1 * 1)
	binary.Write(&buf, binary.LittleEndian, uint32(8000))
	// BlockAlign (1 * 1)
	binary.Write(&buf, binary.LittleEndian, uint16(1))
	// BitsPerSample
	binary.Write(&buf, binary.LittleEndian, uint16(8))
	// Subchunk2ID
	buf.WriteString("data")
	// Subchunk2Size
	binary.Write(&buf, binary.LittleEndian, dataLen)

	// Write data
	buf.Write(mulawData)

	return buf.Bytes()
}
