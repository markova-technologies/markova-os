import { Injectable, NestMiddleware, HttpStatus, Inject } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { createClient } from 'redis';
import axios from 'axios';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { RateLimiterService } from './rate-limiter.service';
import { generateServiceAuthHeader } from './service-auth.util';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private redisClient;
  private TENANT_SERVICE_URL = process.env.TENANT_SERVICE_URL || 'http://tenant-service:5002';
  private pool: Pool;

  constructor(private readonly rateLimiter: RateLimiterService) {
    const redisUrl = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'redis'}:${process.env.REDIS_PORT || 6379}`;
    this.redisClient = createClient({
      url: redisUrl
    });
    this.redisClient.on('error', (err) => console.error('Redis Gateway Error', err));
    this.redisClient.connect().catch((err) => console.error('Failed to connect to Redis from Gateway:', err));
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
  }

  async use(req: Request, res: Response, next: NextFunction) {
    const path = req.path;
    
    // Generate a unique request ID for distributed tracing
    const requestId = req.headers['x-request-id'] as string || uuidv4();
    req.headers['x-request-id'] = requestId;
    res.setHeader('x-request-id', requestId);

    // 1. Skip Auth for Public Paths
    // Transition window: /api/auth/*, /v1/auth/*, and legacy /api/clients/* login/register
    const publicPaths = [
      /^\/api\/auth\/register$/,
      /^\/api\/auth\/login$/,
      /^\/api\/auth\/public-key$/,
      /^\/api\/auth\/refresh-token$/,
      /^\/v1\/auth\/register$/,
      /^\/v1\/auth\/login$/,
      /^\/v1\/auth\/refresh$/,
      /^\/v1\/auth\/public-key$/,
      /^\/api\/clients\/register$/,
      /^\/api\/clients\/login$/,
      /^\/incoming-call$/,
      /^\/handle-input$/,
      /^\/stream-response$/,
      /^\/twilio\//,
      /^\/health$/,
      /^\/api\/contact$/,
      /^\/openapi\.yaml$/,
      /^\/v1\/openapi\.yaml$/,
      /^\/docs\/?$/,
      /^\/v1\/docs\/?$/,
      /^\/pricing\/?$/,
      /^\/v1\/pricing\/?$/,
      /^\/v1\/billing\/webhooks\/[^/]+$/
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
        const secret = process.env.SUPABASE_JWT_SECRET;
        if (!secret) throw new Error("SUPABASE_JWT_SECRET is missing");
        
        // Decode without verification first to check audience for routing
        const unverifiedDecoded = jwt.decode(token) as any;
        const aud = unverifiedDecoded?.aud;
        const isAdminRoute = path.startsWith('/v1/admin') || path.startsWith('/api/admin');
        const isClientRoute = path.startsWith('/v1/client') || path.startsWith('/api/client') || path.startsWith('/api/tenant');

        if (isAdminRoute && aud !== 'admin') {
          return res.status(HttpStatus.FORBIDDEN).json({ error: 'Forbidden: Admin token required for this route' });
        }
        if (isClientRoute && aud === 'admin') {
          return res.status(HttpStatus.FORBIDDEN).json({ error: 'Forbidden: Cannot use admin token for client routes' });
        }

        // Now verify with the appropriate audience (if Supabase allows custom aud, otherwise we just check the claim)
        const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as any;
        
        const userId = decoded.sub;
        let dbUser = null;
        
        const cachedUser = await this.redisClient.get(`user_cache:${userId}`);
        if (cachedUser) {
          dbUser = JSON.parse(cachedUser);
        } else {
          const result = await this.pool.query('SELECT company_id, role FROM public.users WHERE id = $1', [userId]);
          dbUser = result.rows[0];
          if (dbUser) {
            await this.redisClient.setEx(`user_cache:${userId}`, 3600, JSON.stringify(dbUser));
          }
        }
        
        // For admin tokens, dbUser might not exist in public.users if they are managed separately, 
        // but assuming they do for now or we rely on decoded claims.
        if (!dbUser && aud !== 'admin') {
          return res.status(HttpStatus.UNAUTHORIZED).json({ error: 'User record not found in database' });
        }

        tenantContext = {
          tenantId: dbUser?.company_id || decoded.company_id,
          userId: userId,
          role: dbUser?.role || decoded.role,
          permissions: decoded.permissions || [],
          subscriptionPlan: 'starter',
          environment: (req.headers['x-markova-env'] as string) === 'live' ? 'live' : 'test',
          aud: aud,
        };
      } catch (err) {
        return res.status(HttpStatus.UNAUTHORIZED).json({ error: 'Token invalid or expired' });
      }
    }

    // 3. Authenticate via Tenant API Key (x-api-key Header)
    const apiKey = req.headers['x-api-key'] as string;
    if (!tenantContext.tenantId && apiKey) {
      try {
        const response = await axios.post(
          `${this.TENANT_SERVICE_URL}/api/tenant/keys/verify`,
          { apiKey },
          {
            headers: {
              'x-service-auth': generateServiceAuthHeader('api-gateway'),
              'content-type': 'application/json',
            },
          },
        );
        if (response.data.valid) {
          tenantContext = {
            tenantId: response.data.companyId,
            userId: 'api-key-auth',
            role: 'api',
            permissions: ['*'],
            subscriptionPlan: response.data.plan || 'starter',
            environment: response.data.environment || (apiKey.startsWith('mk_live_') ? 'live' : 'test'),
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
    // Sandbox vs live — services branch on this header (Phase 2)
    req.headers['x-markova-env'] = tenantContext.environment || 'test';
    req.headers['x-company-id'] = tenantContext.tenantId;

    // Sandbox guard: live-only destructive telephony blocked for test keys
    const env = tenantContext.environment || 'test';
    const isTestCall = /^\/v1\/agents\/[^/]+\/test-call$/.test(path);
    if (isTestCall && env === 'live') {
      return res.status(403).json({
        error: 'test-call is sandbox-only. Use a mk_test_ API key.',
        requestId,
      });
    }

    // Admin APIs Authorization & Zero Trust Check
    if (path.startsWith('/v1/admin') || path.startsWith('/api/admin')) {
      // 1. Cloudflare Access Check
      const cfAccessHeader = req.headers['cf-access-jwt-assertion'];
      if (!cfAccessHeader && process.env.NODE_ENV === 'production') {
        return res.status(HttpStatus.FORBIDDEN).json({
          error: 'Forbidden: Zero Trust Network Access required.',
          requestId,
        });
      }

      // 2. Role Check (Only specific admin roles)
      const allowedAdminRoles = ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'SUPPORT_ADMIN', 'BILLING_ADMIN', 'DEVELOPER'];
      const userRole = (tenantContext.role || '').toUpperCase();
      
      if (!allowedAdminRoles.includes(userRole)) {
        return res.status(HttpStatus.FORBIDDEN).json({
          error: 'Forbidden: Admin access required',
          requestId,
        });
      }
      
      // Inject admin role specifically
      req.headers['x-admin-role'] = userRole;
    }

    next();
  }
}
