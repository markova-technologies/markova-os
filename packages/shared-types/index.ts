export interface Company {
  id: string;
  name: string;
  plan: string;
  maxAgents: number;
}

export interface Agent {
  id: string;
  name: string;
  prompt: string;
  voiceProvider: string;
  modelProvider: string;
}

export interface Team {
  id: string;
  name: string;
  type: string;
}
