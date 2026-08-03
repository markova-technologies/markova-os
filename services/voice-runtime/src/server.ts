import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/v1/voice/stream' });

const PORT = process.env.PORT || 5007;
const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://orchestrator:6000';
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || '';

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'voice-runtime', version: '1.1.0' });
});

// Active voice sessions: streamSid -> { clientWs, deepgramWs, sessionMeta }
const activeStreams = new Map<string, {
  clientWs: WebSocket;
  deepgramWs: WebSocket | null;
  callId: string;
  companyId: string;
  agentId: string;
  transcript: string[];
}>();

/**
 * Connect to Deepgram Streaming STT for a given stream session.
 * Returns a WebSocket connected to Deepgram's live transcription endpoint.
 */
function connectDeepgram(streamSid: string): WebSocket | null {
  if (!DEEPGRAM_API_KEY) {
    console.warn(`[VoiceRuntime] DEEPGRAM_API_KEY not set — STT transcription disabled for ${streamSid}`);
    return null;
  }

  // Deepgram Nova-2 model, Amharic + English, interim results
  const dgUrl = 'wss://api.deepgram.com/v1/listen?' + [
    'model=nova-2',
    'language=am',     // Amharic primary
    'encoding=mulaw',  // Twilio Mulaw 8kHz
    'sample_rate=8000',
    'channels=1',
    'interim_results=true',
    'endpointing=500', // 500ms silence = utterance end
    'punctuate=true',
  ].join('&');

  let dgWs: WebSocket;
  try {
    dgWs = new WebSocket(dgUrl, { headers: { Authorization: `Token ${DEEPGRAM_API_KEY}` } });
  } catch (e: any) {
    console.error(`[VoiceRuntime] Deepgram WS connect error for ${streamSid}:`, e.message);
    return null;
  }

  dgWs.on('open', () => {
    console.log(`[VoiceRuntime] Deepgram STT connected for stream: ${streamSid}`);
  });

  dgWs.on('message', async (data: Buffer) => {
    try {
      const result = JSON.parse(data.toString());
      const channel = result?.channel?.alternatives?.[0];
      const transcript = channel?.transcript?.trim();
      const isFinal = result?.is_final;

      if (!transcript || !isFinal) return;

      const session = activeStreams.get(streamSid);
      if (!session) return;

      console.log(`[VoiceRuntime] 📝 STT Final: "${transcript}" [stream: ${streamSid}]`);
      session.transcript.push(transcript);

      // Forward transcript to orchestrator for LLM processing
      try {
        await axios.post(`${ORCHESTRATOR_URL}/handle-input`, {
          SpeechResult: transcript,
          CallSid: session.callId,
          From: session.companyId,
        }, { timeout: 10000 });
      } catch (err: any) {
        console.error(`[VoiceRuntime] Orchestrator forward failed for ${streamSid}:`, err.message);
      }
    } catch (e) {
      // Deepgram metadata frame — ignore
    }
  });

  dgWs.on('error', (err) => {
    console.error(`[VoiceRuntime] Deepgram WS error for ${streamSid}:`, err.message);
  });

  dgWs.on('close', () => {
    console.log(`[VoiceRuntime] Deepgram STT disconnected: ${streamSid}`);
  });

  return dgWs;
}

wss.on('connection', (ws: WebSocket, req) => {
  const params = new URLSearchParams(req.url?.split('?')[1] || '');
  const streamSid = params.get('streamSid') || `stream_${Date.now()}`;
  const callId = params.get('callId') || streamSid;
  const companyId = params.get('companyId') || '';
  const agentId = params.get('agentId') || '';

  console.log(`[VoiceRuntime] 🎙️ Voice Stream connected: ${streamSid}`);

  // Start Deepgram STT for this stream
  const deepgramWs = connectDeepgram(streamSid);

  activeStreams.set(streamSid, {
    clientWs: ws,
    deepgramWs,
    callId,
    companyId,
    agentId,
    transcript: [],
  });

  ws.on('message', (message: Buffer) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.event === 'media') {
        // Twilio sends base64-encoded mulaw audio payload
        const audioPayload = Buffer.from(data.media.payload, 'base64');
        const session = activeStreams.get(streamSid);

        // Forward raw audio bytes to Deepgram
        if (session?.deepgramWs?.readyState === WebSocket.OPEN) {
          session.deepgramWs.send(audioPayload);
        }
      } else if (data.event === 'stop') {
        console.log(`[VoiceRuntime] 🛑 Stream stop event: ${streamSid}`);
        cleanup(streamSid);
      } else if (data.event === 'start') {
        console.log(`[VoiceRuntime] ▶️ Stream started: ${streamSid}, callSid: ${data.start?.callSid}`);
      }
    } catch (e) {
      // Binary PCM audio — forward directly
      const session = activeStreams.get(streamSid);
      if (session?.deepgramWs?.readyState === WebSocket.OPEN) {
        session.deepgramWs.send(message);
      }
    }
  });

  ws.on('close', () => {
    console.log(`[VoiceRuntime] 🔌 Voice stream closed: ${streamSid}`);
    cleanup(streamSid);
  });

  ws.on('error', (err) => {
    console.error(`[VoiceRuntime] Client WS error for ${streamSid}:`, err.message);
    cleanup(streamSid);
  });
});

function cleanup(streamSid: string) {
  const session = activeStreams.get(streamSid);
  if (!session) return;
  try {
    if (session.deepgramWs?.readyState === WebSocket.OPEN) {
      session.deepgramWs.close();
    }
  } catch (e) {}
  activeStreams.delete(streamSid);
}

// REST: get transcript for a stream session
app.get('/v1/voice/transcript/:streamSid', (req, res) => {
  const session = activeStreams.get(req.params.streamSid);
  if (!session) return res.status(404).json({ error: 'Stream not found or already closed' });
  res.json({ streamSid: req.params.streamSid, transcript: session.transcript });
});

// REST: list active streams
app.get('/v1/voice/streams', (req, res) => {
  const streams = [...activeStreams.keys()].map(sid => ({
    streamSid: sid,
    callId: activeStreams.get(sid)!.callId,
    companyId: activeStreams.get(sid)!.companyId,
    transcriptLines: activeStreams.get(sid)!.transcript.length,
  }));
  res.json({ count: streams.length, streams });
});

server.listen(PORT, () => {
  console.log(`[VoiceRuntime] 🔊 Voice Runtime (Deepgram STT + Orchestrator forward) running on port ${PORT}`);
});
