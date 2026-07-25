export enum AgentRole {
  GENERAL = 'general',
  SUPPORT = 'support',
  SALES = 'sales',
  COMMANDER = 'commander'
}

export enum CallStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export enum ToolType {
  WEBHOOK = 'webhook',
  API = 'api',
  N8N = 'n8n',
  CONNECTOR = 'connector',
  RPA = 'rpa'
}

export enum IntegrationType {
  CRM = 'crm',
  DATABASE = 'database',
  MESSAGING = 'messaging',
  EXCEL = 'excel',
  GOOGLE_SHEET = 'google_sheet'
}

export interface Company {
  id: string;
  name: string;
  plan: string;
  status: string;
  max_agents: number;
}

export interface Agent {
  id: string;
  company_id: string;
  name: string;
  prompt: string;
  voice_provider: string;
  voice_id: string;
  model_provider: string;
  model_id: string;
}

export interface Team {
  id: string;
  company_id: string;
  name: string;
  type: string;
}

export interface Call {
  id: string;
  company_id: string;
  agent_id: string | null;
  caller_number: string;
  start_time: Date;
  end_time?: Date;
  status: CallStatus;
  turn_count: number;
  recording_url?: string;
}

export interface Tool {
  id: string;
  company_id: string;
  name: string;
  description?: string;
  webhook_url: string;
  method: string;
  type: ToolType;
}

export interface Integration {
  id: string;
  company_id: string;
  type: IntegrationType;
  name: string;
  config: Record<string, any>;
  status: string;
}

export interface KnowledgeSource {
  id: string;
  company_id: string;
  type: string;
  name: string;
  status: string;
  config?: Record<string, any>;
}

export enum KnowledgeSourceType {
  WEBSITE = 'website',
  PDF = 'pdf',
  GOOGLE_DRIVE = 'google_drive',
  NOTION = 'notion',
  TEXT = 'text'
}

export enum PhoneProvider {
  TWILIO = 'twilio',
  VONAGE = 'vonage',
  SIP = 'sip'
}

export enum ChannelType {
  VOICE = 'voice',
  SMS = 'sms',
  WHATSAPP = 'whatsapp',
  TELEGRAM = 'telegram',
  EMAIL = 'email'
}

export enum OpportunityStage {
  PROSPECTING = 'prospecting',
  QUALIFIED = 'qualified',
  PROPOSAL = 'proposal',
  NEGOTIATION = 'negotiation',
  WON = 'won',
  LOST = 'lost'
}

export enum AppointmentStatus {
  SCHEDULED = 'scheduled',
  COMPLETED = 'completed',
  CANCELED = 'canceled',
  NO_SHOW = 'no_show'
}

export interface User {
  id: string;
  company_id: string;
  email: string;
  name: string;
  role: string;
  status: string;
}

export interface PhoneNumber {
  id: string;
  company_id: string;
  number: string;
  provider: PhoneProvider;
  region: string;
  type: ChannelType;
  status: string;
  assigned_to: string | null;
}

export interface Transcript {
  id: string;
  call_id: string;
  speaker: string;
  text: string;
  timestamp: Date;
}

export interface AuditLog {
  id: string;
  company_id: string;
  user_id: string;
  action: string;
  entity: string;
  entity_id?: string;
  timestamp: Date;
  details?: Record<string, any>;
}

export interface UsageMetric {
  id: string;
  company_id: string;
  metric_type: string;
  value: number;
  timestamp: Date;
}

export interface ConnectorRun {
  id: string;
  company_id: string;
  integration_id: string;
  status: string;
  started_at: Date;
  completed_at?: Date;
  logs?: string;
}

export interface KnowledgeDocument {
  id: string;
  source_id: string;
  content: string;
  metadata?: Record<string, any>;
}

export interface CommanderAgent {
  id: string;
  team_id: string;
  prompt: string;
  routing_logic: Record<string, any>;
}

export interface RoutingRule {
  id: string;
  company_id: string;
  name: string;
  condition: Record<string, any>;
  target: string;
  priority: number;
}

export interface CrmContact {
  id: string;
  company_id: string;
  name: string;
  email?: string;
  phone?: string;
  company_name?: string;
}

export interface CrmOpportunity {
  id: string;
  company_id: string;
  contact_id: string;
  title: string;
  value: number;
  stage: OpportunityStage;
}

export interface CrmAppointment {
  id: string;
  company_id: string;
  contact_id: string;
  title: string;
  start_time: Date;
  end_time: Date;
  status: AppointmentStatus;
}

export interface CrmLead {
  id: string;
  company_id: string;
  name: string;
  contact_info: string;
  source: string;
  status: string;
}
