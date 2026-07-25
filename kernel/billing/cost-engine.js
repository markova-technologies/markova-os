class CostEngine {
  constructor(pool) {
    this.pool = pool;
    // Base cost per 1k tokens (Example pricing)
    this.PRICING = {
      'gpt-4o': { prompt: 0.005, completion: 0.015 },
      'gpt-3.5-turbo': { prompt: 0.0005, completion: 0.0015 },
      'gemini-1.5-pro': { prompt: 0.0035, completion: 0.0105 }
    };
    // Markova platform margin (e.g., 20% markup on wholesale LLM costs)
    this.DEFAULT_MARKUP_PERCENT = 0.20; 
  }

  async calculateAndLogCost(companyId, agentId, modelName, provider, promptTokens, completionTokens, traceId) {
    const rates = this.PRICING[modelName] || { prompt: 0.0, completion: 0.0 };
    
    const costUsd = (promptTokens / 1000) * rates.prompt + (completionTokens / 1000) * rates.completion;
    const markupUsd = costUsd * this.DEFAULT_MARKUP_PERCENT;
    const finalBilledUsd = costUsd + markupUsd;

    await this.pool.query(
      `INSERT INTO ai_cost_logs (company_id, agent_id, trace_id, model_name, provider, prompt_tokens, completion_tokens, total_tokens, cost_usd, markup_usd, final_billed_usd)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        companyId, agentId, traceId, modelName, provider, 
        promptTokens, completionTokens, promptTokens + completionTokens,
        costUsd, markupUsd, finalBilledUsd
      ]
    );

    // Also add to unbilled line items for monthly invoice
    if (finalBilledUsd > 0) {
      await this.pool.query(
        `INSERT INTO billing_line_items (company_id, description, amount_usd, type, status)
         VALUES ($1, $2, $3, 'usage', 'unbilled')`,
        [companyId, `AI Inference Usage: ${modelName} (${promptTokens + completionTokens} tokens)`, finalBilledUsd]
      );
    }

    return { costUsd, finalBilledUsd };
  }
}

module.exports = CostEngine;
