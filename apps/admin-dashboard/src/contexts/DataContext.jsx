import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useSocket } from './SocketContext';

const DataContext = createContext();

export const useData = () => {
    const context = useContext(DataContext);
    if (!context) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
};

const DataProvider = ({ children }) => {
    const { socket, connected } = useSocket();

    const [agents, setAgents] = useState([]);
    const [clients, setClients] = useState([]);
    const [analytics, setAnalytics] = useState({});
    const [alerts, setAlerts] = useState([]);
    const [notificationHistory, setNotificationHistory] = useState([]);
    const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
        const saved = localStorage.getItem('notificationsEnabled');
        return saved !== null ? JSON.parse(saved) : true;
    });
    const [loading, setLoading] = useState(true);

    const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

    const fetchWithAuth = async (url, options = {}) => {
        const token = localStorage.getItem('admin_token');
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers,
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        const res = await fetch(url, { ...options, headers });
        if (res.status === 401 || res.status === 403) {
            localStorage.removeItem('admin_token');
            localStorage.removeItem('admin_user');
            window.location.href = '/login';
            throw new Error('Unauthorized');
        }
        return res;
    };

    // Fetch initial data
    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);

                // Fetch agents
                const agentsRes = await fetchWithAuth(`${API_BASE}/v1/admin/agents`);
                const agentsData = await agentsRes.json();
                setAgents(agentsData);

                // Fetch clients (companies)
                const clientsRes = await fetchWithAuth(`${API_BASE}/v1/admin/companies`);
                const clientsData = await clientsRes.json();
                setClients(clientsData);

                // Fetch analytics
                const analyticsRes = await fetchWithAuth(`${API_BASE}/v1/admin/analytics`);
                const analyticsData = await analyticsRes.json();
                setAnalytics(analyticsData);

                setLoading(false);
            } catch (error) {
                console.error('Error fetching data:', error);
                setLoading(false);
            }
        };

        fetchData();
    }, [API_BASE]);

    // Listen for real-time updates via WebSocket
    useEffect(() => {
        if (!socket || !connected) return;

        // Agent updates
        socket.on('agentUpdate', (updatedAgent) => {
            setAgents(prev =>
                prev.map(agent => agent.id === updatedAgent.id ? updatedAgent : agent)
            );
        });

        // New agent
        socket.on('newAgent', (newAgent) => {
            setAgents(prev => [...prev, newAgent]);
        });

        // New client request (from external sign-up)
        socket.on('newClientRequest', (newClient) => {
            setClients(prev => [...prev, newClient]);
            // Optional: Trigger a notification for the admin
            if (notificationsEnabled) {
                setAlerts(prev => [...prev, {
                    id: Date.now(),
                    type: 'info',
                    message: `New client registration: ${newClient.company}`,
                    path: '/clients',
                    read: false
                }]);
            }
        });

        // Analytics updates
        socket.on('analyticsUpdate', (newAnalytics) => {
            setAnalytics(newAnalytics);
        });

        // Alerts
        socket.on('alert', (alert) => {
            const newAlert = { ...alert, id: Date.now(), read: false };

            // Always add to history
            setNotificationHistory(prev => [newAlert, ...prev].slice(0, 50)); // Keep last 50

            // Show banner only if enabled
            if (notificationsEnabled) {
                setAlerts(prev => [...prev, newAlert]);

                // Auto-dismiss banner after 5 seconds
                setTimeout(() => {
                    setAlerts(prev => prev.filter(a => a.id !== newAlert.id));
                }, 5000);
            }
        });

        return () => {
            socket.off('agentUpdate');
            socket.off('newAgent');
            socket.off('analyticsUpdate');
            socket.off('alert');
        };
    }, [socket, connected, notificationsEnabled]);

    const toggleNotifications = () => {
        setNotificationsEnabled(prev => {
            const newValue = !prev;
            localStorage.setItem('notificationsEnabled', JSON.stringify(newValue));
            return newValue;
        });
    };

    const markAllRead = () => {
        setNotificationHistory(prev => prev.map(n => ({ ...n, read: true })));
    };

    const addAgent = async (agentData) => {
        try {
            const res = await fetchWithAuth(`${API_BASE}/v1/admin/agents`, {
                method: 'POST',
                body: JSON.stringify(agentData),
            });
            const newAgent = await res.json();
            setAgents(prev => [...prev, newAgent]);
            return newAgent;
        } catch (error) {
            console.error('Error adding agent:', error);
            throw error;
        }
    };

    const updateAgent = async (id, updates) => {
        try {
            const res = await fetchWithAuth(`${API_BASE}/v1/admin/agents/${id}`, {
                method: 'PUT',
                body: JSON.stringify(updates),
            });
            const updatedAgent = await res.json();
            setAgents(prev =>
                prev.map(agent => agent.id === id ? updatedAgent : agent)
            );
            return updatedAgent;
        } catch (error) {
            console.error('Error updating agent:', error);
            throw error;
        }
    };

    const deleteAgent = async (id) => {
        try {
            await fetchWithAuth(`${API_BASE}/v1/admin/agents/${id}`, {
                method: 'DELETE',
            });
            setAgents(prev => prev.filter(agent => agent.id !== id));
        } catch (error) {
            console.error('Error deleting agent:', error);
            throw error;
        }
    };

    const approveClient = async (id) => {
        try {
            const res = await fetchWithAuth(`${API_BASE}/v1/admin/companies/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ status: 'active' }),
            });
            const updatedClient = await res.json();
            setClients(prev =>
                prev.map(client => client.id === id ? updatedClient : client)
            );
            return updatedClient;
        } catch (error) {
            console.error('Error approving client:', error);
            throw error;
        }
    };

    const rejectClient = async (id) => {
        try {
            await fetchWithAuth(`${API_BASE}/v1/admin/companies/${id}`, {
                method: 'DELETE',
            });
            setClients(prev => prev.filter(client => client.id !== id));
        } catch (error) {
            console.error('Error rejecting client:', error);
            throw error;
        }
    };

    const dismissAlert = (alertId) => {
        setAlerts(prev => prev.filter(a => a.id !== alertId));
    };

    const value = {
        agents,
        clients,
        analytics,
        alerts,
        notificationHistory,
        notificationsEnabled,
        loading,
        addAgent,
        updateAgent,
        deleteAgent,
        dismissAlert,
        toggleNotifications,
        markAllRead,
        approveClient,
        rejectClient,
        assignAgent: async (clientId, agentId) => {
            try {
                const res = await fetchWithAuth(`${API_BASE}/v1/admin/companies/${clientId}/assign-agent`, {
                    method: 'POST',
                    body: JSON.stringify({ agentId }),
                });
                const updatedClient = await res.json();
                setClients(prev =>
                    prev.map(client => client.id === clientId ? updatedClient : client)
                );
                return updatedClient;
            } catch (error) {
                console.error('Error assigning agent:', error);
                throw error;
            }
        },
        unassignAgent: async (clientId, agentId) => {
            try {
                const res = await fetchWithAuth(`${API_BASE}/v1/admin/companies/${clientId}/unassign-agent/${agentId}`, {
                    method: 'DELETE',
                });
                const updatedClient = await res.json();
                setClients(prev =>
                    prev.map(client => client.id === clientId ? updatedClient : client)
                );
                return updatedClient;
            } catch (error) {
                console.error('Error unassigning agent:', error);
                throw error;
            }
        }
    };

    const contextValue = useMemo(() => value, [
        agents, clients, analytics, alerts, notificationHistory, notificationsEnabled, loading, API_BASE
    ]);

    return (
        <DataContext.Provider value={contextValue}>
            {children}
        </DataContext.Provider>
    );
};

export { DataProvider };
export default DataProvider;
