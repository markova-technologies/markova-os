import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import Dashboard from './pages/Dashboard';
import CompaniesManagement from './pages/CompaniesManagement';
import RevenueAnalytics from './pages/RevenueAnalytics';
import ActiveCalls from './pages/ActiveCalls';
import PlatformHealth from './pages/PlatformHealth';
import TenantUsage from './pages/TenantUsage';
import SupportTickets from './pages/SupportTickets';
import GlobalAuditLogs from './pages/GlobalAuditLogs';
import Settings from './pages/Settings';
import { ThemeProvider } from './contexts/ThemeContext';
import { SocketProvider } from './contexts/SocketContext';
import { DataProvider } from './contexts/DataContext';
import './App.css';

import AlertBanner from './components/AlertBanner';

import ErrorBoundary from './components/ErrorBoundary';
import AIAssistant from './components/AIAssistant';

function App() {
  const [showSidebar, setShowSidebar] = React.useState(false);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <SocketProvider>
          <DataProvider>
            <Router>
              <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900 relative">
                <AlertBanner />
                <Sidebar isOpen={showSidebar} onClose={() => setShowSidebar(false)} />
                <div className="flex-1 flex flex-col min-h-screen lg:ml-64 overflow-hidden">
                    <Routes>
                      <Route path="/" element={<Dashboard onMenuClick={() => setShowSidebar(true)} />} />
                      <Route path="/companies" element={<CompaniesManagement />} />
                      <Route path="/revenue" element={<RevenueAnalytics />} />
                      <Route path="/calls" element={<ActiveCalls />} />
                      <Route path="/health" element={<PlatformHealth />} />
                      <Route path="/usage" element={<TenantUsage />} />
                      <Route path="/tickets" element={<SupportTickets />} />
                      <Route path="/audit" element={<GlobalAuditLogs />} />
                      <Route path="/settings" element={<Settings onMenuClick={() => setShowSidebar(true)} />} />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </div>
                <AIAssistant />
              </div>
            </Router>
          </DataProvider>
        </SocketProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
