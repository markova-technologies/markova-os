// Real-time service for connecting to AI agent
// This service handles WebSocket connections and data synchronization

class RealTimeService {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // 1 second
    this.listeners = new Map(); // Event listeners
    // Use import.meta.env for Vite instead of process.env
    // AI Python server runs on port 8001
    this.baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
  }

  // Connect to AI agent WebSocket
  connect() {
    if (this.ws && this.isConnected) {
      console.log('Already connected to AI agent');
      return;
    }

    try {
      // Try WebSocket connection first
      this.ws = new WebSocket(`${this.baseUrl.replace('http', 'ws')}/ws/dashboard`);

      this.ws.onopen = () => {
        console.log('✅ Connected to AI agent');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('❌ Disconnected from AI agent');
        this.isConnected = false;
        this.emit('disconnected');
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.emit('error', error);
      };

    } catch (error) {
      console.error('Failed to establish WebSocket connection:', error);
      // Fallback to polling if WebSocket fails
      this.startPolling();
    }
  }

  // Handle incoming messages from AI agent
  handleMessage(data) {
    const { type, payload } = data;

    switch (type) {
      case 'call_started':
        this.emit('callStarted', payload);
        break;
      case 'call_ended':
        this.emit('callEnded', payload);
        break;
      case 'transcript_update':
        this.emit('transcriptUpdate', payload);
        break;
      case 'agent_status':
        this.emit('agentStatus', payload);
        break;
      case 'analytics_update':
        this.emit('analyticsUpdate', payload);
        break;
      case 'log_entry':
        this.emit('logEntry', payload);
        break;
      default:
        console.log('Unknown message type:', type);
    }
  }

  // Attempt to reconnect on disconnect
  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts && !this.isConnected) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

      setTimeout(() => {
        this.connect();
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.log('Max reconnection attempts reached. Switching to polling.');
      this.startPolling();
    }
  }

  // Fallback polling mechanism
  startPolling() {
    console.log('Starting polling mechanism...');
    this.pollingInterval = setInterval(async () => {
      try {
        // Poll for updates from REST API
        const updates = await this.fetchUpdates();
        if (updates) {
          this.handlePollingUpdates(updates);
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 5000); // Poll every 5 seconds
  }

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  // Fetch updates via REST API (fallback)
  async fetchUpdates() {
    try {
      const response = await fetch(`${this.baseUrl}/api/dashboard/updates`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Failed to fetch updates:', error);
    }
    return null;
  }

  // Handle polling updates
  handlePollingUpdates(updates) {
    if (updates.calls) {
      this.emit('callsUpdate', updates.calls);
    }
    if (updates.analytics) {
      this.emit('analyticsUpdate', updates.analytics);
    }
    if (updates.logs) {
      this.emit('logsUpdate', updates.logs);
    }
  }

  // Send message to AI agent
  sendMessage(type, payload) {
    if (this.ws && this.isConnected) {
      const message = JSON.stringify({ type, payload });
      this.ws.send(message);
    } else {
      console.warn('Not connected to AI agent. Message not sent:', type);
    }
  }

  // Subscribe to events
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  // Unsubscribe from events
  off(event, callback) {
    if (this.listeners.has(event)) {
      const listeners = this.listeners.get(event);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  // Emit events to subscribers
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in event listener:', error);
        }
      });
    }
  }

  // Disconnect from AI agent
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.stopPolling();
    this.isConnected = false;
    this.emit('disconnected');
  }

  // Get connection status
  getStatus() {
    return {
      isConnected: this.isConnected,
      method: this.ws ? 'websocket' : 'polling',
      reconnectAttempts: this.reconnectAttempts
    };
  }
}

// Singleton instance
const realTimeService = new RealTimeService();
export default realTimeService;