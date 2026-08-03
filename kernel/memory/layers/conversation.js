/**
 * Conversation Memory (Active dialogue window and session state)
 */
class ConversationMemory {
  constructor(redisClient) {
    this.redis = redisClient;
  }

  async getMessages(callSid) {
    if (!this.redis) return [];
    const data = await this.redis.get(`call:${callSid}:state`);
    if (!data) return [];
    const state = JSON.parse(data);
    return state.messages || [];
  }

  async appendMessage(callSid, role, content) {
    if (!this.redis) return;
    const data = await this.redis.get(`call:${callSid}:state`);
    const state = data ? JSON.parse(data) : { messages: [], turn_count: 0 };
    state.messages.append ? state.messages.append({ role, content }) : state.messages.push({ role, content });
    state.turn_count += 1;
    await this.redis.setEx(`call:${callSid}:state`, 3600, JSON.stringify(state));
  }
}

module.exports = ConversationMemory;
