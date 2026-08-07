/**
 * Prompt Registry & Versioning Engine
 * Treats prompts like production code: Version Control, Rollback, A/B Testing, & Promotion.
 */
class PromptRegistry {
  constructor(pgPool) {
    this.pool = pgPool;
  }

  async createVersion(agentId, prompt, commitMessage = 'Updated prompt') {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Get latest version number
      const maxRes = await client.query(
        'SELECT COALESCE(MAX(version_number), 0) AS max_v FROM agent_versions WHERE agent_id = $1',
        [agentId]
      );
      const nextVersion = maxRes.rows[0].max_v + 1;

      // Get current agent metadata
      const agentRes = await client.query('SELECT model_provider, model_id, voice_provider, voice_id FROM agents WHERE id = $1', [agentId]);
      if (agentRes.rows.length === 0) throw new Error('Agent not found');
      const agent = agentRes.rows[0];

      // Save version snapshot
      const verRes = await client.query(
        `INSERT INTO agent_versions (agent_id, version_number, prompt, model_provider, model_id, voice_provider, voice_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, version_number, created_at`,
        [agentId, nextVersion, prompt, agent.model_provider, agent.model_id, agent.voice_provider, agent.voice_id]
      );

      // Update current prompt in agent record
      await client.query('UPDATE agents SET prompt = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [prompt, agentId]);

      await client.query('COMMIT');
      console.log(`📜 Saved prompt version v${nextVersion} for Agent ${agentId}`);
      return { success: true, versionNumber: nextVersion, commitMessage, versionId: verRes.rows[0].id };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async rollback(agentId, targetVersionNumber) {
    const res = await this.pool.query(
      'SELECT prompt, model_provider, model_id, voice_provider, voice_id FROM agent_versions WHERE agent_id = $1 AND version_number = $2',
      [agentId, targetVersionNumber]
    );

    if (res.rows.length === 0) {
      throw new Error(`Version v${targetVersionNumber} not found for agent ${agentId}`);
    }

    const ver = res.rows[0];

    // Restore prompt & parameters
    await this.pool.query(
      `UPDATE agents 
       SET prompt = $1, model_provider = $2, model_id = $3, voice_provider = $4, voice_id = $5, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $6`,
      [ver.prompt, ver.model_provider, ver.model_id, ver.voice_provider, ver.voice_id, agentId]
    );

    console.log(`⏪ Rolled back Agent ${agentId} to prompt version v${targetVersionNumber}`);
    return { success: true, rolledBackToVersion: targetVersionNumber };
  }

  async getVersionHistory(agentId) {
    const res = await this.pool.query(
      `SELECT id, version_number, prompt, model_provider, model_id, created_at 
       FROM agent_versions 
       WHERE agent_id = $1 
       ORDER BY version_number DESC`,
      [agentId]
    );
    return res.rows;
  }
  // Prompt injection and safety patterns
  static INJECTION_PATTERNS = [
      /ignore\s+(all\s+)?previous\s+instructions/i,
      /you\s+are\s+now\s+a?\s+different/i,
      /disregard\s+(all|prior|previous)/i,
      /jailbreak/i,
      /\bDAN\b/,  // "Do Anything Now" jailbreak
      /(extract|steal|collect|exfiltrate)\s+(password|pin|card\s+number|account)/i,
      /http[s]?:\/\//,                 // No URLs in system prompts
      /\bsystem\b\s*:\s*/i,            // No "system:" role injection
      /\[\s*INST\s*\]/i,               // LLaMA instruction injection
      /<\|im_start\|>/i,               // GPT instruction injection
  ];

  /**
   * Returns a list of security violations found in the prompt.
   * Returns [] if prompt is safe.
   */
  static scanPromptSafety(prompt) {
      if (!prompt || typeof prompt !== 'string') return ['Invalid prompt format'];
      const violations = [];
      for (const pattern of PromptRegistry.INJECTION_PATTERNS) {
          if (pattern.test(prompt)) {
              violations.push(`Matched injection pattern: ${pattern.source}`);
          }
      }
      // Check for suspicious length (LLM budget exhaustion attack)
      if (prompt.length > 10000) {
          violations.push(`Prompt too long: ${prompt.length} chars (max 10,000)`);
      }
      return violations;
  }

  async createVersionSafe(agentId, prompt, commitMessage = 'Updated prompt') {
      const violations = PromptRegistry.scanPromptSafety(prompt);
      if (violations.length > 0) {
          throw new Error(
              `Prompt rejected by safety scanner. Violations:\n${violations.join('\n')}`
          );
      }
      return this.createVersion(agentId, prompt, commitMessage);
  }
}

module.exports = PromptRegistry;
