// Data service — reads from the real Markova gateway (/v1) via the shared api client.
// No mock data and no hardcoded keys: every call is a real, authenticated request.
import { listCalls, listAgents, getCall, getUsage } from '../api/client';

// Normalize a Call (openapi Call schema) into the shape the dashboard tables expect.
const normalizeCall = (call) => ({
  ...call,
  date: call.start_time,
  caller: call.caller_number,
  agent: call.agent_name,
});

class UnifiedDataService {
  constructor() {
    this.isUsingRealData = true;
    this.realTimeCallbacks = new Map();
  }

  async fetchCalls(params = {}) {
    const { data } = await listCalls(params);
    return (data || []).map(normalizeCall);
  }

  // NOTE: /v1 exposes only period usage (call_minutes, stt_seconds, tts_characters,
  // llm_tokens). Granular analytics (response times, satisfaction, resolution) has no
  // backend endpoint — reported as a mismatch. We surface real usage and leave the rest null.
  async fetchAnalytics() {
    const { data } = await getUsage();
    return {
      usage: data,
      callVolume: null,
      responseTimes: null,
      userExperience: null,
      resolution: null,
    };
  }

  // No activity-log endpoint in the /v1 contract — reported as a mismatch.
  async fetchLogs() {
    return [];
  }

  async fetchAgents() {
    const { data } = await listAgents();
    return data || [];
  }

  async fetchCallDetails(callId) {
    const { data } = await getCall(callId);
    return normalizeCall(data);
  }

  switchToRealData() {
    this.isUsingRealData = true;
  }

  onDataUpdate(type, callback) {
    if (!this.realTimeCallbacks.has(type)) this.realTimeCallbacks.set(type, []);
    this.realTimeCallbacks.get(type).push(callback);
  }

  emitUpdate(type, data) {
    if (this.realTimeCallbacks.has(type)) {
      this.realTimeCallbacks.get(type).forEach((cb) => cb(data));
    }
  }

  getStatus() {
    return { isUsingRealData: this.isUsingRealData };
  }

  get isRealData() {
    return this.isUsingRealData;
  }
}

const unifiedDataService = new UnifiedDataService();
export default unifiedDataService;
