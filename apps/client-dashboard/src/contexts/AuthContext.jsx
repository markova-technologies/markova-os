import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { tokenStore, getMe, isDemoMode } from '../api/client';
import { supabase } from '../config/supabase';

const AuthContext = createContext(null);

function parseJwt(token) {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

// Fallback role permissions when offline or in demo mode
const DEFAULT_ROLE_PERMISSIONS = {
  owner: ['*'],
  superadmin: ['*'],
  admin: [
    'agents:read', 'agents:create', 'agents:update', 'agents:delete',
    'knowledge:read', 'knowledge:create', 'knowledge:update', 'knowledge:delete',
    'calls:read', 'calls:listen', 'calls:barge', 'calls:download',
    'analytics:read', 'crm:read', 'crm:write', 'crm:delete',
    'integrations:read', 'integrations:create', 'integrations:delete',
    'keys:read', 'keys:create', 'keys:delete',
    'settings:read', 'settings:write', 'billing:read',
    'users:read', 'users:invite', 'users:manage_roles', 'users:deactivate',
    'governance:read', 'governance:write', 'audit:read',
    'phone:read', 'phone:create', 'phone:delete'
  ],
  supervisor: [
    'calls:read', 'calls:listen', 'calls:barge', 'calls:download',
    'analytics:read', 'crm:read', 'crm:write', 'governance:read',
    'audit:read', 'users:read'
  ],
  agent: [
    'calls:read', 'calls:listen', 'crm:read', 'crm:write'
  ],
  analyst: [
    'analytics:read', 'calls:read', 'crm:read', 'audit:read'
  ],
  viewer: [
    'agents:read', 'knowledge:read', 'calls:read', 'analytics:read', 'crm:read'
  ]
};

export const AuthProvider = ({ children, initialUser = null }) => {
  const [user, setUser] = useState(() => {
    if (initialUser) return initialUser;
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  });

  const [role, setRole] = useState(() => {
    const u = initialUser || JSON.parse(localStorage.getItem('user') || '{}');
    return (u?.role || 'owner').toLowerCase();
  });

  const [permissions, setPermissions] = useState(() => {
    const token = tokenStore.get();
    const payload = parseJwt(token);
    if (payload?.permissions && Array.isArray(payload.permissions) && payload.permissions.length > 0) {
      return payload.permissions;
    }
    const u = initialUser || JSON.parse(localStorage.getItem('user') || '{}');
    const uRole = (u?.role || 'owner').toLowerCase();
    return DEFAULT_ROLE_PERMISSIONS[uRole] || ['*'];
  });

  // Sync state when initialUser changes (e.g. from App.jsx getMe)
  useEffect(() => {
    if (initialUser) {
      setUser(initialUser);
      const userRole = (initialUser.role || 'owner').toLowerCase();
      setRole(userRole);

      if (initialUser.permissions && Array.isArray(initialUser.permissions)) {
        setPermissions(initialUser.permissions);
      } else {
        const token = tokenStore.get();
        const payload = parseJwt(token);
        if (payload?.permissions?.length) {
          setPermissions(payload.permissions);
        } else {
          setPermissions(DEFAULT_ROLE_PERMISSIONS[userRole] || ['*']);
        }
      }
    }
  }, [initialUser]);

  // Refresh profile & permissions from backend
  const refreshAuth = useCallback(async () => {
    if (isDemoMode()) return;
    try {
      const res = await getMe();
      if (res?.data) {
        const freshUser = res.data;
        setUser(freshUser);
        localStorage.setItem('user', JSON.stringify(freshUser));
        const userRole = (freshUser.role || 'owner').toLowerCase();
        setRole(userRole);
        if (freshUser.permissions?.length) {
          setPermissions(freshUser.permissions);
        } else {
          setPermissions(DEFAULT_ROLE_PERMISSIONS[userRole] || ['*']);
        }
      }
    } catch (e) {
      // Keep existing state if offline
    }
  }, []);

  // Listen to Supabase and token changes
  useEffect(() => {
    const token = tokenStore.get();
    if (token) {
      const payload = parseJwt(token);
      if (payload?.role) setRole(payload.role.toLowerCase());
      if (payload?.permissions?.length) setPermissions(payload.permissions);
    }
  }, []);

  /**
   * Evaluates if current user possesses a specific permission string
   * E.g. can('calls:barge'), can('agents:create')
   */
  const can = useCallback((requiredPermission) => {
    if (!requiredPermission) return true;
    const currentRole = (role || 'viewer').toLowerCase();

    // Owner and Superadmin possess total platform override
    if (currentRole === 'owner' || currentRole === 'superadmin') {
      return true;
    }

    if (permissions.includes('*')) {
      return true;
    }

    return permissions.includes(requiredPermission);
  }, [role, permissions]);

  const hasPermission = can;

  const isOwner = (role || '').toLowerCase() === 'owner';
  const isAdmin = isOwner || (role || '').toLowerCase() === 'admin' || (role || '').toLowerCase() === 'superadmin';
  const isSupervisor = isAdmin || (role || '').toLowerCase() === 'supervisor';

  const value = {
    user,
    role,
    permissions,
    can,
    hasPermission,
    isOwner,
    isAdmin,
    isSupervisor,
    refreshAuth,
    setUser,
    setRole
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    // Fallback safe dummy context if rendered outside provider
    return {
      user: null,
      role: 'owner',
      permissions: ['*'],
      can: () => true,
      hasPermission: () => true,
      isOwner: true,
      isAdmin: true,
      isSupervisor: true,
      refreshAuth: () => Promise.resolve()
    };
  }
  return context;
};

export default AuthContext;
