import { Injectable, NestMiddleware, HttpStatus, Inject } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { createClient } from 'redis';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { RateLimiterService } from './rate-limiter.service';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private redisClient;
  private AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:5001';
  private TENANT_SERVICE_URL = process.env.TENANT_SERVICE_URL || 'http://tenant-service:5002';
  private cachedPublicKey: string | null = null;
  
  private async getPublicKey(): Promise<string> {
    if (this.cachedPublicKey) return this.cachedPublicKey;
    try {
      const response = await axios.get(`${this.AUTH_SERVICE_URL}/api/auth/public-key`);
      this.cachedPublicKey = response.data.publicKey;
      return this.cachedPublicKey;
    } catch (err) {
      console.error('Failed to fetch public key from Auth Service:', err.message);
      throw new Error('Authentication unavailable');
    }
  }

  constructor(private readonly rateLimiter: RateLimiterService) {
    this.redisClient = createClient({
      url: `redis://${process.env.REDIS_HOST || 'redis'}:${process.env.REDIS_PORT || 6379}`
    });
    this.redisClient.on('error', (err) => console.error('Redis Gateway Error', err));
    this.redisClient.connect().catch((err) => console.error('Failed to connect to Redis from Gateway:', err));
  }

  async use(req: Request, res: Response, next: NextFunction) {
    const path = req.path;
    
    // Generate a unique request ID for distributed tracing
    const requestId = req.headers['x-request-id'] as string || uuidv4();
    req.headers['x-request-id'] = requestId;
    res.setHeader('x-request-id', requestId);

    // 1. Skip Auth for Public Paths
    const publicPaths = [
      /^\/api\/auth\/register$/,
      /^\/api\/auth\/login$/,
      /^\/incoming-call$/,
      /^\/handle-input$/,
      /^\/stream-response$/,
      /^\/health$/,
      /^\/api\/contact$/
    ];

    if (publicPaths.some(regex => regex.test(path))) {
      return next();
    }

    let tenantContext: any = {};

    // 2. Authenticate via JWT (Authorization Header)
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const publicKey = await this.getPublicKey();
        const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] }) as any;
        
        // Check session revocation in Redis
        if (decoded.sessionId) {
          const isRevoked = await this.redisClient.get(`session_revoked:${decoded.sessionId}`);
          if (isRevoked) {
            return res.status(HttpStatus.UNAUTHORIZED).json({ error: 'Session has been revoked' });
          }
        }

        tenantContext = {
          tenantId: decoded.companyId,
          userId: decoded.userId,
          sessionId: decoded.sessionId,
          role: decoded.role,
          permissions: decoded.permissions || [],
          subscriptionPlan: decoded.subscriptionPlan
        };
      } catch (err) {
        return res.status(HttpStatus.UNAUTHORIZED).json({ error: 'Token invalid or expired' });
      }
    }

    // 3. Authenticate via Tenant API Key (x-api-key Header)
    const apiKey = req.headers['x-api-key'] as string;
    if (!tenantContext.tenantId && apiKey) {
      try {
        const response = await axios.post(`${this.TENANT_SERVICE_URL}/api/tenant/keys/verify`, { apiKey });
        if (response.data.valid) {
          tenantContext = {
            tenantId: response.data.companyId,
            userId: 'api-key-auth',
            role: 'api',
            permissions: ['*'],
            subscriptionPlan: response.data.plan || 'starter'
          };
        } else {
          return res.status(HttpStatus.FORBIDDEN).json({ error: 'Invalid API Key' });
        }
      } catch (err) {
        console.error('Failed to communicate with tenant-service for API key validation:', err.message);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Authentication service unavailable' });
      }
    }

    // Block if unauthorized
    if (!tenantContext.tenantId) {
      return res.status(HttpStatus.UNAUTHORIZED).json({ error: 'Unauthorized: Missing credentials' });
    }

    // 4. Plan-Aware Rate Limiting via RateLimiterService
    const isLimited = await this.rateLimiter.isRateLimited(
      tenantContext.tenantId,
      tenantContext.subscriptionPlan || 'starter'
    );
    if (isLimited) {
      return res.status(HttpStatus.TOO_MANY_REQUESTS).json({
        error: 'Rate limit exceeded. Upgrade your plan for higher limits.',
        requestId
      });
    }

    // 5. Inject headers downstream to be parsed by TenantGuard in services
    req.headers['x-tenant-id'] = tenantContext.tenantId;
    req.headers['x-user-id'] = tenantContext.userId;
    if (tenantContext.sessionId) req.headers['x-session-id'] = tenantContext.sessionId;
    if (tenantContext.role) req.headers['x-role'] = tenantContext.role;
    if (tenantContext.permissions && tenantContext.permissions.length > 0) {
      req.headers['x-permissions'] = tenantContext.permissions.join(',');
    }
    if (tenantContext.subscriptionPlan) req.headers['x-subscription-plan'] = tenantContext.subscriptionPlan;

    next();
  }
}
