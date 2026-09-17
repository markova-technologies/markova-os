import * as crypto from 'crypto';

/**
 * HMAC service-to-service auth header (matches kernel/identity/service-auth.js).
 * Format: `Service {serviceName}:{timestamp}:{signature}`
 */
export function generateServiceAuthHeader(serviceName: string): string {
  const secret =
    process.env.SERVICE_AUTH_SECRET ||
    process.env.JWT_SECRET ||
    'markova-service-auth-secret-change-in-prod';

  const timestamp = Date.now().toString();
  const payload = `${serviceName}:${timestamp}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return `Service ${serviceName}:${timestamp}:${signature}`;
}
