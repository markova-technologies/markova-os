package buffer

import "sync"

type AudioBuffer struct {
	mu     sync.Mutex
	chunks [][]byte
	size   int
}

func (b *AudioBuffer) Append(chunk []byte) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.chunks = append(b.chunks, chunk)
	b.size += len(chunk)
}

// Flush returns all accumulated audio and resets the buffer
func (b *AudioBuffer) Flush() []byte {
	b.mu.Lock()
	defer b.mu.Unlock()
	if len(b.chunks) == 0 {
		return nil
	}
	result := make([]byte, 0, b.size)
	for _, c := range b.chunks {
		result = append(result, c...)
	}
	b.chunks = nil
	b.size = 0
	return result
}

func (b *AudioBuffer) Size() int {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.size
}
