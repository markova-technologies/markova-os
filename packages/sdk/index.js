/**
 * @markova/sdk — minimal Node client for Markova v1 API.
 * Auth: Bearer JWT and/or x-api-key.
 */

class MarkovaError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = 'MarkovaError';
    this.status = status;
    this.body = body;
  }
}

class Markova {
  /**
   * @param {object} opts
   * @param {string} [opts.baseUrl='http://localhost:8000']
   * @param {string} [opts.apiKey] - mk_test_* or mk_live_*
   * @param {string} [opts.token] - JWT access token
   */
  constructor({ baseUrl = 'http://localhost:8000', apiKey, token } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
    this.token = token;
  }

  setToken(token) {
    this.token = token;
  }

  setApiKey(apiKey) {
    this.apiKey = apiKey;
  }

  async request(method, path, { body, formData, headers = {} } = {}) {
    const url = `${this.baseUrl}${path}`;
    const h = { ...headers };
    if (this.token) h.Authorization = `Bearer ${this.token}`;
    if (this.apiKey) h['x-api-key'] = this.apiKey;

    let payload;
    if (formData) {
      payload = formData;
    } else if (body !== undefined) {
      h['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }

    const res = await fetch(url, { method, headers: h, body: payload });
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!res.ok) {
      const msg = (data && data.error) || (data && data.detail) || res.statusText;
      throw new MarkovaError(msg, { status: res.status, body: data });
    }
    return data;
  }

  // ── Auth ─────────────────────────────────────────────────────────────────
  register(payload) {
    return this.request('POST', '/v1/auth/register', { body: payload });
  }

  async login({ email, password }) {
    const data = await this.request('POST', '/v1/auth/login', {
      body: { email, password },
    });
    if (data.token) this.token = data.token;
    return data;
  }

  refresh(refreshToken) {
    return this.request('POST', '/v1/auth/refresh', { body: { refreshToken } });
  }

  logout() {
    return this.request('POST', '/v1/auth/logout');
  }

  me() {
    return this.request('GET', '/v1/auth/me');
  }

  // ── Keys ─────────────────────────────────────────────────────────────────
  listKeys() {
    return this.request('GET', '/v1/keys');
  }

  createKey({ name, environment = 'test' }) {
    return this.request('POST', '/v1/keys', { body: { name, environment } });
  }

  deleteKey(id) {
    return this.request('DELETE', `/v1/keys/${id}`);
  }

  // ── Agents ───────────────────────────────────────────────────────────────
  listAgents() {
    return this.request('GET', '/v1/agents');
  }

  getAgent(id) {
    return this.request('GET', `/v1/agents/${id}`);
  }

  createAgent(payload) {
    return this.request('POST', '/v1/agents', { body: payload });
  }

  updateAgent(id, payload) {
    return this.request('PUT', `/v1/agents/${id}`, { body: payload });
  }

  deleteAgent(id) {
    return this.request('DELETE', `/v1/agents/${id}`);
  }

  listAgentVersions(id) {
    return this.request('GET', `/v1/agents/${id}/versions`);
  }

  rollbackAgent(id, versionId) {
    return this.request('POST', `/v1/agents/${id}/versions/${versionId}/rollback`);
  }

  testCall(agentId, { to_number }) {
    return this.request('POST', `/v1/agents/${agentId}/test-call`, {
      body: { to_number },
    });
  }

  // ── Calls ────────────────────────────────────────────────────────────────
  listCalls(query = {}) {
    const qs = new URLSearchParams(query).toString();
    return this.request('GET', `/v1/calls${qs ? `?${qs}` : ''}`);
  }

  createCall({ agent_id, to_number, sandbox }) {
    return this.request('POST', '/v1/calls', {
      body: { agent_id, to_number, sandbox },
    });
  }

  getCall(id) {
    return this.request('GET', `/v1/calls/${id}`);
  }

  getTranscript(id) {
    return this.request('GET', `/v1/calls/${id}/transcript`);
  }

  getRecording(id) {
    return this.request('GET', `/v1/calls/${id}/recording`);
  }

  transferCall(id, target) {
    return this.request('POST', `/v1/calls/${id}/transfer`, {
      body: typeof target === 'string' ? { to: target } : target,
    });
  }

  // ── Numbers ──────────────────────────────────────────────────────────────
  searchNumbers(body = {}) {
    return this.request('POST', '/v1/numbers/search', { body });
  }

  listNumbers() {
    return this.request('GET', '/v1/numbers');
  }

  createNumber(payload) {
    return this.request('POST', '/v1/numbers', { body: payload });
  }

  updateNumber(id, payload) {
    return this.request('PUT', `/v1/numbers/${id}`, { body: payload });
  }

  deleteNumber(id) {
    return this.request('DELETE', `/v1/numbers/${id}`);
  }

  listRoutingRules(numberId) {
    return this.request('GET', `/v1/numbers/${numberId}/routing-rules`);
  }

  createRoutingRules(numberId, rules) {
    return this.request('POST', `/v1/numbers/${numberId}/routing-rules`, {
      body: Array.isArray(rules) ? { rules } : rules,
    });
  }

  updateRoutingRules(numberId, ruleId, rules) {
    return this.request('PUT', `/v1/numbers/${numberId}/routing-rules/${ruleId}`, {
      body: Array.isArray(rules) ? { rules } : rules,
    });
  }

  deleteRoutingRules(numberId, ruleId) {
    return this.request('DELETE', `/v1/numbers/${numberId}/routing-rules/${ruleId}`);
  }

  getTransferContext(callId) {
    return this.request('GET', `/v1/calls/${callId}/transfer-context`);
  }

  searchKnowledge(query, limit = 5) {
    return this.request('POST', '/v1/knowledge/search', { body: { query, limit } });
  }

  executeTool(toolId, payload = {}, { confidence, action_type, call_id } = {}) {
    return this.request('POST', `/v1/tools/${toolId}/execute`, {
      body: { ...payload, confidence, action_type, call_id },
    });
  }

  getWorkflowSettings() {
    return this.request('GET', '/v1/workflow-settings');
  }

  updateWorkflowSettings(settings) {
    return this.request('PUT', '/v1/workflow-settings', { body: settings });
  }
}

module.exports = { Markova, MarkovaError };
