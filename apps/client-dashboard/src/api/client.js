import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

// Inject auth token from localStorage on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const login = (email, password) =>
  api.post('/auth/login', { email, password });

export const register = (data) =>
  api.post('/auth/register', data);

// Teams
export const listTeams = () => api.get('/builder/teams');
export const createTeam = (data) => api.post('/builder/teams', data);
export const getCommander = (teamId) => api.get(`/builder/teams/${teamId}/commander`);

// Agents
export const listAgents = () => api.get('/builder/agents');
export const getAgent = (id) => api.get(`/builder/agents/${id}`);
export const createAgent = (data) => api.post('/builder/agents', data);
export const updateAgent = (id, data) => api.put(`/builder/agents/${id}`, data);
export const deleteAgent = (id) => api.delete(`/builder/agents/${id}`);
export const getAgentVersions = (id) => api.get(`/builder/agents/${id}/versions`);
export const rollbackAgent = (id, versionId) =>
  api.post(`/builder/agents/${id}/rollback/${versionId}`);

// Tools
export const listTools = (agentId) => api.get('/tools', { params: { agentId } });
export const createTool = (data) => api.post('/tools', data);
export const updateTool = (id, data) => api.put(`/tools/${id}`, data);
export const deleteTool = (id) => api.delete(`/tools/${id}`);

// Connector Hub
export const listConnectorTypes = () => api.get('/connectors/types');
export const listIntegrations = () => api.get('/connectors/integrations');
export const createIntegration = (data) => api.post('/connectors/integrations', data);
export const deleteIntegration = (id) => api.delete(`/connectors/integrations/${id}`);
export const previewIntegration = (id) => api.get(`/connectors/integrations/${id}/preview`);
export const uploadFile = (id, formData) =>
  api.post(`/connectors/integrations/${id}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

// Knowledge Center
export const listKnowledgeSources = (scope, teamId) => api.get('/knowledge/sources', { params: { scope, teamId } });
export const createKnowledgeSource = (data) => api.post('/knowledge/sources', data);

// Phone Numbers, Channels & Routing
export const listPhoneNumbers = () => api.get('/tenant/phone-numbers');
export const createPhoneNumber = (data) => api.post('/tenant/phone-numbers', data);
export const updatePhoneNumber = (id, data) => api.put(`/tenant/phone-numbers/${id}`, data);

export const listChannels = () => api.get('/tenant/channels');
export const createChannel = (data) => api.post('/tenant/channels', data);
export const updateChannel = (id, data) => api.put(`/tenant/channels/${id}`, data);
export const deleteChannel = (id) => api.delete(`/tenant/channels/${id}`);

export const testSipConnection = (data) => api.post('/tenant/channels/sip/test', data);
export const testBotConnection = (type, data) => api.post(`/tenant/channels/bot/${type}/test`, data);

// Pipelines (Flow Builder)
export const listPipelines = () => api.get('/builder/pipelines');
export const createPipeline = (data) => api.post('/builder/pipelines', data);
export const updatePipeline = (id, data) => api.put(`/builder/pipelines/${id}`, data);
export const deletePipeline = (id) => api.delete(`/builder/pipelines/${id}`);

// CRM
export const listContacts = () => api.get('/crm/contacts');
export const listOpportunities = () => api.get('/crm/opportunities');
export const listAppointments = () => api.get('/crm/appointments');
export const listLeads = () => api.get('/crm/leads');

// Analytics
export const getAgentAnalytics = () => api.get('/tenant/analytics/agents');
export const getTeamAnalytics = () => api.get('/tenant/analytics/teams');
export const getCallAnalytics = () => api.get('/tenant/analytics/calls');
export const getBusinessAnalytics = () => api.get('/tenant/analytics/business');
export const getCostAnalytics = () => api.get('/tenant/analytics/costs');
export const getUsageAnalytics = () => api.get('/tenant/analytics/usage');

// Calls & Stats
export const listCalls = () => api.get('/orchestrator/calls');
export const getCallTranscript = (id) => api.get(`/orchestrator/calls/${id}/transcript`);
export const getStats = () => api.get('/tenant/stats');

export default api;
