const WorkingMemory = require('./layers/working');
const ConversationMemory = require('./layers/conversation');
const LongTermMemory = require('./layers/long-term');
const BusinessMemory = require('./layers/business');
const SemanticMemory = require('./layers/semantic');
const SharedTeamMemory = require('./layers/shared-team');

class MemoryManager {
  constructor({ redisClient, pgPool } = {}) {
    this.working = new WorkingMemory(redisClient);
    this.conversation = new ConversationMemory(redisClient);
    this.longTerm = new LongTermMemory(pgPool);
    this.business = new BusinessMemory(pgPool);
    this.semantic = new SemanticMemory(pgPool);
    this.sharedTeam = new SharedTeamMemory(redisClient);
  }

  /**
   * Aggregate full context for an incoming call/turn across all 6 layers
   */
  async buildTurnContext({ companyId, callSid, callerNumber, queryEmbedding, teamId }) {
    const [workingData, conversationHistory, customerProfile, businessRules, semanticChunks, teamLearnings] = await Promise.all([
      this.working.get(callSid, 'scratchpad').catch(() => null),
      this.conversation.getMessages(callSid).catch(() => []),
      customerProfile ? this.longTerm.getCustomerMemory(companyId, callerNumber).catch(() => null) : null,
      this.business.getBusinessContext(companyId).catch(() => ({})),
      queryEmbedding ? this.semantic.searchSemanticFacts(companyId, queryEmbedding).catch(() => []) : [],
      teamId ? this.sharedTeam.getTeamMemory(companyId, teamId, 'latest_learnings').catch(() => null) : null,
    ]);

    return {
      working: workingData,
      conversation: conversationHistory,
      customer: customerProfile,
      business: businessRules,
      semantic: semanticChunks,
      team: teamLearnings
    };
  }
}

module.exports = {
  MemoryManager,
  WorkingMemory,
  ConversationMemory,
  LongTermMemory,
  BusinessMemory,
  SemanticMemory,
  SharedTeamMemory
};
