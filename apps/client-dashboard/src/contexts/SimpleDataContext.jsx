// Simple data context for providing data to components
import { createContext, useContext, useState, useEffect } from 'react';
import unifiedDataService from '../services/unifiedDataService';

const DataContext = createContext();

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

export const DataProvider = ({ children }) => {
  const [calls, setCalls] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [logs, setLogs] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dataStatus, setDataStatus] = useState({ isUsingRealData: false });

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [callsData, analyticsData, logsData, agentsData] = await Promise.all([
          unifiedDataService.fetchCalls(),
          unifiedDataService.fetchAnalytics(),
          unifiedDataService.fetchLogs(),
          unifiedDataService.fetchAgents()
        ]);
        
        setCalls(callsData);
        setAnalytics(analyticsData);
        setLogs(logsData);
        setAgents(agentsData);
        setDataStatus(unifiedDataService.getStatus());
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Refresh data function
  const refreshData = async () => {
    setLoading(true);
    try {
      const [callsData, analyticsData, logsData, agentsData] = await Promise.all([
        unifiedDataService.fetchCalls(),
        unifiedDataService.fetchAnalytics(),
        unifiedDataService.fetchLogs(),
        unifiedDataService.fetchAgents()
      ]);
      
      setCalls(callsData);
      setAnalytics(analyticsData);
      setLogs(logsData);
      setAgents(agentsData);
      setDataStatus(unifiedDataService.getStatus());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const value = {
    // Data
    calls,
    analytics,
    logs,
    agents,
    
    // State
    loading,
    error,
    dataStatus,
    
    // Methods
    refreshData,
    fetchCalls: unifiedDataService.fetchCalls.bind(unifiedDataService),
    fetchAnalytics: unifiedDataService.fetchAnalytics.bind(unifiedDataService),
    fetchLogs: unifiedDataService.fetchLogs.bind(unifiedDataService),
    fetchAgents: unifiedDataService.fetchAgents.bind(unifiedDataService),
    fetchCallDetails: unifiedDataService.fetchCallDetails.bind(unifiedDataService)
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};