const OpenAIProvider = require('./providers/openai');
const ElevenLabsProvider = require('./providers/elevenlabs');

class TTSAdapter {
  static async synthesize(provider, voiceId, text, apiKey) {
    switch (provider.toLowerCase()) {
      case 'elevenlabs':
        return await ElevenLabsProvider.synthesize(voiceId, text, apiKey);
      case 'openai':
        return await OpenAIProvider.synthesize(voiceId, text, apiKey);
      default:
        throw new Error(`Unsupported TTS provider: ${provider}`);
    }
  }
}

module.exports = TTSAdapter;
