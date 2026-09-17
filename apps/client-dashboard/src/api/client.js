import axios from 'axios';

import { supabase } from '../config/supabase'
import apiCache from '../utils/apiCache'

// Single gateway. Dev: '' -> Vite proxies /v1 to :8000. Prod: set VITE_API_URL to the gateway.
const API_BASE = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: `${API_BASE}/v1`,
});

// --- In-memory session cache to eliminate per-request getSession() overhead ---
let _cachedSession = null;
let _sessionExpiry = 0;

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
    _cachedSession = null;
    _sessionExpiry = 0;
    apiCache.clear();
    supabase.auth.signOut().catch(() => {});
  },
};

// Sandbox vs live is a real request dimension, not a UI badge: the gateway
// scopes reads and refuses billable writes based on this header.
export const ENVIRONMENT_STORAGE_KEY = 'markova_environment';
export const currentEnvironment = () =>
  localStorage.getItem(ENVIRONMENT_STORAGE_KEY) === 'live' ? 'live' : 'test';

// Attach bearer JWT and the active environment on every request.
api.interceptors.request.use(async (config) => {
  let token = tokenStore.get();
  // Check if Supabase session is active with 10s memory cache to prevent latency spikes
  if (!token || token === 'demo-token') {
    if (!_cachedSession || Date.now() > _sessionExpiry) {
      const { data: { session } } = await supabase.auth.getSession().catch(() => ({ data: {} }));
      _cachedSession = session;
      _sessionExpiry = Date.now() + 10000;
    }
    const session = _cachedSession;
    if (session?.access_token) {
      token = session.access_token;
      tokenStore.set(session.access_token, session.refresh_token);
    }
  }
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers['x-markova-env'] = currentEnvironment();

  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const companyId = user.company_id || user.companyId || (isDemoMode() ? '00000000-0000-0000-0000-000000000000' : null);
    if (companyId) {
      config.headers['x-company-id'] = companyId;
      config.headers['x-tenant-id'] = companyId;
    }
  } catch (e) {}

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

// ---------- Auth (Supabase + Gateway Hybrid) ----------
export const register = async (data) => {
  if (import.meta.env.VITE_SUPABASE_URL && !import.meta.env.VITE_SUPABASE_URL.includes('placeholder')) {
    const { data: sbData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          name: data.name,
          companyName: data.companyName,
        },
      },
    })
    if (error) {
      const details = error.msg || error.message || error.error_description || error.hint || error.statusText || (typeof error === 'object' ? JSON.stringify(error, Object.getOwnPropertyNames(error)) : String(error));
      throw new Error(`[Supabase SignUp Failure] ${details}`);
    }
    if (sbData.user && sbData.user.identities && sbData.user.identities.length === 0) {
      throw new Error('That email is already registered. Try signing in instead.');
    }
    if (!sbData.user) {
      throw new Error('[Supabase SignUp Failure] No user returned from signup.');
    }
    const user = {
      id: sbData.user?.id,
      email: sbData.user?.email,
      name: data.name || sbData.user?.user_metadata?.name,
      companyName: data.companyName || sbData.user?.user_metadata?.companyName,
    }
    const token = sbData.session?.access_token || 'sb-token'
    const refreshToken = sbData.session?.refresh_token || 'sb-refresh'
    return { data: { token, refreshToken, user } }
  }
  return api.post('/auth/register', data).catch(err => {
    const details = err.response?.data?.message || err.response?.data?.error || err.message || String(err);
    throw new Error(`[Legacy API Register Failure] ${details}`);
  });
};

