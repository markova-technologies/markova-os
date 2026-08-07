package vad

import (
	"math"
)

const (
	SilenceThresholdRMS   = 200.0 // RMS energy threshold for speech detection
	SilenceFramesRequired = 15    // Consecutive silent frames = speech ended (~500ms at 33ms/frame)
)

type VAD struct {
	silenceCount int
	speechActive bool
}

// ProcessMulaw takes raw Twilio mulaw-encoded audio bytes and returns:
// (isSpeech bool, speechEnded bool)
func (v *VAD) ProcessMulaw(mulawBytes []byte) (isSpeech bool, speechEnded bool) {
	// Decode mulaw to 16-bit PCM
	pcm := decodeMulaw(mulawBytes)
	rms := computeRMS(pcm)

	isSpeech = rms > SilenceThresholdRMS

	if isSpeech {
		v.speechActive = true
		v.silenceCount = 0
	} else if v.speechActive {
		v.silenceCount++
		if v.silenceCount >= SilenceFramesRequired {
			// Speech ended: caller paused
			v.speechActive = false
			v.silenceCount = 0
			return false, true
		}
	}

	return isSpeech, false
}

func computeRMS(samples []int16) float64 {
	if len(samples) == 0 {
		return 0
	}
	var sum float64
	for _, s := range samples {
		sum += float64(s) * float64(s)
	}
	return math.Sqrt(sum / float64(len(samples)))
}

// muLawDecode converts an 8-bit mu-law byte to a 16-bit linear PCM value
func muLawDecode(mu byte) int16 {
	mu = ^mu
	sign := mu & 0x80
	exponent := (mu & 0x70) >> 4
	data := int32(mu & 0x0f)
	data |= 0x10
	data <<= 1
	data += 1
	data <<= exponent + 2
	data -= 132
	if sign != 0 {
		return int16(-data)
	}
	return int16(data)
}

// G.711 Mulaw to linear PCM decoder
func decodeMulaw(mulaw []byte) []int16 {
	pcm := make([]int16, len(mulaw))
	for i, b := range mulaw {
		pcm[i] = muLawDecode(b)
	}
	return pcm
}
