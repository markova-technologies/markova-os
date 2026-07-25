class AgentHierarchy {
  constructor(pool, eventBus) {
    this.pool = pool;
    this.eventBus = eventBus;
  }

  async assignTask(commanderId, executorId, taskType, input, companyId) {
    // Check if executor is a valid child of commander
    const hierarchyCheck = await this.pool.query(
      `SELECT * FROM agent_hierarchy 
       WHERE parent_agent_id = $1 AND child_agent_id = $2 AND company_id = $3`,
      [commanderId, executorId, companyId]
    );

    if (hierarchyCheck.rows.length === 0) {
      throw new Error(`Governance Error: Agent ${commanderId} is not authorized to command Agent ${executorId}`);
    }

    const result = await this.pool.query(
      `INSERT INTO agent_tasks (company_id, commander_id, executor_id, task_type, input, status)
       VALUES ($1, $2, $3, $4, $5, 'delegated')
       RETURNING *`,
      [companyId, commanderId, executorId, taskType, input]
    );

    const task = result.rows[0];

    if (this.eventBus) {
      await this.eventBus.publish('task.delegated', {
        taskId: task.id,
        commanderId,
        executorId,
        companyId
      });
    }

    return task;
  }

  async completeTask(taskId, executorId, output, status = 'completed') {
    const result = await this.pool.query(
      `UPDATE agent_tasks 
       SET status = $1, output = $2, completed_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND executor_id = $4
       RETURNING *`,
      [status, output, taskId, executorId]
    );

    if (result.rows.length === 0) {
      throw new Error("Task not found or unauthorized.");
    }

    if (this.eventBus) {
      await this.eventBus.publish(`task.${status}`, {
        taskId: result.rows[0].id,
        companyId: result.rows[0].company_id
      });
    }

    return result.rows[0];
  }
}

module.exports = AgentHierarchy;
