const OpenAIProvider = require('./providers/openai');
const GroqProvider = require('./providers/groq');
const GeminiProvider = require('./providers/gemini');

class LLMAdapter {
  static async complete(provider, modelId, messages, apiKey) {
    switch (provider.toLowerCase()) {
      case 'openai':
        return await OpenAIProvider.complete(modelId, messages, apiKey);
      case 'groq':
        return await GroqProvider.complete(modelId, messages, apiKey);
      case 'gemini':
        return await GeminiProvider.complete(modelId, messages, apiKey);
      default:
        throw new Error(`Unsupported LLM provider: ${provider}`);
    }
  }
}

module.exports = LLMAdapter;
