const express = require('express');
const cors = require('cors');
const { LLMAdapter } = require('../../kernel/ai');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 6003;

app.post('/api/planner/route', async (req, res) => {
  const { messages, availableTools, availableAgents } = req.body;
  
  if (!messages || messages.length === 0) {
    return res.status(400).json({ error: 'messages are required' });
  }

  try {
    // Determine the next action using a fast LLM pass
    const prompt = `
    Based on the conversation history, decide the NEXT action.
    Available Tools: ${JSON.stringify(availableTools || [])}
    Available Agents: ${JSON.stringify(availableAgents || [])}
    
    Return a JSON object: 
    { "action": "respond_to_user" | "execute_tool" | "transfer_to_agent", "target": "string (tool_id or agent_id)" }
    `;

    const plannerMessages = [
      { role: 'system', content: prompt },
      ...messages
    ];

    const provider = process.env.PLANNER_PROVIDER || 'openai';
    const modelId = process.env.PLANNER_MODEL_ID || 'gpt-4o-mini';
    const apiKey = process.env.LLM_API_KEY || 'sk-mock-key';

    const { text, tokensUsed } = await LLMAdapter.complete(provider, modelId, plannerMessages, apiKey);
    
    // Attempt to parse JSON response
    let decision = { action: 'respond_to_user' };
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        decision = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('Failed to parse planner JSON:', e);
    }

    res.json({
      success: true,
      decision,
      metrics: { tokensUsed }
    });

  } catch (error) {
    console.error('Planner route error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'planner-runtime' });
});

app.listen(PORT, () => {
  console.log(`🚀 Planner Runtime listening on port ${PORT}`);
});
