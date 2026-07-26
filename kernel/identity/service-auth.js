const crypto = require('crypto');

/**
 * Service-to-Service Authentication mechanism.
 * Uses a shared symmetric secret defined by SERVICE_AUTH_SECRET
 * to sign and verify internal requests between microservices.
 */
class ServiceAuth {
  constructor() {
    this.secret = process.env.SERVICE_AUTH_SECRET;
    if (!this.secret) {
      throw new Error('SERVICE_AUTH_SECRET must be set in the environment (no default)');
    }
  }

  /**
   * Generate an authentication header value for an outbound request.
   * Format: `Service {serviceName}:{timestamp}:{signature}`
   */
  generateHeader(serviceName) {
    const timestamp = Date.now().toString();
    const payload = `${serviceName}:${timestamp}`;
    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(payload)
      .digest('hex');
    
    return `Service ${serviceName}:${timestamp}:${signature}`;
  }

  /**
   * Express middleware to protect internal endpoints.
   * Ensures the request comes from a trusted internal service.
   */
  guard(req, res, next) {
    const authHeader = req.headers['x-service-auth'];
    if (!authHeader || !authHeader.startsWith('Service ')) {
      return res.status(401).json({ error: 'Service Authentication required for internal endpoint' });
    }

    try {
      const parts = authHeader.replace('Service ', '').split(':');
      if (parts.length !== 3) {
        throw new Error('Malformed service auth header');
      }

      const [serviceName, timestamp, providedSignature] = parts;

      // Prevent replay attacks (valid for 5 minutes)
      const now = Date.now();
      const timeDiff = now - parseInt(timestamp, 10);
      if (timeDiff > 5 * 60 * 1000 || timeDiff < -60000) {
        return res.status(401).json({ error: 'Service authentication token expired' });
      }

      const payload = `${serviceName}:${timestamp}`;
      const expectedSignature = crypto
        .createHmac('sha256', this.secret)
        .update(payload)
        .digest('hex');

      // Constant time comparison to prevent timing attacks
      const isValid = crypto.timingSafeEqual(
        Buffer.from(providedSignature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );

      if (!isValid) {
        return res.status(401).json({ error: 'Invalid service authentication signature' });
      }

      req.serviceIdentity = { name: serviceName };
      next();
    } catch (err) {
      console.error('ServiceAuth Error:', err.message);
      return res.status(401).json({ error: 'Service authentication failed' });
    }
  }

  /**
   * Helper to attach headers to an Axios config
   */
  inject(axiosConfig, sourceServiceName) {
    const headers = axiosConfig.headers || {};
    headers['x-service-auth'] = this.generateHeader(sourceServiceName);
    return { ...axiosConfig, headers };
  }
}

module.exports = new ServiceAuth();