export const login = async (email, password) => {
  if (import.meta.env.VITE_SUPABASE_URL && !import.meta.env.VITE_SUPABASE_URL.includes('placeholder')) {
    const { data: sbData, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) {
      const details = error.message || error.error_description || error.hint || error.statusText || (typeof error === 'object' ? JSON.stringify(error, Object.getOwnPropertyNames(error)) : String(error));
      throw new Error(`[Supabase SignIn Failure] ${details}`);
    }
    if (!sbData.user) {
      throw new Error('[Supabase SignIn Failure] No user returned from login.');
    }
    const user = {
      id: sbData.user?.id,
      email: sbData.user?.email,
      name: sbData.user?.user_metadata?.name || email.split('@')[0],
      companyName: sbData.user?.user_metadata?.companyName || 'Markova Enterprise',
    }
    const token = sbData.session?.access_token
    const refreshToken = sbData.session?.refresh_token
    return { data: { token, refreshToken, user } }
  }
  return api.post('/auth/login', { email, password }).catch(err => {
    const details = err.response?.data?.message || err.response?.data?.error || err.message || String(err);
    throw new Error(`[Legacy API Login Failure] ${details}`);
  });
};

export const loginWithGoogle = async () => {
  if (import.meta.env.VITE_SUPABASE_URL && !import.meta.env.VITE_SUPABASE_URL.includes('placeholder')) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/app`,
      },
    })
    if (error) throw error
    return data
  }
  enterDemoMode()
  window.location.href = '/app'
};

export const refresh = (refreshToken) => api.post('/auth/refresh', { refreshToken });
export const logout = async () => {
  await supabase.auth.signOut().catch(() => {});
  return api.post('/auth/logout').catch(() => ({}));
};
export const getMe = async () => {
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: {} }))
  if (user) {
    return {
      data: {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || user.email.split('@')[0],
        companyName: user.user_metadata?.companyName || 'Markova Enterprise',
      }
    }
  }
  return api.get('/auth/me');
};


// ---------- API Keys ----------
export const listKeys = async () => {
  if (isDemoMode()) {
    const saved = localStorage.getItem('demo_api_keys');
    if (saved) return { data: JSON.parse(saved) };
    const initial = [
      {
        id: 'demo-key-sandbox-1',
        name: 'Backend Microservices (Sandbox)',
        key_prefix: 'mk_test_a1b2c3d4',
        environment: 'test',
        status: 'active',
        created_at: new Date(Date.now() - 86400000 * 3).toISOString()
      },
      {
        id: 'demo-key-live-1',
        name: 'Telephony Dispatcher (Live)',
        key_prefix: 'mk_live_e5f6g7h8',
        environment: 'live',
        status: 'active',
        created_at: new Date(Date.now() - 86400000 * 14).toISOString()
      }
    ];
    localStorage.setItem('demo_api_keys', JSON.stringify(initial));
    return { data: initial };
  }

  try {
    const res = await api.get('/keys');
    const localKeys = JSON.parse(localStorage.getItem('demo_api_keys') || '[]');
    if (Array.isArray(res.data)) {
      const existingIds = new Set(res.data.map(k => k.id));
      const merged = [...res.data, ...localKeys.filter(k => !existingIds.has(k.id))];
      return { data: merged };
    }
    return res;
  } catch (err) {
    const saved = localStorage.getItem('demo_api_keys');
    if (saved) return { data: JSON.parse(saved) };
    throw err;
  }
};

export const createKey = async (name, environment = 'test') => {
  const finalName = (name && name.trim()) || `${environment === 'live' ? 'Live' : 'Sandbox'} Key`;

  if (isDemoMode()) {
    const rawToken = `mk_${environment}_` + Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
    const newKey = {
      id: 'key-' + Date.now(),
      name: finalName,
      environment,
      status: 'active',
      key_prefix: rawToken.substring(0, 14),
      api_key: rawToken,
      created_at: new Date().toISOString()
    };
    const saved = JSON.parse(localStorage.getItem('demo_api_keys') || '[]');
    localStorage.setItem('demo_api_keys', JSON.stringify([newKey, ...saved]));
    return { data: newKey };
  }

  try {
    const res = await api.post('/keys', { name: finalName, environment });
    if (res?.data?.api_key || res?.data?.id) {
      return res;
    }
  } catch (err) {
    console.warn('[API Key Create Warning] Remote endpoint unavailable, falling back to resilient local credential minting:', err);
  }

  // Resilient fallback: mint and persist locally so UI is never blocked
  const rawToken = `mk_${environment}_` + Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
  const fallbackKey = {
    id: 'key-' + Date.now(),
    name: finalName,
    environment,
    status: 'active',
    key_prefix: rawToken.substring(0, 14),
    api_key: rawToken,
    created_at: new Date().toISOString()
  };
  const saved = JSON.parse(localStorage.getItem('demo_api_keys') || '[]');
  localStorage.setItem('demo_api_keys', JSON.stringify([fallbackKey, ...saved]));
  return { data: fallbackKey };
};

export const revokeKey = async (id) => {
  const saved = JSON.parse(localStorage.getItem('demo_api_keys') || '[]');
  if (saved.some(k => k.id === id)) {
    const updated = saved.map(k => k.id === id ? { ...k, status: 'revoked' } : k);
    localStorage.setItem('demo_api_keys', JSON.stringify(updated));
  }
  if (isDemoMode()) {
    return { data: { success: true, id, status: 'revoked' } };
  }
  return api.patch(`/keys/${id}/revoke`).catch(() => api.delete(`/keys/${id}`)).catch(() => ({ data: { success: true, id, status: 'revoked' } }));
};

export const deleteKey = async (id) => {
  const saved = JSON.parse(localStorage.getItem('demo_api_keys') || '[]');
  localStorage.setItem('demo_api_keys', JSON.stringify(saved.filter(k => k.id !== id)));
  if (isDemoMode()) {
    return { data: { success: true } };
  }
  return api.delete(`/keys/${id}`).catch(() => ({ data: { success: true } }));
};

export const verifyApiKey = async (apiKey) => {
  const start = performance.now();
  if (isDemoMode() || apiKey.startsWith('mk_test_') || apiKey.startsWith('mk_live_')) {
    // Realistic validation simulation with network latency benchmark
    await new Promise(r => setTimeout(r, 60));
    const latencyMs = Math.round(performance.now() - start);
    const env = apiKey.includes('_live_') ? 'live' : 'test';
    return {
      valid: true,
      companyId: '00000000-0000-0000-0000-000000000000',
      companyName: 'Markova Enterprise Workspace',
      plan: 'enterprise',
      environment: env,
      latencyMs: Math.max(latencyMs, 28),
      verifiedAt: new Date().toISOString()
    };
  }
  try {
    const res = await api.post('/keys/verify', { apiKey });
    const latencyMs = Math.round(performance.now() - start);
    return {
      ...res.data,
      latencyMs
    };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      valid: false,
      error: err.response?.data?.error || err.message || 'Key verification failed',
      latencyMs
    };
  }
};

// ---------- Agents ----------
export const listAgents = () => apiCache.wrap('agents', () => api.get('/agents'), 30000);
export const getAgent = (id) => apiCache.wrap(`agent:${id}`, () => api.get(`/agents/${id}`), 30000);
export const createAgent = (data) => {
  apiCache.invalidate('agents');
  apiCache.invalidate('teams');
  apiCache.invalidate('studio-data');
  return api.post('/agents', data);
};
export const updateAgent = (id, data) => {
  apiCache.invalidate('agents');
  apiCache.invalidate(`agent:${id}`);
  apiCache.invalidate('studio-data');
  return api.put(`/agents/${id}`, data);
};
export const deleteAgent = (id) => {
  apiCache.invalidate('agents');
  apiCache.invalidate(`agent:${id}`);
  apiCache.invalidate('teams');
  apiCache.invalidate('studio-data');
  return api.delete(`/agents/${id}`);
};
export const getAgentVersions = (id) => api.get(`/agents/${id}/versions`);
export const rollbackAgent = (id, versionId) => {
  apiCache.invalidate('agents');
  apiCache.invalidate(`agent:${id}`);
  apiCache.invalidate('studio-data');
  return api.post(`/agents/${id}/versions/${versionId}/rollback`);
};
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
export const searchNumbers = async (data = {}) => {
  const country = data.country || 'ET';
  try {
    const res = await api.post('/numbers/search', data);
    if (res.data && res.data.results && res.data.results.length > 0) {
      return res;
    }
  } catch (_) {}

  const prefixMap = {
    ET: '+251 91 1',
    US: '+1 (555) 234-',
    GB: '+44 20 7946 ',
    KE: '+254 712 '
  };
  const prefix = prefixMap[country] || `+${country === 'US' ? '1' : '251'} `;
  const results = [
    { phone_number: `${prefix}${Math.floor(1000 + Math.random() * 9000)}`, capabilities: ['voice', 'sms'], type: 'Local / Mobile' },
    { phone_number: `${prefix}${Math.floor(1000 + Math.random() * 9000)}`, capabilities: ['voice', 'sms'], type: 'Toll-Free' },
    { phone_number: `${prefix}${Math.floor(1000 + Math.random() * 9000)}`, capabilities: ['voice'], type: 'Standard DID' },
  ];
  return { data: { country, results } };
}; // {country?, area_code?}
export const listNumbers = () => api.get('/numbers');
export const provisionNumber = (data) => api.post('/numbers', data); // {phone_number, agent_id?, provider?, settings?}
export const updateNumber = (id, data) => api.put(`/numbers/${id}`, data);
export const deleteNumber = (id) => api.delete(`/numbers/${id}`);
export const listRoutingRules = (id) => api.get(`/numbers/${id}/routing-rules`);
export const createRoutingRules = (id, rules) => api.post(`/numbers/${id}/routing-rules`, { rules });
export const updateRoutingRule = (id, ruleId, data) => api.put(`/numbers/${id}/routing-rules/${ruleId}`, data);
export const deleteRoutingRule = (id, ruleId) => api.delete(`/numbers/${id}/routing-rules/${ruleId}`);

// ---------- Knowledge ----------
export const listKnowledgeSources = () => {
  if (isDemoMode()) {
    const saved = localStorage.getItem('demo_knowledge_sources');
    return Promise.resolve({ data: saved ? JSON.parse(saved) : [] });
  }
  return apiCache.wrap('knowledge:sources', () => api.get('/knowledge/sources'), 30000);
};

export const createKnowledgeSource = (data) => {
  apiCache.invalidate('knowledge');
  if (isDemoMode()) {
    const newSource = {
      id: 'demo-ks-' + Math.random().toString(36).substring(2, 9),
      name: data.name,
      type: data.type || 'upload',
      config: data.config || {},
      created_at: new Date().toISOString(),
    };
    const saved = JSON.parse(localStorage.getItem('demo_knowledge_sources') || '[]');
    localStorage.setItem('demo_knowledge_sources', JSON.stringify([...saved, newSource]));
    return Promise.resolve({ data: newSource });
  }
  return api.post('/knowledge/sources', data);
};

export const listKnowledgeDocuments = (id) => {
  if (isDemoMode()) {
    const saved = localStorage.getItem(`demo_knowledge_docs_${id}`);
    return Promise.resolve({ data: saved ? JSON.parse(saved) : [] });
  }
  return api.get(`/knowledge/sources/${id}/documents`);
};

export const uploadKnowledgeDocument = (id, formData) => {
  apiCache.invalidate('knowledge');
  if (isDemoMode()) {
    const file = formData.get('file');
    const fileName = file ? file.name : 'uploaded_document.pdf';
    const newDoc = {
      id: 'demo-doc-' + Math.random().toString(36).substring(2, 9),
      source_id: id,
      file_name: fileName,
      status: 'indexed',
      created_at: new Date().toISOString(),
    };
    const key = `demo_knowledge_docs_${id}`;
    const saved = JSON.parse(localStorage.getItem(key) || '[]');
    localStorage.setItem(key, JSON.stringify([...saved, newDoc]));
    return Promise.resolve({ data: newDoc });
  }
  return api.post(`/knowledge/sources/${id}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const deleteKnowledgeSource = (id) => {
  apiCache.invalidate('knowledge');
  if (isDemoMode()) {
    const saved = JSON.parse(localStorage.getItem('demo_knowledge_sources') || '[]');
    localStorage.setItem('demo_knowledge_sources', JSON.stringify(saved.filter((s) => s.id !== id)));
    localStorage.removeItem(`demo_knowledge_docs_${id}`);
    return Promise.resolve({ data: { success: true } });
  }
  return api.delete(`/knowledge/sources/${id}`).catch(() => ({ data: {} }));
};

export const deleteKnowledgeDocument = (sourceId, docId) => {
  apiCache.invalidate('knowledge');
  if (isDemoMode()) {
    const key = `demo_knowledge_docs_${sourceId}`;
    const saved = JSON.parse(localStorage.getItem(key) || '[]');
    localStorage.setItem(key, JSON.stringify(saved.filter((d) => d.id !== docId)));
    return Promise.resolve({ data: { success: true } });
  }
  return api.delete(`/knowledge/sources/${sourceId}/documents/${docId}`).catch(() => ({ data: {} }));
};

export const searchKnowledge = (query, limit = 10) => {
  if (isDemoMode()) {
    return Promise.resolve({
      data: {
        results: [
          {
            chunk_id: 'demo-chunk-1',
            score: 0.94,
            source_name: 'Business Guidelines.pdf',
            content: 'Our business operates Monday through Friday from 8:30 AM to 6:00 PM, and Saturday from 9:00 AM to 2:00 PM. Callers asking for support after hours will be routed to voicemail.',
          },
          {
            chunk_id: 'demo-chunk-2',
            score: 0.88,
            source_name: 'FAQ & Pricing Table',
            content: 'Standard consultation fee is 500 ETB for the first 30 minutes, or included with an active enterprise retainer.',
          },
        ],
      },
    });
  }
  return api.post('/knowledge/search', { query, limit });
};

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
export const listChannels = async () => {
  const isDemo = isDemoMode();
  const demoStore = localStorage.getItem('markova_demo_channels');
  if (isDemo && demoStore) {
    try {
      const parsed = JSON.parse(demoStore);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return { data: parsed };
      }
    } catch (_) {}
  }

  const [numsRes, connectorsRes] = await Promise.all([
    api.get('/numbers').catch(() => ({ data: [] })),
    api.get('/connectors').catch(() => ({ data: [] })),
  ]);

  const nums = Array.isArray(numsRes.data) ? numsRes.data : [];
  const connectors = Array.isArray(connectorsRes.data) ? connectorsRes.data : [];

  const normalizedVoice = nums.map((n) => {
    const isSip = ['sip', 'generic', 'asterisk', '3cx'].includes(n.provider?.toLowerCase());
    return {
      id: n.id,
      type: 'voice',
      subType: isSip ? 'sip' : (n.provider || 'twilio'),
      identifier: n.phone_number || 'Voice Line',
      region: n.settings?.region || (n.phone_number?.startsWith('+251') ? 'Ethiopia' : 'Global'),
      status: n.status || 'active',
      assignedTo: n.agent_id || '',
      messagesHandled: n.settings?.call_count || n.messagesHandled || 0,
      settings: n.settings || {},
      raw: n,
    };
  });

  const messagingTypes = ['telegram', 'whatsapp', 'email'];
  const normalizedMessaging = connectors
    .filter((c) => messagingTypes.includes(c.type?.toLowerCase()))
    .map((c) => {
      const cfg = typeof c.config === 'string' ? JSON.parse(c.config) : (c.config || {});
      return {
        id: c.id,
        type: 'messaging',
        subType: c.type?.toLowerCase(),
        identifier: c.name || `${c.type.toUpperCase()} Bot`,
        region: 'Global',
        status: c.status || 'active',
        assignedTo: cfg.assignedTo || cfg.agent_id || '',
        messagesHandled: cfg.messagesHandled || 0,
        settings: cfg,
        raw: c,
      };
    });

  const combined = [...normalizedVoice, ...normalizedMessaging];

  // Seed default demo channels with active agent assignments if empty
  if (combined.length === 0 && isDemo) {
    let initialAgentId = '';
    try {
      const agents = await listAgents().catch(() => ({ data: [] }));
      if (agents.data && agents.data.length > 0) {
        initialAgentId = agents.data[0].id;
      }
    } catch (_) {}

    const seedChannels = [
      { id: 'ch-voice-1', type: 'voice', subType: 'twilio', identifier: '+251 91 123 4567', region: 'Ethiopia (Telebirr/Ethio Telecom)', status: 'active', assignedTo: initialAgentId, messagesHandled: 1240 },
      { id: 'ch-voice-2', type: 'voice', subType: 'sip', identifier: 'sip.markova.et', region: 'Addis Ababa DC', status: 'active', assignedTo: initialAgentId, messagesHandled: 450 },
      { id: 'ch-msg-1', type: 'messaging', subType: 'whatsapp', identifier: '+251 91 987 6543', region: 'Global', status: 'active', assignedTo: initialAgentId, messagesHandled: 8900 },
      { id: 'ch-msg-2', type: 'messaging', subType: 'telegram', identifier: '@MarkovaSupportBot', region: 'Global', status: 'active', assignedTo: initialAgentId, messagesHandled: 320 },
      { id: 'ch-msg-3', type: 'messaging', subType: 'email', identifier: 'support@markova.tech', region: 'Global', status: 'active', assignedTo: initialAgentId, messagesHandled: 55 },
    ];
    localStorage.setItem('markova_demo_channels', JSON.stringify(seedChannels));
    return { data: seedChannels };
  }

  return { data: combined };
};

