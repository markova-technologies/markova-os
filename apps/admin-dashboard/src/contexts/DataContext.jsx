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

    // Fetch initial data
    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);

                // Fetch agents
                const agentsRes = await fetch(`${API_BASE}/api/agents`);
                const agentsData = await agentsRes.json();
                setAgents(agentsData);

                // Fetch clients
                const clientsRes = await fetch(`${API_BASE}/api/clients`);
                const clientsData = await clientsRes.json();
                setClients(clientsData);

                // Fetch analytics
                const analyticsRes = await fetch(`${API_BASE}/api/analytics`);
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
            const res = await fetch(`${API_BASE}/api/agents`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
            const res = await fetch(`${API_BASE}/api/agents/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
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
            await fetch(`${API_BASE}/api/agents/${id}`, {
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
            const res = await fetch(`${API_BASE}/api/clients/${id}/approve`, {
                method: 'POST',
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
            await fetch(`${API_BASE}/api/clients/${id}/reject`, {
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
                const res = await fetch(`${API_BASE}/api/clients/${clientId}/assign-agent`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
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
                const res = await fetch(`${API_BASE}/api/clients/${clientId}/unassign-agent/${agentId}`, {
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
