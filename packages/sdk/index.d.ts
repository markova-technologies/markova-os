export class MarkovaError extends Error {
  status?: number;
  body?: unknown;
  constructor(message: string, opts?: { status?: number; body?: unknown });
}

export interface MarkovaOptions {
  baseUrl?: string;
  apiKey?: string;
  token?: string;
}

export declare class Markova {
  constructor(opts?: MarkovaOptions);
  setToken(token: string): void;
  setApiKey(apiKey: string): void;

  register(payload: {
    name: string;
    companyName: string;
    email: string;
    password: string;
  }): Promise<any>;
  login(payload: { email: string; password: string }): Promise<any>;
  refresh(refreshToken: string): Promise<any>;
  logout(): Promise<any>;
  me(): Promise<any>;

  listKeys(): Promise<any>;
  createKey(payload: { name: string; environment?: 'test' | 'live' }): Promise<any>;
  deleteKey(id: string): Promise<any>;

  listAgents(): Promise<any>;
  getAgent(id: string): Promise<any>;
  createAgent(payload: Record<string, unknown>): Promise<any>;
  updateAgent(id: string, payload: Record<string, unknown>): Promise<any>;
  deleteAgent(id: string): Promise<any>;
  listAgentVersions(id: string): Promise<any>;
  rollbackAgent(id: string, versionId: string): Promise<any>;
  testCall(agentId: string, payload: { to_number: string }): Promise<any>;

  listCalls(query?: Record<string, string>): Promise<any>;
  createCall(payload: {
    agent_id: string;
    to_number: string;
    sandbox?: boolean;
  }): Promise<any>;
  getCall(id: string): Promise<any>;
  getTranscript(id: string): Promise<any>;
  getRecording(id: string): Promise<any>;
  transferCall(id: string, target: string | Record<string, string>): Promise<any>;

  searchNumbers(body?: Record<string, unknown>): Promise<any>;
  listNumbers(): Promise<any>;
  createNumber(payload: Record<string, unknown>): Promise<any>;
  updateNumber(id: string, payload: Record<string, unknown>): Promise<any>;
  deleteNumber(id: string): Promise<any>;
  listRoutingRules(numberId: string): Promise<any>;
  createRoutingRules(numberId: string, rules: unknown): Promise<any>;
  updateRoutingRules(numberId: string, ruleId: string, rules: unknown): Promise<any>;
  deleteRoutingRules(numberId: string, ruleId: string): Promise<any>;
  getTransferContext(callId: string): Promise<any>;
  searchKnowledge(query: string, limit?: number): Promise<any>;
  executeTool(
    toolId: string,
    payload?: Record<string, unknown>,
    opts?: { confidence?: number; action_type?: string; call_id?: string },
  ): Promise<any>;
  getWorkflowSettings(): Promise<any>;
  updateWorkflowSettings(settings: Record<string, unknown>): Promise<any>;
}
