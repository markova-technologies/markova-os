const axios = require('axios');
const FormData = require('form-data');

class OpenAIProvider {
  static async complete(modelId, messages, apiKey) {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: modelId || 'gpt-4o-mini',
        messages,
        max_tokens: 300,
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    const text = response.data.choices[0].message.content.trim();
    const tokens = response.data.usage.total_tokens;
    return { text, tokensUsed: tokens };
  }

  static async transcribe(modelId, audioBuffer, filename, apiKey, lang = 'am') {
    const form = new FormData();
    form.append('file', audioBuffer, { filename, contentType: filename.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg' });
    form.append('model', modelId || 'whisper-1');
    form.append('language', lang);

    const response = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );
    return response.data.text;
  }

  static async synthesize(voiceId, text, apiKey) {
    const response = await axios.post(
      'https://api.openai.com/v1/audio/speech',
      {
        model: 'tts-1',
        voice: voiceId || 'alloy',
        input: text
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      }
    );
    return response.data;
  }
}

module.exports = OpenAIProvider;
