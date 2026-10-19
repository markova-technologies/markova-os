import { Request, Response } from 'express';
import * as proxy from 'express-http-proxy';

type RewriteFn = (url: string) => string;

/**
 * Proxy to an upstream service, optionally rewriting the path and
 * forwarding gateway tenant headers as x-company-id for Python services.
 */
export function proxyTo(
  targetUrl: string,
  req: Request,
  res: Response,
  rewrite?: RewriteFn,
) {
  const contentType = String(req.headers['content-type'] || '');
  const isMultipart = contentType.includes('multipart/form-data');

  const middleware = proxy(targetUrl, {
    // Let the raw stream through for file uploads (Nest/express must not re-serialize)
    parseReqBody: !isMultipart,
    proxyReqPathResolver: (request: Request) => {
      const url = request.url || '';
      return rewrite ? rewrite(url) : url;
    },
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      const headers = (proxyReqOpts.headers || {}) as Record<string, string>;

      // Security: Strip all untrusted internal/identity headers that might have been supplied by the client
      const internalHeaders = [
        'x-tenant-id',
        'x-company-id',
        'x-user-id',
        'x-role',
        'x-admin-role',
        'x-permissions',
        'x-subscription-plan',
        'x-gateway-sig',
        'x-gateway-timestamp',
        'x-service-auth',
        'x-markova-env',
      ];
      for (const h of internalHeaders) {
        delete headers[h];
      }

      // Forward pass-through client headers
      if (srcReq.headers['authorization']) {
        headers['authorization'] = srcReq.headers['authorization'] as string;
      }
      if (srcReq.headers['x-api-key']) {
        headers['x-api-key'] = srcReq.headers['x-api-key'] as string;
      }
      if (srcReq.headers['idempotency-key']) {
        headers['idempotency-key'] = srcReq.headers['idempotency-key'] as string;
      }
      if (srcReq.headers['x-idempotency-key']) {
        headers['x-idempotency-key'] = srcReq.headers['x-idempotency-key'] as string;
      }

      // Only forward identity headers if cryptographically signed by AuthMiddleware
      const gwSig = srcReq.headers['x-gateway-sig'] as string;
      const gwTs = srcReq.headers['x-gateway-timestamp'] as string;
      const tenantId =
        (srcReq.headers['x-tenant-id'] as string) ||
        (srcReq.headers['x-company-id'] as string);

      if (gwSig && gwTs && tenantId) {
        headers['x-gateway-sig'] = gwSig;
        headers['x-gateway-timestamp'] = gwTs;
        headers['x-tenant-id'] = tenantId;
        headers['x-company-id'] = tenantId;
        if (srcReq.headers['x-user-id']) {
          headers['x-user-id'] = srcReq.headers['x-user-id'] as string;
        }
        if (srcReq.headers['x-markova-env']) {
          headers['x-markova-env'] = srcReq.headers['x-markova-env'] as string;
        }
        if (srcReq.headers['x-role']) {
          headers['x-role'] = srcReq.headers['x-role'] as string;
        }
        if (srcReq.headers['x-admin-role']) {
          headers['x-admin-role'] = srcReq.headers['x-admin-role'] as string;
        }
        if (srcReq.headers['x-permissions']) {
          headers['x-permissions'] = srcReq.headers['x-permissions'] as string;
        }
        if (srcReq.headers['x-subscription-plan']) {
          headers['x-subscription-plan'] = srcReq.headers['x-subscription-plan'] as string;
        }
        if (srcReq.headers['x-session-id']) {
          headers['x-session-id'] = srcReq.headers['x-session-id'] as string;
        }
      }

      proxyReqOpts.headers = headers;
      return proxyReqOpts;
    },
    proxyErrorHandler: (err, proxyRes, _next) => {
      if (proxyRes && !proxyRes.headersSent) {
        proxyRes.status(502).json({
          statusCode: 502,
          error: 'Bad Gateway',
          message: `Upstream service at ${targetUrl} is unreachable or unavailable.`,
          details: err?.message || String(err),
        });
      }
    },
  });

  return middleware(req, res, (err?: any) => {
    if (err && !res.headersSent) {
      res.status(502).json({
        statusCode: 502,
        error: 'Bad Gateway',
        message: `Upstream service at ${targetUrl} is unreachable or unavailable.`,
        details: err?.message || String(err),
      });
    }
  });
}

