# MARKOVA AI Call Center Dashboard

An advanced analytics dashboard for monitoring customer interactions with AI-powered insights and enterprise-grade security.

## 🚀 Overview

MARKOVA is a comprehensive AI call center platform featuring real-time analytics and user management. The application connects to a central System Dashboard for authentication and administrative controls.

## 🎯 Key Features Highlight

### 📞 Call Records Management
The Records page provides a complete solution for managing conversation recordings:
- **Search & Filter**: Find conversations by customer name, agent, or content
- **Detailed Views**: Inspect full transcripts with speaker identification
- **Media Playback**: Play/pause voice recordings directly in the interface
- **Export Options**: Download recordings or export transcripts
- **Metadata Display**: View date, duration, participants, and file information

### 📊 Analytics & Insights
Real-time monitoring and performance tracking:
- Live call volume metrics
- Performance trend visualization
- User activity analytics
- Customizable dashboard widgets

### 🔐 Secure Access Control
Enterprise-grade security features:
- Approval-required user registration
- Admin-controlled access permissions
- Role-based dashboard access
- Secure authentication workflows

## 📋 Features

### Main Dashboard
- **Analytics & Monitoring**
  - Real-time analytics and performance metrics
  - Call volume trends and performance charts
  - User activity monitoring
  - Modern dashboard with 4 key metric cards

- **Mobile & UI Optimization**
  - Fully responsive design for mobile, tablet, and desktop
  - Sliding hamburger menu for mobile navigation
  - Optimally stacked layouts for data-heavy grids on small screens
  - Premium Glassmorphism UI with high-fidelity animations

- **Theme Consistency**
  - Robust dark/light mode support using semantic CSS variables
  - Standardized premium dropdowns and modals across all apps

- **Call Records Management**
  - Comprehensive records grid with search and filtering
  - Extended year selection range (up to 2040)
  - Detailed modal views for conversation inspection
  - Voice recording playback with play/pause controls
  - Transcript display with speaker identification
  - Metadata viewing (date, duration, participants, file size)
  - Export and download functionality for records/transcripts
  - Type filtering (voice/text conversations)

- **Security & Authentication**
  - Secure login with approved account verification
  - Form validation and error handling
  - Responsive design for all device sizes

### Authentication System
- Secure signup with form validation
- Approval-required registration process
- System Dashboard-managed user access control
- API-based token authentication

## 🛠️ Technology Stack

- **Frontend**: React, Vite, framer-motion
- **Styling**: CSS Modules, Tailwind-inspired utility classes
- **Icons**: Lucide React
- **Routing**: React Router DOM
- **Animations**: Framer Motion

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn package manager
- **System Dashboard running on port 5000** (Required for authentication)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd <repository-directory>
```

2. Install dependencies:
```bash
npm install
```

### Running the Applications

#### Main Dashboard
```bash
# Run from root directory
npm run dev
```
The main dashboard will be available at `http://localhost:5173`

## 📖 Usage

### Main Dashboard

1. **User Registration**
   - Navigate to the signup page
   - Fill in required information (name, email, password, company, phone)
   - Submit registration for approval

2. **Login Process**
   - Only approved users can access the main dashboard
   - Use approved credentials to log in
   - Contact administrator if account is pending approval

3. **Call Records Management**
   - Navigate to the Records page from the sidebar
   - Use search bar to find specific conversations by customer name or content
   - Filter records by type (voice/text) using the dropdown
   - Click on any record card to view detailed information
   - In the detailed view:
     - View complete conversation transcript
     - Play/pause voice recordings
     - See metadata including date, duration, and file size
     - Download records or export transcripts

4. **Analytics Dashboard**
   - Monitor real-time call metrics and trends
   - View performance charts and statistics
   - Track user activity and engagement



## 🔐 Security

- Approval-required user registration system
- Admin-controlled user access
- Secure credential storage
- Form validation and sanitization
- Role-based access control

## 🏗️ Project Structure

```
├── advanced-dashboard/          # Main dashboard application
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   │   ├── Header.jsx     # Main header component
│   │   │   ├── Sidebar.jsx    # Navigation sidebar
│   │   │   ├── Header.css     # Header styling
│   │   │   └── Sidebar.css    # Sidebar styling
│   │   ├── pages/            # Page components
│   │   │   ├── Dashboard.jsx  # Main dashboard view
│   │   │   ├── Analytics.jsx  # Analytics and charts
│   │   │   ├── Records.jsx    # Call records management
│   │   │   ├── Logs.jsx       # Activity logs
│   │   │   ├── Settings.jsx   # User settings
│   │   │   ├── Login.jsx      # Authentication login
│   │   │   ├── Signup.jsx     # User registration
│   │   │   ├── AdminApproval.jsx # Admin approval (deprecated)
│   │   │   ├── Dashboard.css  # Dashboard styling
│   │   │   ├── Analytics.css  # Analytics styling
│   │   │   ├── Records.css    # Records styling
│   │   │   ├── Logs.css       # Logs styling
│   │   │   ├── Settings.css   # Settings styling
│   │   │   ├── Login.css      # Login styling
│   │   │   └── Signup.css     # Signup styling
│   │   ├── contexts/         # React context providers
│   │   ├── services/         # Data services
│   │   ├── App.jsx           # Main application component
│   │   ├── App.css           # Global application styles
│   │   ├── index.css         # Base CSS styles
│   │   └── main.jsx          # Application entry point
│   ├── public/               # Static assets
│   ├── index.html            # HTML template
│   ├── vite.config.js        # Vite configuration
│   └── package.json
├── README.md                 # Project documentation
├── CHANGELOG.md              # Version history and changes
└── package.json              # Root package configuration
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 📞 Support

For support, please contact the development team.