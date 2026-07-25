const express = require('express');
const cors = require('cors');
const { LLMAdapter } = require('../../kernel/ai');
const ConversationState = require('./state');
const EventBus = require('../../kernel/events/bus');
const { EventTypes } = require('../../kernel/events/registry');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 6001;
const stateManager = new ConversationState(process.env.REDIS_URL || 'redis://localhost:6379');
const eventBus = new EventBus(process.env.REDIS_URL || 'redis://localhost:6379');

// This endpoint receives an internal message (abstracted from channel) and responds
app.post('/api/conversation/turn', async (req, res) => {
  const { sessionId, tenantId, agentId, message, channel, sourceId } = req.body;

  if (!sessionId || !message) {
    return res.status(400).json({ error: 'sessionId and message are required' });
  }

  try {
    // 1. Get conversation state
    const state = await stateManager.getState(sessionId);

    // Initialize if new
    if (state.messages.length === 0) {
      // Fetch agent prompt here in a real impl (mocked for now)
      state.messages.push({ role: 'system', content: 'You are a helpful assistant.' });
      state.tenantId = tenantId;
      state.agentId = agentId;
      
      await eventBus.publish(EventTypes.CALL_STARTED, {
        tenantId,
        callId: sessionId,
        callerNumber: sourceId,
        agentId
      }, { source: 'conversation-runtime' });
    }

    // 2. Append user message
    state.messages.push({ role: 'user', content: message });
    state.turnCount += 1;

    // 3. Call LLM Runtime (Mocking the config fetch for now)
    const provider = process.env.LLM_PROVIDER || 'openai';
    const modelId = process.env.LLM_MODEL_ID || 'gpt-4o-mini';
    const apiKey = process.env.LLM_API_KEY || 'sk-mock-key';

    const { text, tokensUsed } = await LLMAdapter.complete(provider, modelId, state.messages, apiKey);

    // 4. Append AI response
    state.messages.push({ role: 'assistant', content: text });

    // 5. Save state
    await stateManager.saveState(sessionId, state);

    // Check for goodbye
    const isGoodbye = text.toLowerCase().includes('goodbye') || state.turnCount >= 20;

    if (isGoodbye) {
      await eventBus.publish(EventTypes.CALL_ENDED, {
        tenantId: state.tenantId,
        callId: sessionId,
        durationSeconds: 60, // Mock duration
        status: 'completed',
        turnCount: state.turnCount
      }, { source: 'conversation-runtime' });
      
      await stateManager.deleteState(sessionId);
    }

    res.json({
      success: true,
      response: text,
      isGoodbye,
      metrics: { tokensUsed }
    });

  } catch (error) {
    console.error('Conversation turn error:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'conversation-runtime' });
});

app.listen(PORT, () => {
  console.log(`🚀 Conversation Runtime listening on port ${PORT}`);
});
