const axios = require('axios');
const FormData = require('form-data');

class GroqProvider {
  static async complete(modelId, messages, apiKey) {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: modelId || 'llama-3.3-70b-versatile',
        messages,
        max_tokens: 300
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    const text = response.data.choices[0].message.content.trim();
    const tokens = response.data.usage?.total_tokens || 0;
    return { text, tokensUsed: tokens };
  }

  static async transcribe(modelId, audioBuffer, filename, apiKey, lang = 'am') {
    const form = new FormData();
    form.append('file', audioBuffer, { filename, contentType: filename.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg' });
    form.append('model', modelId || 'whisper-large-v3-turbo');
    form.append('language', lang);

    const response = await axios.post(
      'https://api.groq.com/openai/v1/audio/transcriptions',
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
}

module.exports = GroqProvider;
