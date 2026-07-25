import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

console.log('🚀 main.jsx: Starting application...');

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('❌ main.jsx: Root element not found!');
} else {
  console.log('✅ main.jsx: Root element found, rendering App...');
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}
