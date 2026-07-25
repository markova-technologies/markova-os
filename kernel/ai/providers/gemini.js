const axios = require('axios');

class GeminiProvider {
  static async complete(modelId, messages, apiKey) {
    const contents = messages.map(msg => {
      if (msg.role === 'system') {
        return { role: 'user', parts: [{ text: `SYSTEM INSTRUCTION: ${msg.content}` }] };
      }
      const role = msg.role === 'assistant' ? 'model' : 'user';
      return { role, parts: [{ text: msg.content }] };
    });

    const model = modelId || 'gemini-1.5-flash';
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      { contents },
      { headers: { 'Content-Type': 'application/json' } }
    );
    
    const text = response.data.candidates[0].content.parts[0].text.trim();
    return { text, tokensUsed: 0 };
  }
}

module.exports = GeminiProvider;
