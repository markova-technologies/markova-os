import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useOutletContext } from 'react-router-dom';
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
import Landing from '../../../packages/ui/landing/Landing';
import { DOCS_URL, ROUTES } from './config/site';
import { ThemeProvider } from './contexts/ThemeContext';
import { SocketProvider } from './contexts/SocketContext';
import { DataProvider } from './contexts/DataContext';
import './App.css';

import AlertBanner from './components/AlertBanner';

import ErrorBoundary from './components/ErrorBoundary';
import AIAssistant from './components/AIAssistant';

function AdminShell() {
  const [showSidebar, setShowSidebar] = React.useState(false);

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900 relative">
      <AlertBanner />
      <Sidebar isOpen={showSidebar} onClose={() => setShowSidebar(false)} />
      <div className="flex-1 flex flex-col min-h-screen lg:ml-64 overflow-hidden">
        <Outlet context={{ openMenu: () => setShowSidebar(true) }} />
      </div>
      <AIAssistant />
    </div>
  );
}

function DashboardWithMenu() {
  const { openMenu } = useOutletContext();
  return <Dashboard onMenuClick={openMenu} />;
}

function SettingsWithMenu() {
  const { openMenu } = useOutletContext();
  return <Settings onMenuClick={openMenu} />;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <SocketProvider>
          <DataProvider>
            <Router>
              <Routes>
                {/* Public marketing landing */}
                <Route
                  path={ROUTES.home}
                  element={
                    <Landing
                      primaryTo={ROUTES.dashboard}
                      primaryLabel="Enter console"
                      docsHref={DOCS_URL}
                    />
                  }
                />
                {/* Admin console — named paths, never occupies / */}
                <Route element={<AdminShell />}>
                  <Route path={ROUTES.dashboard} element={<DashboardWithMenu />} />
                  <Route path={ROUTES.companies} element={<CompaniesManagement />} />
                  <Route path={ROUTES.revenue} element={<RevenueAnalytics />} />
                  <Route path={ROUTES.calls} element={<ActiveCalls />} />
                  <Route path={ROUTES.health} element={<PlatformHealth />} />
                  <Route path={ROUTES.usage} element={<TenantUsage />} />
                  <Route path={ROUTES.tickets} element={<SupportTickets />} />
                  <Route path={ROUTES.audit} element={<GlobalAuditLogs />} />
                  <Route path={ROUTES.settings} element={<SettingsWithMenu />} />
                </Route>
                <Route path="*" element={<Navigate to={ROUTES.home} replace />} />
              </Routes>
            </Router>
          </DataProvider>
        </SocketProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
