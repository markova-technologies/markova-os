import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/v1/voice/stream' });

const PORT = process.env.PORT || 5007;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'voice-runtime', version: '1.0.0' });
});

// Voice Session Bridge Manager
const activeStreams = new Map<string, WebSocket>();

wss.on('connection', (ws: WebSocket, req) => {
  const streamSid = req.url?.split('streamSid=')[1] || `stream_${Date.now()}`;
  activeStreams.set(streamSid, ws);
  console.log(`🎙️ Voice Runtime WebSocket Connected: ${streamSid}`);

  ws.on('message', (message: Buffer) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.event === 'media') {
        // Real-time audio chunk (Mulaw / PCM) stream from Twilio / WebRTC
        // Ready for ultra-low-latency STT streaming (Deepgram / Whisper)
      } else if (data.event === 'stop') {
        console.log(`🛑 Stream stopped: ${streamSid}`);
        activeStreams.delete(streamSid);
      }
    } catch (e) {
      // Raw binary PCM audio buffer
    }
  });

  ws.on('close', () => {
    console.log(`🔌 Voice Stream closed: ${streamSid}`);
    activeStreams.delete(streamSid);
  });
});

server.listen(PORT, () => {
  console.log(`🔊 Voice Runtime Service (Real-time Audio Stream Server) running on port ${PORT}`);
});
