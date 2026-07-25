// Mock data service for dashboard - will be replaced with real data when AI agent connects
class MockDataService {
  constructor() {
    this.isUsingRealData = false;
    this.mockData = {
      calls: [
        {
          id: 999,
          timestamp: new Date(),
          duration: 5,
          agent: 'AI Agent 1 (Amharic)',
          customer: 'Abebe Bikila',
          type: 'voice',
          status: 'completed',
          size: '3.1 MB',
          transcript: [
            { speaker: 'customer', text: 'ሰላም፣ ስለ አዲሱ የሞባይል ባንኪንግ አገልግሎት መጠየቅ ፈልጌ ነበር።' },
            { speaker: 'agent', text: 'ሰላም! ደስ ብሎን እናስተናግዶታለን። ስለ የትኛው አገልግሎት ነው ማወቅ የፈለጉት?' },
            { speaker: 'customer', text: 'ገንዘብ እንዴት ማስተላለፍ እንደምችል ንገረኝ።' },
            { speaker: 'agent', text: 'በመተግበሪያው ላይ "Send Money" የሚለውን በመጫን መቀጠል ይችላሉ።' }
          ],
          summary: 'Amharic inquiry about mobile banking features. Customer asked about money transfer.'
        },
        {
          id: 1,
          timestamp: new Date(),
          duration: 12,
          agent: 'AI Agent 1',
          customer: 'John Doe',
          type: 'voice',
          status: 'completed',
          size: '2.4 MB',
          transcript: [
            { speaker: 'customer', text: 'Hi, I want to know about your pricing plans' },
            { speaker: 'agent', text: 'Hello! I can help you with that. We have three plans...' },
            { speaker: 'customer', text: 'Which one would you recommend for a small business?' },
            { speaker: 'agent', text: 'For a small business, I would recommend our Pro plan...' }
          ],
          summary: 'Product inquiry about pricing and features. Customer showed interest in Pro plan for small business needs.'
        },
        {
          id: 2,
          timestamp: new Date(Date.now() - 86400000),
          duration: 8,
          agent: 'AI Agent 2',
          customer: 'Jane Smith',
          type: 'voice',
          status: 'completed',
          size: '1.8 MB',
          transcript: [
            { speaker: 'customer', text: 'I need help setting up my account' },
            { speaker: 'agent', text: 'I understand. Let me guide you through the process...' }
          ],
          summary: 'Technical support request for account setup. Provided step-by-step guidance.'
        },
        {
          id: 3,
          timestamp: new Date(Date.now() - 172800000),
          duration: 15,
          agent: 'AI Agent 1',
          customer: 'Bob Johnson',
          type: 'text',
          status: 'completed',
          size: '0.5 MB',
          transcript: [
            { speaker: 'customer', text: 'I have a question about my bill' },
            { speaker: 'agent', text: 'I can help you with that. What seems to be the issue?' }
          ],
          summary: 'Billing question and invoice request. Resolved billing discrepancy.'
        }
      ],
      analytics: {
        totalCalls: 1247,
        callsToday: 24,
        avgCallDuration: 3.2,
        satisfactionRate: 94.2,
        resolutionRate: 96.8,
        agentPerformance: [
          { name: 'AI Agent 1', calls: 45, avgDuration: 4.2, satisfaction: 95.1 },
          { name: 'AI Agent 2', calls: 38, avgDuration: 3.8, satisfaction: 93.7 },
          { name: 'AI Agent 3', calls: 42, avgDuration: 3.5, satisfaction: 96.2 }
        ]
      },
      logs: [
        {
          id: 101,
          date: new Date(),
          agent: 'AI Agent 1',
          customer: 'Sarah Wilson',
          status: 'completed',
          sentiment: 'positive',
          duration: 8,
          summary: 'Resolved issue with order tracking and provided shipping update.',
          transcript: [
            { speaker: 'customer', text: 'Where is my order?' },
            { speaker: 'agent', text: 'I can help with that. Can I have your order number?' },
            { speaker: 'customer', text: 'It is #12345' },
            { speaker: 'agent', text: 'Thank you. Your order is currently out for delivery.' }
          ]
        },
        {
          id: 102,
          date: new Date(Date.now() - 3600000),
          agent: 'AI Agent 2',
          customer: 'Michael Brown',
          status: 'in-progress',
          sentiment: 'neutral',
          duration: 4,
          summary: 'Technical setup assistance for the new smart device.',
          transcript: [
            { speaker: 'customer', text: 'I am struggling to connect to wifi' },
            { speaker: 'agent', text: 'No problem. Let start by resetting the hub.' }
          ]
        },
        {
          id: 103,
          date: new Date(Date.now() - 7200000),
          agent: 'AI Agent 1',
          customer: 'Emily Davis',
          status: 'failed',
          sentiment: 'negative',
          duration: 12,
          summary: 'Customer frustrated with repeated billing errors. Escalated to human supervisor.',
          transcript: [
            { speaker: 'customer', text: 'This is the third time you have overcharged me!' },
            { speaker: 'agent', text: 'I am very sorry for the frustration. Let me look into your history.' }
          ]
        }
      ],
      agents: [
        { id: 1, name: 'AI Agent 1', status: 'active', callsHandled: 45, uptime: 99.2 },
        { id: 2, name: 'AI Agent 2', status: 'active', callsHandled: 38, uptime: 98.7 },
        { id: 3, name: 'AI Agent 3', status: 'maintenance', callsHandled: 42, uptime: 99.5 }
      ]
    };
  }

  // API Methods - these will work with both mock and real data
  async fetchCalls(filters = {}) {
    let calls = [...this.mockData.calls];

    if (filters.type && filters.type !== 'all') {
      calls = calls.filter(call => call.type === filters.type);
    }

    if (filters.search) {
      const search = filters.search.toLowerCase();
      calls = calls.filter(call =>
        call.customer.toLowerCase().includes(search) ||
        call.summary.toLowerCase().includes(search)
      );
    }

    return calls;
  }

  async fetchAnalytics() {
    return this.mockData.analytics;
  }

  async fetchLogs(filters = {}) {
    let logs = [...this.mockData.logs];

    if (filters.status && filters.status !== 'all') {
      logs = logs.filter(log => log.status === filters.status);
    }

    if (filters.search) {
      const search = filters.search.toLowerCase();
      logs = logs.filter(log =>
        log.customer.toLowerCase().includes(search) ||
        log.summary.toLowerCase().includes(search)
      );
    }

    return logs;
  }

  async fetchAgents() {
    return this.mockData.agents;
  }

  async fetchCallDetails(callId) {
    return this.mockData.calls.find(call => call.id === callId);
  }

  // Method to switch to real data when AI agent connects
  switchToRealData(realDataService) {
    this.isUsingRealData = true;
    console.log('Switching to real-time data from AI agent...');
  }

  // Get current status
  getStatus() {
    return {
      isUsingRealData: this.isUsingRealData,
      source: this.isUsingRealData ? 'AI Agent' : 'Mock Data',
      timestamp: new Date()
    };
  }
}

// Singleton instance
const mockDataService = new MockDataService();
export default mockDataService;