class ApprovalQueue {
  constructor(pool, eventBus) {
    this.pool = pool;
    this.eventBus = eventBus;
  }

  async requestApproval(companyId, requesterId, requesterType, action, context, reason) {
    const result = await this.pool.query(
      `INSERT INTO approval_queue (company_id, requester_id, requester_type, action, context, reason, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING id, status, created_at`,
      [companyId, requesterId, requesterType, action, context, reason]
    );

    const approval = result.rows[0];

    if (this.eventBus) {
      await this.eventBus.publish('approval.requested', {
        approvalId: approval.id,
        companyId,
        requesterId,
        requesterType,
        action,
        reason
      });
    }

    return approval;
  }

  async processApproval(approvalId, decision, approverId, decisionReason) {
    if (!['approved', 'denied'].includes(decision)) {
      throw new Error("Decision must be 'approved' or 'denied'");
    }

    const result = await this.pool.query(
      `UPDATE approval_queue 
       SET status = $1, approver_id = $2, decision_reason = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND status = 'pending'
       RETURNING *`,
      [decision, approverId, decisionReason, approvalId]
    );

    if (result.rows.length === 0) {
      throw new Error("Approval request not found or already processed.");
    }

    const approval = result.rows[0];

    if (this.eventBus) {
      const eventType = decision === 'approved' ? 'approval.granted' : 'approval.denied';
      await this.eventBus.publish(eventType, {
        approvalId: approval.id,
        companyId: approval.company_id,
        approverId,
        action: approval.action
      });
    }

    return approval;
  }

  async getPendingApprovals(companyId) {
    const result = await this.pool.query(
      `SELECT * FROM approval_queue WHERE company_id = $1 AND status = 'pending' ORDER BY created_at DESC`,
      [companyId]
    );
    return result.rows;
  }
}

module.exports = ApprovalQueue;
