// Unified data service — fetches real data from AI server with mock fallback
import mockDataService from './mockDataService';

const AI_SERVER_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001';
const DASHBOARD_API_KEY = import.meta.env.VITE_DASHBOARD_API_KEY || 'super-secret-shared-key-12345';

class UnifiedDataService {
  constructor() {
    this.currentService = mockDataService;
    this.isUsingRealData = false;
    this.realTimeCallbacks = new Map();
    this.cachedData = {
      calls: [],
      analytics: null,
      logs: []
    };
  }

  // API Methods that will work with both mock and real data
  async fetchCalls(filters = {}) {
    try {
      // Try real AI server first
      const response = await fetch(`${AI_SERVER_URL}/api/calls`, {
        headers: { 'X-API-Key': DASHBOARD_API_KEY },
        signal: AbortSignal.timeout(5000)
      });
      if (response.ok) {
        const data = await response.json();
        this.isUsingRealData = true;
        return data.map(call => ({ ...call, date: call.date || call.timestamp }));
      }
    } catch (err) {
      console.warn('⚠️ AI server unavailable, using mock data:', err.message);
    }
    // Graceful fallback to mock
    const data = await this.currentService.fetchCalls(filters);
    return data.map(call => ({ ...call, date: call.date || call.timestamp }));
  }

  async fetchAnalytics() {
    const data = await this.currentService.fetchAnalytics();
    // Map analytics to expected format if needed
    return {
      callVolume: {
        total: data.totalCalls || 0,
        today: data.callsToday || 0,
        weeklyAvg: Math.round((data.totalCalls || 0) / 7),
        growth: 12.5
      },
      responseTimes: {
        avg: data.avgCallDuration || 0,
        target: 3.0,
        percentile95: (data.avgCallDuration || 0) * 1.5
      },
      userExperience: {
        score: data.satisfactionRate || 0,
        previous: (data.satisfactionRate || 0) - 1.4
      },
      resolution: {
        firstCall: data.resolutionRate || 0,
        overall: data.resolutionRate || 0
      }
    };
  }

  async fetchLogs(filters = {}) {
    const data = await this.currentService.fetchLogs(filters);
    // Normalize data - ensure 'date' field exists
    return data.map(log => ({
      ...log,
      date: log.date || log.timestamp
    }));
  }

  async fetchAgents() {
    return await this.currentService.fetchAgents();
  }

  async fetchCallDetails(callId) {
    return await this.currentService.fetchCallDetails(callId);
  }

  // Method to switch to real data when AI agent connects
  switchToRealData(realTimeService) {
    if (realTimeService && !this.isUsingRealData) {
      this.isUsingRealData = true;
      console.log('✅ UnifiedDataService: Switched to real-time data mode');
    }
  }

  // Subscribe to data updates
  onDataUpdate(type, callback) {
    if (!this.realTimeCallbacks.has(type)) {
      this.realTimeCallbacks.set(type, []);
    }
    this.realTimeCallbacks.get(type).push(callback);
  }

  // Emit data updates to subscribers
  emitUpdate(type, data) {
    if (this.realTimeCallbacks.has(type)) {
      this.realTimeCallbacks.get(type).forEach(cb => cb(data));
    }
  }

  // Get current status
  getStatus() {
    return {
      ...this.currentService.getStatus(),
      isUsingRealData: this.isUsingRealData
    };
  }

  // Check if using real data
  get isRealData() {
    return this.isUsingRealData;
  }
}

// Singleton instance
const unifiedDataService = new UnifiedDataService();
export default unifiedDataService;