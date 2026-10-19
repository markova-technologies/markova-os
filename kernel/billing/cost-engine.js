class CostEngine {
  constructor(pool) {
    this.pool = pool;
    // Base cost per 1k tokens (Wholesale provider rates in USD)
    this.PRICING = {
      // Groq Models (Voice pipeline default)
      'llama-3.3-70b-versatile': { prompt: 0.00059, completion: 0.00079 },
      'llama-3.1-70b-versatile': { prompt: 0.00059, completion: 0.00079 },
      'llama-3.1-8b-instant': { prompt: 0.00005, completion: 0.00008 },
      'llama3-70b-8192': { prompt: 0.00059, completion: 0.00079 },
      'llama3-8b-8192': { prompt: 0.00005, completion: 0.00008 },
      'mixtral-8x7b-32768': { prompt: 0.00024, completion: 0.00024 },
      'whisper-large-v3': { prompt: 0.0001, completion: 0.0001 },
      'whisper-large-v3-turbo': { prompt: 0.00004, completion: 0.00004 },

      // OpenAI Models
      'gpt-4o': { prompt: 0.005, completion: 0.015 },
      'gpt-4o-mini': { prompt: 0.00015, completion: 0.0006 },
      'gpt-3.5-turbo': { prompt: 0.0005, completion: 0.0015 },

      // Google Gemini Models
      'gemini-2.5-flash': { prompt: 0.0001, completion: 0.0004 },
      'gemini-1.5-flash': { prompt: 0.000075, completion: 0.0003 },
      'gemini-1.5-pro': { prompt: 0.00125, completion: 0.005 },

      // Default fallback rate for unlisted models
      '_default': { prompt: 0.0005, completion: 0.0015 },
    };
    // Markova platform margin (20% markup on wholesale LLM costs)
    this.DEFAULT_MARKUP_PERCENT = 0.20; 
  }

  async calculateAndLogCost(companyId, agentId, modelName, provider, promptTokens, completionTokens, traceId) {
    const rates = this.PRICING[modelName] || this.PRICING['_default'] || { prompt: 0.0005, completion: 0.0015 };
    
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
