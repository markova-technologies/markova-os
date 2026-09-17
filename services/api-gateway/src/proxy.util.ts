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

  return proxy(targetUrl, {
    // Let the raw stream through for file uploads (Nest/express must not re-serialize)
    parseReqBody: !isMultipart,
    proxyReqPathResolver: (request: Request) => {
      const url = request.url || '';
      return rewrite ? rewrite(url) : url;
    },
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      const headers = (proxyReqOpts.headers || {}) as Record<string, string>;
      const tenantId =
        (srcReq.headers['x-tenant-id'] as string) ||
        (srcReq.headers['x-company-id'] as string);
      if (tenantId) {
        headers['x-tenant-id'] = tenantId;
        headers['x-company-id'] = tenantId;
      }
      if (srcReq.headers['x-user-id']) {
        headers['x-user-id'] = srcReq.headers['x-user-id'] as string;
      }
      if (srcReq.headers['x-markova-env']) {
        headers['x-markova-env'] = srcReq.headers['x-markova-env'] as string;
      }
      if (srcReq.headers['authorization']) {
        headers['authorization'] = srcReq.headers['authorization'] as string;
      }
      if (srcReq.headers['x-gateway-timestamp']) {
        headers['x-gateway-timestamp'] = srcReq.headers['x-gateway-timestamp'] as string;
      }
      if (srcReq.headers['x-gateway-sig']) {
        headers['x-gateway-sig'] = srcReq.headers['x-gateway-sig'] as string;
      }
      if (srcReq.headers['x-role']) {
        headers['x-role'] = srcReq.headers['x-role'] as string;
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
      if (srcReq.headers['x-admin-role']) {
        headers['x-admin-role'] = srcReq.headers['x-admin-role'] as string;
      }
      if (srcReq.headers['x-api-key']) {
        headers['x-api-key'] = srcReq.headers['x-api-key'] as string;
      }
      proxyReqOpts.headers = headers;
      return proxyReqOpts;
    },
  })(req, res);
}
