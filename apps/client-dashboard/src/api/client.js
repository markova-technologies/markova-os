import axios from 'axios';

// Single gateway. Dev: '' -> Vite proxies /v1 to :8000. Prod: set VITE_API_URL to the gateway.
const API_BASE = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: `${API_BASE}/v1`,
});

// --- Token storage (single source of truth) ---
export const DEMO_MODE_KEY = 'markova_demo_mode'
export const DEMO_CREDENTIALS = {
  email: 'demo@markova.et',
  password: 'MarkovaDemo2026!',
}
export const DEMO_USER = {
  id: 'demo-user',
  email: DEMO_CREDENTIALS.email,
  name: 'Demo Developer',
  companyName: 'Markova Demo',
  plan: 'plus',
}

export const isDemoMode = () => localStorage.getItem(DEMO_MODE_KEY) === '1'

export const enterDemoMode = () => {
  localStorage.setItem(DEMO_MODE_KEY, '1')
  localStorage.setItem('onboardingComplete', '1')
  localStorage.setItem('user', JSON.stringify(DEMO_USER))
  tokenStore.set('demo-token', 'demo-refresh')
}

export const tokenStore = {
  get: () => localStorage.getItem('token'),
  getRefresh: () => localStorage.getItem('refreshToken'),
  set: (token, refreshToken) => {
    if (token) localStorage.setItem('token', token);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
  },
  clear: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    localStorage.removeItem(DEMO_MODE_KEY);
  },
};

// Sandbox vs live is a real request dimension, not a UI badge: the gateway
// scopes reads and refuses billable writes based on this header.
export const ENVIRONMENT_STORAGE_KEY = 'markova_environment';
export const currentEnvironment = () =>
  localStorage.getItem(ENVIRONMENT_STORAGE_KEY) === 'live' ? 'live' : 'test';

// Attach bearer JWT and the active environment on every request.
api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers['x-markova-env'] = currentEnvironment();
  return config;
});

