/**
 * Agent Lifecycle Manager (Kubernetes-style Agent Lifecycle State Machine)
 * States: CREATED -> CONFIGURED -> VALIDATED -> DEPLOYED -> MONITORED -> LEARNING -> VERSIONED -> RETIRED
 */

const AgentLifecycleState = {
  CREATED: 'CREATED',
  CONFIGURED: 'CONFIGURED',
  VALIDATED: 'VALIDATED',
  DEPLOYED: 'DEPLOYED',
  MONITORED: 'MONITORED',
  LEARNING: 'LEARNING',
  VERSIONED: 'VERSIONED',
  RETIRED: 'RETIRED'
};

class AgentLifecycleManager {
  constructor(pgPool) {
    this.pool = pgPool;
  }

  async transitionState(agentId, newState, metadata = {}) {
    if (!Object.values(AgentLifecycleState).includes(newState)) {
      throw new Error(`Invalid lifecycle state: ${newState}`);
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Update state in database
      const result = await client.query(
        `UPDATE agents 
         SET status = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2 
         RETURNING id, name, company_id, status`,
        [newState, agentId]
      );

      if (result.rows.length === 0) {
        throw new Error(`Agent ${agentId} not found`);
      }

      const agent = result.rows[0];

      // Audit log the transition
      await client.query(
        `INSERT INTO audit_logs (company_id, action, entity_type, entity_id, details)
         VALUES ($1, $2, 'agent', $3, $4)`,
        [
          agent.company_id,
          `AGENT_LIFECYCLE_${newState}`,
          agentId,
          JSON.stringify({ newState, metadata, timestamp: new Date() })
        ]
      );

      await client.query('COMMIT');
      console.log(`🤖 Agent ${agentId} transitioned to state: ${newState}`);
      return { success: true, agentId, state: newState };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async validateAgent(agentId) {
    const res = await this.pool.query('SELECT * FROM agents WHERE id = $1', [agentId]);
    if (res.rows.length === 0) throw new Error('Agent not found');
    const agent = res.rows[0];

    const errors = [];
    if (!agent.prompt || agent.prompt.trim().length < 10) errors.push('Prompt too short or missing');
    if (!agent.voice_provider || !agent.voice_id) errors.push('Voice provider/ID unassigned');
    if (!agent.model_provider || !agent.model_id) errors.push('Model provider/ID unassigned');

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    await this.transitionState(agentId, AgentLifecycleState.VALIDATED);
    return { valid: true };
  }

  async deployAgent(agentId, phoneNumberId) {
    const val = await this.validateAgent(agentId);
    if (!val.valid) {
      throw new Error(`Cannot deploy invalid agent: ${val.errors.join(', ')}`);
    }

    if (phoneNumberId) {
      await this.pool.query('UPDATE phone_numbers SET agent_id = $1 WHERE id = $2', [agentId, phoneNumberId]);
    }

    return await this.transitionState(agentId, AgentLifecycleState.DEPLOYED, { phoneNumberId });
  }

  async retireAgent(agentId) {
    // Unassign phone numbers
    await this.pool.query('UPDATE phone_numbers SET agent_id = NULL WHERE agent_id = $1', [agentId]);
    return await this.transitionState(agentId, AgentLifecycleState.RETIRED);
  }
}

module.exports = {
  AgentLifecycleManager,
  AgentLifecycleState
};
