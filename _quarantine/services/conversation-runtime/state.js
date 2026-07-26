const { createClient } = require('redis');

class ConversationState {
  constructor(redisUrl) {
    this.client = createClient({ url: redisUrl });
    this.client.on('error', (err) => console.error('Redis State Error', err));
  }

  async connect() {
    if (!this.client.isOpen) {
      await this.client.connect();
    }
  }

  async getState(sessionId) {
    await this.connect();
    const raw = await this.client.get(`conv_state:${sessionId}`);
    return raw ? JSON.parse(raw) : { messages: [], turnCount: 0 };
  }

  async saveState(sessionId, state, ttl = 3600) {
    await this.connect();
    await this.client.setEx(`conv_state:${sessionId}`, ttl, JSON.stringify(state));
  }

  async deleteState(sessionId) {
    await this.connect();
    await this.client.del(`conv_state:${sessionId}`);
  }
}

module.exports = ConversationState;
