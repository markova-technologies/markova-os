import React from 'react';
import { tokenStore } from '../api/client';

export default function ImpersonationBanner({ user }) {
  if (!user || !user.impersonatorId) return null;

  const handleEndImpersonation = () => {
    tokenStore.clear();
    window.location.href = 'http://localhost:3001'; // Assuming admin dashboard runs on 3001 locally, or admin.markova.tech in prod
  };

  return (
    <div style={{
      backgroundColor: '#f59e0b',
      color: '#000',
      padding: '8px 16px',
      textAlign: 'center',
      fontWeight: 'bold',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '16px',
      zIndex: 9999,
      position: 'relative',
      fontSize: '14px'
    }}>
      <span>
        ⚠️ SECURITY WARNING: You are currently impersonating tenant: {user.company_id}
      </span>
      <button 
        onClick={handleEndImpersonation}
        style={{
          background: 'rgba(0,0,0,0.1)',
          border: '1px solid black',
          color: 'black',
          padding: '4px 12px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontWeight: 'bold',
          transition: 'background 0.2s'
        }}
      >
        End Impersonation
      </button>
    </div>
  );
}