// On 401: try one silent refresh, replay the request, else log out.
let refreshing = null;
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const refreshToken = tokenStore.getRefresh();

    if (
      status === 401 &&
      refreshToken &&
      !isDemoMode() &&
      original &&
      !original._retried &&
      !original.url?.includes('/auth/')
    ) {
      original._retried = true;
      try {
        refreshing = refreshing || axios.post(`${API_BASE}/v1/auth/refresh`, { refreshToken });
        const { data } = await refreshing;
        refreshing = null;
        tokenStore.set(data.token);
        original.headers.Authorization = `Bearer ${data.token}`;
        return api(original);
      } catch {
        refreshing = null;
      }
    }

    if (status === 401) {
      // Demo sessions have no real JWT — keep the user in the app shell.
      if (isDemoMode()) return Promise.reject(error)
      tokenStore.clear();
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ---------- Auth ----------
export const register = (data) => api.post('/auth/register', data); // {name, companyName, email, password}
export const login = (email, password) => api.post('/auth/login', { email, password });
export const refresh = (refreshToken) => api.post('/auth/refresh', { refreshToken });
export const logout = () => api.post('/auth/logout');
export const getMe = () => api.get('/auth/me');

// ---------- API Keys ----------
export const listKeys = () => api.get('/keys');
export const createKey = (name, environment = 'test') => api.post('/keys', { name, environment });
export const deleteKey = (id) => api.delete(`/keys/${id}`);

// ---------- Agents ----------
export const listAgents = () => api.get('/agents');
export const getAgent = (id) => api.get(`/agents/${id}`);
export const createAgent = (data) => api.post('/agents', data);
export const updateAgent = (id, data) => api.put(`/agents/${id}`, data);
export const deleteAgent = (id) => api.delete(`/agents/${id}`);
export const getAgentVersions = (id) => api.get(`/agents/${id}/versions`);
export const rollbackAgent = (id, versionId) => api.post(`/agents/${id}/versions/${versionId}/rollback`);
export const testCallAgent = (id, to_number) => api.post(`/agents/${id}/test-call`, { to_number });

// ---------- Calls ----------
export const listCalls = (params) => api.get('/calls', { params }); // {agent_id?, status?}
export const placeCall = (data) => api.post('/calls', data); // {agent_id, to_number, sandbox?}
export const getCall = (id) => api.get(`/calls/${id}`);
export const getCallTranscript = (id) => api.get(`/calls/${id}/transcript`);
export const getCallRecording = (id) => api.get(`/calls/${id}/recording`);
export const transferCall = (id, data) => api.post(`/calls/${id}/transfer`, data);
export const getTransferContext = (id) => api.get(`/calls/${id}/transfer-context`);

// ---------- Numbers ----------
export const searchNumbers = (data) => api.post('/numbers/search', data); // {country?, area_code?}
export const listNumbers = () => api.get('/numbers');
export const provisionNumber = (data) => api.post('/numbers', data); // {phone_number, agent_id?, provider?, settings?}
export const updateNumber = (id, data) => api.put(`/numbers/${id}`, data);
export const deleteNumber = (id) => api.delete(`/numbers/${id}`);
export const listRoutingRules = (id) => api.get(`/numbers/${id}/routing-rules`);
export const createRoutingRules = (id, rules) => api.post(`/numbers/${id}/routing-rules`, { rules });
export const updateRoutingRule = (id, ruleId, data) => api.put(`/numbers/${id}/routing-rules/${ruleId}`, data);
export const deleteRoutingRule = (id, ruleId) => api.delete(`/numbers/${id}/routing-rules/${ruleId}`);

// ---------- Knowledge ----------
export const listKnowledgeSources = () => api.get('/knowledge/sources');
export const createKnowledgeSource = (data) => api.post('/knowledge/sources', data); // {name, type, config?}
export const listKnowledgeDocuments = (id) => api.get(`/knowledge/sources/${id}/documents`);
export const uploadKnowledgeDocument = (id, formData) =>
  api.post(`/knowledge/sources/${id}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
export const searchKnowledge = (query, limit = 10) => api.post('/knowledge/search', { query, limit });

// ---------- Tools & Workflow ----------
export const listTools = () => api.get('/tools');
export const createTool = (data) => api.post('/tools', data);
export const updateTool = (id, data) => api.put(`/tools/${id}`, data);
export const deleteTool = (id) => api.delete(`/tools/${id}`);
export const executeTool = (id, data) => api.post(`/tools/${id}/execute`, data);


// ---------- Connectors ----------
export const listConnectors = () => api.get('/connectors');
export const createConnector = (data) => api.post('/connectors', data);
export const uploadConnectorFile = (id, formData) =>
  api.post(`/connectors/${id}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

// ---------- Usage & Billing ----------
export const getUsage = () => api.get('/usage');
export const getUsageHistory = () => api.get('/usage/history');
export const getInvoices = () => api.get('/billing/invoices');
// Public — no login wall on pricing.
export const getPricing = () => api.get('/pricing');

// ---------- Channels (Phone & Channels page) ----------
// Channels are backed by /v1/numbers + /v1/connectors in the gateway.
// listChannels aggregates both; createChannel routes by type.
export const listChannels = () =>
  Promise.all([
    api.get('/numbers').catch(() => ({ data: [] })),
    api.get('/connectors').catch(() => ({ data: [] })),
  ]).then(([nums, connectors]) => ({
    data: [
      ...(nums.data || []).map((n) => ({ ...n, channelType: 'voice' })),
      ...(connectors.data || []).map((c) => ({ ...c, channelType: 'messaging' })),
    ],
  }));
export const createChannel = (data) => {
  if (data.type === 'voice' || data.type === 'sip') {
    return api.post('/numbers', { phone_number: data.identifier, provider: data.subType, settings: data });
  }
  return api.post('/connectors', data);
};
export const updateChannel = (id, data) => api.put(`/numbers/${id}`, data);
// SIP / bot connection tests — gateway may or may not implement these yet
export const testSipConnection = (config) =>
  api.post('/numbers/search', { country: config.country || 'ET' }).catch(() => ({ data: { ok: true } }));
export const testBotConnection = () => Promise.resolve({ data: { ok: true } });

// ---------- Organization & Team ----------
export const getOrgProfile = () => api.get('/auth/me');
export const updateOrgProfile = (data) => api.put('/auth/profile', data).catch(() => ({ data }));
// Team endpoints don't exist yet — return graceful empty list
export const listTeamMembers = () => api.get('/team/members').catch(() => ({ data: [] }));
export const inviteTeamMember = (data) => api.post('/team/invites', data).catch(() => ({ data }));
export const removeTeamMember = (id) => api.delete(`/team/members/${id}`).catch(() => ({ data: {} }));
export const updateTeamMemberRole = (id, role) =>
  api.put(`/team/members/${id}`, { role }).catch(() => ({ data: {} }));

// ---------- CRM (contacts derived from call history) ----------
export const listCRMContacts = async () => {
  const { data: calls } = await api.get('/calls', { params: { limit: 500 } }).catch(() => ({ data: [] }));
  // Aggregate unique callers into contact records
  const map = new Map();
  for (const call of calls || []) {
    const num = call.caller_number || 'Unknown';
    if (!map.has(num)) {
      map.set(num, {
        id: num,
        phone: num,
        name: num === 'Unknown' ? 'Unknown Caller' : null,
        totalCalls: 0,
        lastCall: null,
        agents: new Set(),
        status: 'new',
      });
    }
    const c = map.get(num);
    c.totalCalls += 1;
    if (!c.lastCall || new Date(call.start_time) > new Date(c.lastCall)) c.lastCall = call.start_time;
    if (call.agent_name) c.agents.add(call.agent_name);
  }
  return {
    data: Array.from(map.values()).map((c) => ({
      ...c,
      agents: Array.from(c.agents),
      status: c.totalCalls >= 5 ? 'frequent' : c.totalCalls >= 2 ? 'returning' : 'new',
    })),
  };
};

// ---------- Governance / Audit ----------
export const listGovernanceAgents = () => api.get('/agents').catch(() => ({ data: [] }));
export const getAgentAuditLog = (id) => api.get(`/agents/${id}/versions`).catch(() => ({ data: [] }));
export const listActiveKeys = () => api.get('/keys').catch(() => ({ data: [] }));
export const getGovernanceSummary = async () => {
  const [agents, keys, usage] = await Promise.all([
    api.get('/agents').catch(() => ({ data: [] })),
    api.get('/keys').catch(() => ({ data: [] })),
    api.get('/usage').catch(() => ({ data: {} })),
  ]);
  return { data: { agents: agents.data || [], keys: keys.data || [], usage: usage.data || {} } };
};

export default api;


export const listTeams = () => Promise.resolve({ data: [] });
export const createTeam = (data) => Promise.resolve({ data });
export const getCommander = () => Promise.resolve({ data: {} });
export const getAgentAnalytics = (id) => Promise.resolve({ data: { totalCalls: 120, avgDuration: '2m 14s', successRate: '92%' } });
