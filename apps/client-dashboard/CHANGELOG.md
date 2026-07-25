# Changelog

All notable changes to the MARKOVA AI Call Center Dashboard and Admin Portal will be documented in this file.

## [1.1.0] - 2026-02-01

### Added
- **Complete Mobile Optimization**
  - Implemented responsive navigation with a sliding hamburger menu.
  - Optimized grids and layouts for **Dashboard**, **Logs**, **Records**, and **Analytics** pages.
  - Added centered dropdowns and touch-friendly controls for mobile users.
  - Refined modal sizes for mobile to ensure focus and usability without covering full screen.

- **Semantic Theme System**
  - Refactored entire CSS architecture to use global semantic variables (`--bg-main`, `--bg-card`, `--text-main`, etc.).
  - Ensured seamless dark/light mode transitions and fixed background "leaks" in dark mode.
  - Standardized dropdown and modal aesthetics across all pages.

- **Enhanced Records Management**
  - Extended year selection range up to **2040**.
  - Implemented horizontal scroll for timeframe tabs on mobile for space efficiency.
  - Added z-index layering fixes for overlapping dropdown components.

### Changed
- **Signup Page Modernization**
  - Completely redesigned signup UI with a premium vibrant palette (Purple, Blue, and Green).
  - Enhanced text contrast and readability.
  - Improved glassmorphism effects for a more modern, high-fidelity feel.

- **Navigation Adjustments**
  - Removed "Settings" from the primary sidebar navigation per user request.

### Fixed
- Fixed viewport issues where modals covered the entire mobile screen.
- Corrected CSS syntax errors in `index.css` and `Records.css`.
- Resolved linting warnings for `background-clip` compatibility.

## [1.0.0] - 2026-01-28

### Added
- **Call Records Management System**
  - Implemented complete Records page for managing conversation recordings
  - Added searchable grid view of all call records with filtering capabilities
  - Created detailed modal view for record inspection
  - Implemented voice playback functionality with play/pause controls
  - Added transcript display with speaker identification
  - Included metadata section showing date, duration, participants, and file size
  - Added export/download functionality for records and transcripts
  - Implemented search by customer name, agent, or summary
  - Added type filtering (voice/text) capabilities

- **Admin Portal Application**
  - Created separate admin portal application in `admin-portal/` directory
  - Implemented user approval workflow for new account registrations
  - Added admin authentication system with secure login
  - Created dashboard for managing pending, approved, and rejected users
  - Added search and filtering capabilities for user management
  - Implemented approve/reject functionality with persistent storage

- **Authentication System**
  - Created comprehensive signup page with form validation
  - Added user registration with name, email, password, company, and phone fields
  - Implemented approval-required login system
  - Added admin user management with localStorage persistence
  - Created separate admin credentials for user approval

- **Dashboard Enhancements**
  - Updated dashboard cards with modern and classic presentation modes
  - Added detailed descriptions to dashboard metrics
  - Enhanced card styling with gradient borders and improved typography
  - Improved information hierarchy with title-description-value structure

- **UI/UX Improvements**
  - Enhanced signup form visibility with improved contrast and styling
  - Updated login page with better accessibility and user experience
  - Added modern icons and improved visual design throughout
  - Improved form validation and error messaging
  - Enhanced responsive design for all components

- **Infrastructure**
  - Separated admin portal into independent application
  - Configured separate server for admin portal on different port
  - Implemented localStorage-based user data persistence
  - Added proper error handling for data loading operations

### Changed
- **Sidebar Navigation**
  - Removed admin approval link from main dashboard sidebar
  - Added logout button to sidebar footer
  - Improved sidebar layout and styling consistency

- **Login/Signup Flow**
  - Updated login page to check against approved users only
  - Enhanced signup form validation and user feedback
  - Improved header and footer visibility on signup page
  - Changed signup footer link color to black for better contrast

- **Styling Updates**
  - Improved form field visibility with better contrast ratios
  - Updated CSS for enhanced readability and accessibility
  - Applied consistent styling across all authentication pages

### Fixed
- **CSS Compatibility Issues**
  - Added standard `line-clamp` property alongside `-webkit-line-clamp` for better browser compatibility
  - Fixed vendor prefix warnings in Records.css

- **Admin Portal Rendering Issues**
  - Fixed potential crashes during localStorage data loading
  - Added error handling for malformed user data
  - Improved component rendering after admin login

- **Visibility Issues**
  - Enhanced form field visibility on signup page
  - Improved header text contrast and readability
  - Fixed footer link color for better accessibility

### Security
- Implemented approval-required user registration system
- Added admin authentication for user management
- Created secure user data storage with localStorage
- Prevented unauthorized access to main dashboard before approval