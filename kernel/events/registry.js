// Central event type registry
const EventTypes = {
  CALL_STARTED: 'call.started',
  CALL_ENDED: 'call.ended',
  CALL_FAILED: 'call.failed',
  AGENT_CREATED: 'agent.created',
  AGENT_UPDATED: 'agent.updated',
  TOOL_EXECUTED: 'tool.executed',
  TOOL_FAILED: 'tool.failed',
  INTEGRATION_SYNCED: 'integration.synced',
  INTEGRATION_FAILED: 'integration.failed',
  KNOWLEDGE_UPDATED: 'knowledge.updated',
  DOCUMENT_UPLOADED: 'document.uploaded',
  WORKFLOW_STARTED: 'workflow.started',
  WORKFLOW_FINISHED: 'workflow.finished',
  LEAD_CREATED: 'lead.created',
  USER_LOGIN: 'user.login',
  USER_REGISTERED: 'user.registered',
  TENANT_CREATED: 'tenant.created',
  APPROVAL_REQUESTED: 'approval.requested',
  APPROVAL_GRANTED: 'approval.granted',
  APPROVAL_DENIED: 'approval.denied'
};

module.exports = { EventTypes };
