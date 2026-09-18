import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ShieldAlert, ArrowLeft, Lock } from 'lucide-react';
import { ROUTES } from '../config/site';

export const RequirePermission = ({ permission, children, fallback = undefined }) => {
  const { can, role, user } = useAuth();
  const navigate = useNavigate();

  const hasAccess = can(permission);

  if (hasAccess) {
    return <>{children}</>;
  }

  // If a custom fallback is provided (including null for hiding inline elements)
  if (fallback !== undefined) {
    return fallback;
  }

  // Full Page Access Denied Fallback
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '70vh',
      padding: '2rem'
    }}>
      <div style={{
        maxWidth: '520px',
        width: '100%',
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)',
        border: '1px solid rgba(239, 68, 68, 0.25)',
        borderRadius: '16px',
        padding: '2.5rem',
        textAlign: 'center',
        boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.5), 0 0 30px rgba(239, 68, 68, 0.1)',
        backdropFilter: 'blur(16px)'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          margin: '0 auto 1.5rem',
          borderRadius: '16px',
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#f87171'
        }}>
          <ShieldAlert size={34} />
        </div>

        <h2 style={{
          color: '#ffffff',
          fontSize: '1.5rem',
          fontWeight: 700,
          margin: '0 0 0.75rem',
          letterSpacing: '-0.02em'
        }}>
          Access Restricted
        </h2>

        <p style={{
          color: '#94a3b8',
          fontSize: '0.95rem',
          lineHeight: 1.6,
          margin: '0 0 1.5rem'
        }}>
          Your assigned role (<strong>{role ? role.toUpperCase() : 'VIEWER'}</strong>) does not have authorization to access this area.
        </p>

        <div style={{
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '10px',
          padding: '0.875rem 1rem',
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          fontSize: '0.85rem',
          color: '#cbd5e1'
        }}>
          <Lock size={15} style={{ color: '#f87171' }} />
          <span>Required Permission: <code style={{ color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>{permission}</code></span>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button
            onClick={() => navigate(ROUTES.app)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
              transition: 'all 0.2s ease'
            }}
          >
            <ArrowLeft size={16} />
            Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default RequirePermission;
