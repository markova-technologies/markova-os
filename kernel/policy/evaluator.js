class PolicyEvaluator {
  constructor(approvalQueue) {
    this.approvalQueue = approvalQueue;
    
    // Actions that always require approval
    this.ACTIONS_REQUIRING_APPROVAL = [
      'refund_money',
      'delete_record',
      'change_appointment',
      'modify_crm',
      'transfer_call'
    ];
  }

  evaluate(context, action, policyRules = []) {
    let requiredApprovals = [];
    let isBlocked = false;

    // Built-in hardcoded rules for high-risk actions
    if (this.ACTIONS_REQUIRING_APPROVAL.includes(action)) {
      requiredApprovals.push('manager'); // At least a manager needs to approve
    }

    // Tenant-specific dynamic rule engine
    for (const rule of policyRules) {
      if (rule.type === 'require_approval' && context[rule.conditionField] === rule.conditionValue) {
        requiredApprovals.push(rule.approverRole);
      }
      if (rule.type === 'block' && context[rule.conditionField] === rule.conditionValue) {
        isBlocked = true;
      }
    }

    return {
      allowed: !isBlocked && requiredApprovals.length === 0,
      requiresApproval: requiredApprovals.length > 0,
      approvers: requiredApprovals,
      blocked: isBlocked
    };
  }

  async enforceOrRequest(context, action, policyRules, companyId, requesterId, requesterType, reason = '') {
    const evalResult = this.evaluate(context, action, policyRules);

    if (evalResult.blocked) {
      throw new Error(`Policy blocked action: ${action}`);
    }

    if (evalResult.requiresApproval) {
      if (!this.approvalQueue) {
        throw new Error("Approval required but ApprovalQueue is not initialized.");
      }

      const approval = await this.approvalQueue.requestApproval(
        companyId, 
        requesterId, 
        requesterType, 
        action, 
        context, 
        reason || `System requested approval for ${action}`
      );

      return {
        executed: false,
        status: 'pending_approval',
        approvalId: approval.id,
        approvers: evalResult.approvers
      };
    }

    return {
      executed: true,
      status: 'approved'
    };
  }
}

module.exports = PolicyEvaluator;
