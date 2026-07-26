const express = require('express');
const cors = require('cors');
const axios = require('axios');
const serviceAuth = require('../../kernel/identity/service-auth');
const { VoiceChannelAdapter } = require('../../kernel/channel');

const app = express();
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const PORT = process.env.PORT || 6002;
const CONVERSATION_RUNTIME_URL = process.env.CONVERSATION_RUNTIME_URL || 'http://localhost:6001';
const voiceAdapter = new VoiceChannelAdapter();

// 1. Twilio Webhook - Inbound Call
app.post('/twilio/voice', async (req, res) => {
  try {
    const internalMsg = await voiceAdapter.receiveMessage(req.body);
    
    // Send to Conversation Runtime (with service auth header)
    const response = await axios.post(
      `${CONVERSATION_RUNTIME_URL}/api/conversation/turn`,
      {
        sessionId: req.body.CallSid,
        tenantId: req.query.tenantId || 'unknown',
        agentId: req.query.agentId || 'unknown',
        message: 'HELLO_CALL_STARTED', // Initial trigger
        channel: 'voice',
        sourceId: internalMsg.sourceId
      },
      serviceAuth.inject({}, 'voice-runtime')
    );

    const twiml = await voiceAdapter.sendMessage({ text: response.data.response }, internalMsg.context);
    // Wrap with Gather for next turn
    const twimlWithGather = twiml.replace('</Response>', '<Gather input="speech" action="/twilio/respond" speechTimeout="auto">...</Gather></Response>');
    res.type('text/xml').send(twimlWithGather);

  } catch (error) {
    console.error('Voice inbound error:', error.message);
    res.type('text/xml').send('<Response><Say>Service unavailable</Say><Hangup/></Response>');
  }
});

// 2. Twilio Webhook - Speech Gathered
app.post('/twilio/respond', async (req, res) => {
  try {
    const internalMsg = await voiceAdapter.receiveMessage(req.body);

    if (!internalMsg.content) {
      const twiml = await voiceAdapter.sendMessage({ text: 'I didn\'t catch that.' }, internalMsg.context);
      const twimlWithGather = twiml.replace('</Response>', '<Gather input="speech" action="/twilio/respond" speechTimeout="auto">...</Gather></Response>');
      return res.type('text/xml').send(twimlWithGather);
    }

    // Send to Conversation Runtime (with service auth header)
    const response = await axios.post(
      `${CONVERSATION_RUNTIME_URL}/api/conversation/turn`,
      {
        sessionId: req.body.CallSid,
        message: internalMsg.content,
        channel: 'voice',
        sourceId: internalMsg.sourceId
      },
      serviceAuth.inject({}, 'voice-runtime')
    );

    const twiml = await voiceAdapter.sendMessage({ text: response.data.response }, internalMsg.context);
    
    if (response.data.isGoodbye) {
      res.type('text/xml').send(twiml.replace('</Response>', '<Hangup/></Response>'));
    } else {
      const twimlWithGather = twiml.replace('</Response>', '<Gather input="speech" action="/twilio/respond" speechTimeout="auto">...</Gather></Response>');
      res.type('text/xml').send(twimlWithGather); 
    }

  } catch (error) {
    console.error('Voice respond error:', error.message);
    res.type('text/xml').send('<Response><Say>Error processing speech</Say><Hangup/></Response>');
  }
});

// 3. Twilio Webhook - Call Status
app.post('/twilio/status', async (req, res) => {
  console.log(`Call Status: ${req.body.CallStatus} for SID ${req.body.CallSid}`);
  res.send('ok');
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'voice-runtime' });
});

app.listen(PORT, () => {
  console.log(`🚀 Voice Runtime listening on port ${PORT}`);
});