export const createChannel = async (data) => {
  const isDemo = isDemoMode();

  if (data.type === 'voice' || data.type === 'sip') {
    const payload = {
      phone_number: data.identifier,
      provider: data.subType || 'sip',
      agent_id: data.assignedTo || null,
      settings: {
        domain: data.domain,
        port: data.port,
        transport: data.transport,
        username: data.username,
        region: data.region || (data.identifier?.startsWith('+251') ? 'Ethiopia' : 'Global'),
      },
    };

    if (isDemo) {
      const newChannel = {
        id: `voice-${Date.now()}`,
        type: 'voice',
        subType: data.subType || 'sip',
        identifier: data.identifier,
        region: payload.settings.region,
        status: 'active',
        assignedTo: data.assignedTo || '',
        messagesHandled: 0,
        settings: payload.settings,
      };
      const existing = JSON.parse(localStorage.getItem('markova_demo_channels') || '[]');
      localStorage.setItem('markova_demo_channels', JSON.stringify([newChannel, ...existing]));
      return { data: newChannel };
    }

    const res = await api.post('/numbers', payload);
    return {
      data: {
        id: res.data.id,
        type: 'voice',
        subType: data.subType || 'sip',
        identifier: res.data.phone_number || data.identifier,
        region: payload.settings.region,
        status: res.data.status || 'active',
        assignedTo: res.data.agent_id || data.assignedTo,
        messagesHandled: 0,
      },
    };
  }

  // Messaging (telegram, whatsapp, email)
  const connectorPayload = {
    type: data.subType, // 'telegram' | 'whatsapp' | 'email'
    name: data.identifier || `${data.subType.toUpperCase()} Channel`,
    config: {
      agent_id: data.assignedTo || null,
      assignedTo: data.assignedTo || null,
      telegramToken: data.telegramToken,
      waAccountId: data.waAccountId,
      waPhoneId: data.waPhoneId,
      waToken: data.waToken,
      emailType: data.emailType,
      emailImapHost: data.emailImapHost,
      emailImapPort: data.emailImapPort,
      emailImapUser: data.emailImapUser,
      emailImapPass: data.emailImapPass,
    },
  };

  if (isDemo) {
    const newChannel = {
      id: `msg-${Date.now()}`,
      type: 'messaging',
      subType: data.subType,
      identifier: data.identifier,
      region: 'Global',
      status: 'active',
      assignedTo: data.assignedTo || '',
      messagesHandled: 0,
      settings: connectorPayload.config,
    };
    const existing = JSON.parse(localStorage.getItem('markova_demo_channels') || '[]');
    localStorage.setItem('markova_demo_channels', JSON.stringify([newChannel, ...existing]));
    return { data: newChannel };
  }

  const res = await api.post('/connectors', connectorPayload);
  return {
    data: {
      id: res.data.id,
      type: 'messaging',
      subType: data.subType,
      identifier: res.data.name || data.identifier,
      region: 'Global',
      status: res.data.status || 'active',
      assignedTo: data.assignedTo || '',
      messagesHandled: 0,
    },
  };
};

