const OpenAIProvider = require('./providers/openai');
const GroqProvider = require('./providers/groq');

class STTAdapter {
  static async transcribe(provider, modelId, audioBuffer, filename, apiKey, lang = 'am') {
    switch (provider.toLowerCase()) {
      case 'openai':
        return await OpenAIProvider.transcribe(modelId, audioBuffer, filename, apiKey, lang);
      case 'groq':
        return await GroqProvider.transcribe(modelId, audioBuffer, filename, apiKey, lang);
      // Deepgram omitted for brevity but would follow same pattern
      default:
        throw new Error(`Unsupported STT provider: ${provider}`);
    }
  }
}

module.exports = STTAdapter;
