# Changelog

All notable changes to the AI Call Center Management Dashboard will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-01-29

### Added
- **Groq LLM Integration**: Floating AI Assistant, AI-powered system insights, and detailed agent analysis
- **AdvancedAnalytics Component**: Comprehensive analytics view with time range selector (1h, 24h, 7d, 30d), area/line/pie/bar charts for health trends and agent distributions
- **AgentPerformanceDetails Component**: Detailed agent view with tabbed navigation (Overview, Metrics, History) and circular progress visualizations
- **AgentComparison Component**: Multi-agent comparison tool with radar chart visualization and detailed metrics breakdown (up to 3 agents)
- **PredictiveAnalytics Component**: AI-powered forecasting with health trend predictions, failure risk assessment, and resource needs forecasting
- **ErrorBoundary Component**: Catches and displays runtime errors gracefully
- Dashboard view mode toggle (Overview / Advanced Analytics)
- Analytics page: Agent Comparison tab
- LLM Diagnostics page: Predictive Analytics tab

### Fixed
- White screen issue caused by incorrect `Link` import in Analytics.jsx
- RealTimeAnalytics now properly supports both `area` and `line` chart types

---

## [1.0.0] - 2026-01-28

### Added
- **WebSocket Integration**: Real-time data updates via Socket.IO replacing 30-second polling
- **PerformanceGauge Component**: Circular progress indicators with dynamic color coding
- **RealTimeAnalytics Component**: Live streaming charts for health trends and response times
- **AlertBanner Component**: Real-time alert notifications with auto-dismissal
- **RealTimeMonitor Component**: Connection status indicator (LIVE/DISCONNECTED)
- WebSocketContext for global real-time state management
- DataContext for centralized data management
- Real-time agent updates broadcasting every 5 seconds

### Changed
- Dashboard now uses real-time data instead of polling
- AgentManagement receives instant updates via WebSocket
- AnalyticsReports charts update in real-time

### Fixed
- Missing dependencies (tailwindcss, postcss, autoprefixer)
- Incorrect import path in NotificationContext.jsx
- Server port conflicts with proper process termination

---

## [0.1.0] - Initial Release

### Added
- Basic dashboard layout with sidebar navigation
- Agent Management page
- Client Management page
- LLM Diagnostics page
- Analytics & Reports page
- Settings page
- Dark/Light theme toggle
- Glassmorphism UI design
- Framer Motion animations
