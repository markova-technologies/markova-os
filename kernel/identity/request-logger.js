/**
 * Express Middleware for Tenant-Aware Request Logging
 * Logs all incoming HTTP requests with context and redacts sensitive data.
 */

const sensitiveFields = ['password', 'token', 'authorization', 'secret', 'apikey', 'x-api-key'];

function redact(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  
  const redacted = Array.isArray(obj) ? [] : {};
  for (const [key, value] of Object.entries(obj)) {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object') {
      redacted[key] = redact(value);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

function requestLogger(req, res, next) {
  const startTime = Date.now();
  
  // Wait for the request to finish to log the status and latency
  res.on('finish', () => {
    const latency = Date.now() - startTime;
    const ctx = req.securityContext || {};
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      trace_id: ctx.traceId || req.headers['x-trace-id'] || 'unknown',
      tenant_id: ctx.tenantId || req.headers['x-tenant-id'] || 'unauthenticated',
      user_id: ctx.userId || req.headers['x-user-id'] || 'unauthenticated',
      method: req.method,
      path: req.originalUrl || req.url,
      status: res.statusCode,
      latency_ms: latency,
      ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
      user_agent: req.headers['user-agent'] || 'unknown'
    };

    // Log request body if it failed (useful for debugging, but redact sensitive info)
    if (res.statusCode >= 400 && req.body && Object.keys(req.body).length > 0) {
      logEntry.body = redact(req.body);
    }

    // In a production system, this could be sent to ELK/CloudWatch via stdout or EventBus
    // For now, we write structured JSON to stdout
    console.log(JSON.stringify(logEntry));
  });

  next();
}

module.exports = requestLogger;