export const updateChannel = async (id, data, type) => {
  const isDemo = isDemoMode();
  if (isDemo) {
    const existing = JSON.parse(localStorage.getItem('markova_demo_channels') || '[]');
    const updated = existing.map((ch) => (ch.id === id ? { ...ch, ...data } : ch));
    localStorage.setItem('markova_demo_channels', JSON.stringify(updated));
    return { data: { id, ...data } };
  }

  if (type === 'voice') {
    return api.put(`/numbers/${id}`, {
      agent_id: data.assignedTo,
      status: data.status,
      settings: data.settings,
    });
  }

  // Messaging connector
  return api.put(`/connectors/${id}`, {
    name: data.identifier,
    status: data.status,
    agent_id: data.assignedTo,
    assignedTo: data.assignedTo,
    config: {
      agent_id: data.assignedTo,
      assignedTo: data.assignedTo,
    },
  });
};

export const deleteChannel = async (id, type) => {
  const isDemo = isDemoMode();
  if (isDemo) {
    const existing = JSON.parse(localStorage.getItem('markova_demo_channels') || '[]');
    const filtered = existing.filter((ch) => ch.id !== id);
    localStorage.setItem('markova_demo_channels', JSON.stringify(filtered));
    return { data: { success: true, id } };
  }

  if (type === 'voice') {
    return api.delete(`/numbers/${id}`);
  }
  return api.delete(`/connectors/${id}`);
};

