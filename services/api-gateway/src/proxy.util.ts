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
      proxyReqOpts.headers = headers;
      return proxyReqOpts;
    },
  })(req, res);
}
