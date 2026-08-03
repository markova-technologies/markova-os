/**
 * Context Engine (Curates, trims, deduplicates, and formats context before hitting LLM)
 * Flow: Conversation -> Context Builder -> Memory -> Knowledge -> User State -> Business State -> Prompt
 */

class ContextEngine {
  constructor({ tokenLimit = 3500 } = {}) {
    this.tokenLimit = tokenLimit;
  }

  /**
   * Approximate token count (rough heuristic: ~4 chars per token)
   */
  _estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }

  /**
   * Build complete LLM prompt context payload
   */
  buildContext({
    agentPrompt,
    conversationHistory = [],
    memoryContext = {},
    knowledgeChunks = [],
    userState = {},
    businessState = {}
  }) {
    const contextSections = [];

    // 1. System Prompt Base
    if (agentPrompt) {
      contextSections.push(`### System Instructions:\n${agentPrompt}`);
    }

    // 2. Business State & Policies
    if (businessState && Object.keys(businessState).length > 0) {
      contextSections.push(`### Business Rules & Context:\n${JSON.stringify(businessState, null, 2)}`);
    }

    // 3. Customer / User State
    if (userState && Object.keys(userState).length > 0) {
      contextSections.push(`### Customer Profile & State:\n${JSON.stringify(userState, null, 2)}`);
    }

    // 4. Memory Context (Cross-agent & Semantic Memory)
    if (memoryContext && Object.keys(memoryContext).length > 0) {
      contextSections.push(`### Memory Context:\n${JSON.stringify(memoryContext, null, 2)}`);
    }

    // 5. Retrieved Knowledge (RAG)
    if (knowledgeChunks && knowledgeChunks.length > 0) {
      const knowledgeText = knowledgeChunks.join('\n---\n');
      contextSections.push(`### Relevant Knowledge:\n${knowledgeText}`);
    }

    const systemMessageContent = contextSections.join('\n\n');

    // 6. Token Budget Control - Trim older conversation history if over budget
    const systemTokens = this._estimateTokens(systemMessageContent);
    const availableHistoryTokens = Math.max(500, this.tokenLimit - systemTokens);

    const trimmedHistory = [];
    let historyTokenCount = 0;

    // Traverse conversation from newest to oldest
    for (let i = conversationHistory.length - 1; i >= 0; i--) {
      const msg = conversationHistory[i];
      const msgTokens = this._estimateTokens(msg.content);
      if (historyTokenCount + msgTokens > availableHistoryTokens) {
        break;
      }
      trimmedHistory.unshift(msg);
      historyTokenCount += msgTokens;
    }

    const finalMessages = [
      { role: 'system', content: systemMessageContent },
      ...trimmedHistory
    ];

    return {
      messages: finalMessages,
      estimatedTokens: systemTokens + historyTokenCount,
      trimmedCount: conversationHistory.length - trimmedHistory.length
    };
  }
}

module.exports = ContextEngine;