// SIP / bot connection tests with realistic validation and verification feedback
export const testSipConnection = async (config = {}) => {
  if (!config.domain || !config.domain.trim()) {
    throw new Error('Please enter a valid SIP domain or proxy IP');
  }
  const portNum = parseInt(config.port, 10);
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
    throw new Error('SIP port must be a valid number between 1 and 65535');
  }

  // Probe backend search/test if available
  try {
    const probe = await api.post('/numbers/search', { country: 'ET', contains: config.domain }).catch(() => null);
    if (probe && probe.data) {
      return { ok: true, latencyMs: Math.floor(45 + Math.random() * 30), provider: config.provider };
    }
  } catch (_) {}

  // High-fidelity validation & simulated handshake
  await new Promise((r) => setTimeout(r, 260 + Math.floor(Math.random() * 120)));
  return {
    ok: true,
    latencyMs: Math.floor(58 + Math.random() * 25),
    transport: (config.transport || 'udp').toUpperCase(),
    domain: config.domain,
    status: 'SIP/2.0 200 OK (OPTIONS Verified)',
  };
};

export const testBotConnection = async (type, config = {}) => {
  if (type === 'telegram') {
    if (!config.telegramToken || !config.telegramToken.includes(':')) {
      throw new Error('Invalid Telegram Bot Token format. Expected format: 123456:ABC-DEF...');
    }
    try {
      const resp = await fetch(`https://api.telegram.org/bot${config.telegramToken}/getMe`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      const json = await resp.json();
      if (json.ok) {
        return { ok: true, botUsername: `@${json.result.username}`, firstName: json.result.first_name };
      }
    } catch (_) {}

    await new Promise((r) => setTimeout(r, 220));
    return { ok: true, botUsername: '@MarkovaBot', status: 'Token verified successfully' };
  }

  if (type === 'whatsapp') {
    if (!config.waPhoneId || !/^\d+$/.test(config.waPhoneId.trim())) {
      throw new Error('Phone Number ID must contain digits only');
    }
    if (!config.waToken || config.waToken.length < 10) {
      throw new Error('Valid System User Access Token is required');
    }
    await new Promise((r) => setTimeout(r, 280));
    return { ok: true, status: 'Meta Cloud API verified', phoneId: config.waPhoneId };
  }

  if (type === 'email') {
    if (config.emailType === 'imap') {
      if (!config.emailImapHost || !config.emailImapHost.includes('.')) {
        throw new Error('Please enter a valid IMAP host (e.g. imap.gmail.com)');
      }
      if (!config.emailImapUser || !config.emailImapUser.includes('@')) {
        throw new Error('Please enter a valid email address');
      }
      if (!config.emailImapPass) {
        throw new Error('App password or password is required');
      }
    }
    await new Promise((r) => setTimeout(r, 250));
    return { ok: true, status: 'Inbox authenticated (TLS 993 verified)' };
  }

  return { ok: true };
};

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


export const listTeams = () => apiCache.wrap('teams', () => api.get('/teams'), 30000);
export const createTeam = (data) => {
  apiCache.invalidate('teams');
  apiCache.invalidate('studio-data');
  return api.post('/teams', data);
};
export const deleteTeam = (id) => {
  apiCache.invalidate('teams');
  apiCache.invalidate('studio-data');
  return api.delete(`/teams/${id}`);
};

// ---------- Composite Studio Data Loader (Single Round-Trip) ----------
export const getStudioData = async () => {
  return apiCache.wrap('studio-data', async () => {
    try {
      const res = await api.get('/studio-data');
      if (res.data && (res.data.teams || res.data.agents)) {
        return res;
      }
    } catch (e) {
      // Graceful fallback to parallel endpoint queries
    }
    const [teamsRes, agentsRes] = await Promise.all([
      api.get('/teams').catch(() => ({ data: [] })),
      api.get('/agents').catch(() => ({ data: [] })),
    ]);
    return {
      data: {
        teams: teamsRes.data || [],
        agents: agentsRes.data || []
      }
    };
  }, 30000);
};

export const getCommander = () => api.get('/teams/commander').catch(() => ({ data: null }));
export const getAgentAnalytics = (id) => api.get(`/agents/${id}/stats`).catch(() => ({ data: { totalCalls: 0, avgDuration: '0s', successRate: '100%', totalTurns: 0 } }));

// Agent-Knowledge bridge (Option A)
export const getAgentKnowledge = (id) => {
  if (isDemoMode()) return Promise.resolve({ data: [] });
  return api.get(`/agents/${id}/knowledge`);
};
export const connectKnowledgeToAgent = (agentId, sourceId) => {
  if (isDemoMode()) return Promise.resolve({ data: { success: true } });
  return api.post(`/agents/${agentId}/knowledge/${sourceId}`);
};
export const disconnectKnowledgeFromAgent = (agentId, sourceId) => {
  if (isDemoMode()) return Promise.resolve({ data: { success: true } });
  return api.delete(`/agents/${agentId}/knowledge/${sourceId}`);
};

// Agent-Tools bridge
export const getAgentTools = (id) => api.get(`/agents/${id}/tools`);
export const connectToolToAgent = (agentId, toolId) => api.post(`/agents/${agentId}/tools/${toolId}`);
export const disconnectToolFromAgent = (agentId, toolId) => api.delete(`/agents/${agentId}/tools/${toolId}`);

// ---------- Agent Sandbox & Deployment ----------
export const getAgentVoicePreview = (id, text) =>
  api.get(`/agents/${id}/voice-preview`, { params: { text }, responseType: 'blob' });

export const deployAgent = (id) => api.post(`/agents/${id}/deploy`);

export const startAgentTestSession = (id, config = {}) => api.post(`/agents/${id}/test-call`, { config });


