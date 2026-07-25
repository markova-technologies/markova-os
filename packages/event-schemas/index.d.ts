export interface BaseEvent {
  tenantId: string;
}

export interface CallStartedEvent extends BaseEvent {
  callId: string;
  callerNumber: string;
  agentId: string;
}

export interface CallEndedEvent extends BaseEvent {
  callId: string;
  durationSeconds: number;
  status: string;
  turnCount: number;
}

export interface ToolExecutedEvent extends BaseEvent {
  toolId: string;
  agentId: string;
  callId?: string;
  success: boolean;
  executionTimeMs: number;
}
