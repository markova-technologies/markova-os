import * as jwt from 'jsonwebtoken';

export interface DecodedToken {
  id: string;
  company_id: string;
  role: string;
  email: string;
  [key: string]: any;
}

/**
 * Verify a JWT token and return the decoded payload
 */
export function verifyToken(token: string, secret: string): DecodedToken | null {
  try {
    return jwt.verify(token, secret) as DecodedToken;
  } catch (error) {
    return null;
  }
}

/**
 * Extract company ID from a token
 */
export function extractCompanyId(token: string, secret: string): string | null {
  const decoded = verifyToken(token, secret);
  return decoded ? decoded.company_id : null;
}

/**
 * Role-based permission checker
 */
export function hasPermission(token: string, secret: string, requiredRole: string): boolean {
  const decoded = verifyToken(token, secret);
  if (!decoded) return false;

  const rolesHierarchy = ['member', 'admin', 'owner'];
  const userRoleIndex = rolesHierarchy.indexOf(decoded.role || 'member');
  const requiredRoleIndex = rolesHierarchy.indexOf(requiredRole);

  return userRoleIndex >= requiredRoleIndex;
}

/**
 * Decode token payload without verifying signature (for client-side use)
 */
export function decodeTokenPayload(token: string): DecodedToken | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (error) {
    return null;
  }
}

/**
 * Generate a standard API key prefix
 */
export function generateApiKeyPrefix(environment: 'live' | 'test' = 'live'): string {
  return `mk_${environment}_`;
}

export * from './crypto';
