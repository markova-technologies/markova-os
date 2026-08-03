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

// ─────────────────────────────────────────────────────────────────────────────
// NEXT-GEN DOMAIN OBJECTS & ENUMS (Phase 1 Domain Expansion)
// ─────────────────────────────────────────────────────────────────────────────

export enum AdminRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  PLATFORM_ADMIN = 'PLATFORM_ADMIN',
  SUPPORT_ADMIN = 'SUPPORT_ADMIN',
  BILLING_ADMIN = 'BILLING_ADMIN',
  DEVELOPER = 'DEVELOPER'
}

export enum MemoryLayerType {
  WORKING = 'working',
  CONVERSATION = 'conversation',
  LONG_TERM = 'long_term',
  BUSINESS = 'business',
  SEMANTIC = 'semantic',
  SHARED_TEAM = 'shared_team'
}

export interface MemoryRecord {
  id: string;
  company_id: string;
  layer: MemoryLayerType;
  entity_id?: string;
  key: string;
  value: Record<string, any>;
  embedding?: number[];
  ttl?: number;
  created_at: Date;
  updated_at: Date;
}

export enum CapabilityType {
  TOOL = 'tool',
  INTEGRATION = 'integration',
  WORKFLOW = 'workflow',
  API = 'api',
  RPA = 'rpa'
}

export enum CapabilityStatus {
  ACTIVE = 'active',
  DEPRECATED = 'deprecated',
  DISABLED = 'disabled'
}

export interface Capability {
  id: string;
  company_id: string;
  name: string;
  description: string;
  type: CapabilityType;
  version: string;
  schema: Record<string, any>;
  permissions: string[];
  status: CapabilityStatus;
  created_at: Date;
}

export enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  AWAITING_APPROVAL = 'awaiting_approval'
}

export interface Execution {
  id: string;
  company_id: string;
  workflow_id?: string;
  agent_id?: string;
  status: ExecutionStatus;
  input: Record<string, any>;
  output?: Record<string, any>;
  error?: string;
  started_at: Date;
  completed_at?: Date;
}

export interface Approval {
  id: string;
  execution_id: string;
  company_id: string;
  action: string;
  requested_by: string;
  approved_by?: string;
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
  created_at: Date;
}

export interface Policy {
  id: string;
  company_id: string;
  name: string;
  rules: Record<string, any>[];
  is_enabled: boolean;
}

export enum DomainEventType {
  AGENT_CREATED = 'AgentCreated',
  CONVERSATION_STARTED = 'ConversationStarted',
  TOOL_EXECUTED = 'ToolExecuted',
  MEMORY_STORED = 'MemoryStored',
  KNOWLEDGE_INDEXED = 'KnowledgeIndexed',
  WORKFLOW_COMPLETED = 'WorkflowCompleted',
  PAYMENT_SUCCEEDED = 'PaymentSucceeded',
  TENANT_CREATED = 'TenantCreated'
}

export interface DomainEvent<T = any> {
  id: string;
  type: DomainEventType;
  tenant_id: string;
  payload: T;
  timestamp: Date;
  version: string;
}

