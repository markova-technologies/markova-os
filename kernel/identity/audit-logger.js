const { v4: uuidv4 } = require('uuid');

class AuditLogger {
  constructor(pool, eventBus) {
    this.pool = pool;
    this.eventBus = eventBus;
  }

  async log(context, action, entityType, entityId, oldVal = null, newVal = null, reason = '', category = 'GENERAL') {
    const correlationId = uuidv4();

    const payload = {
      company_id: context.tenantId,
      user_id: context.userId,
      session_id: context.sessionId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      ip_address: context.ipAddress,
      device_info: context.deviceId,
      old_value: oldVal ? JSON.stringify(oldVal) : null,
      new_value: newVal ? JSON.stringify(newVal) : null,
      reason,
      correlation_id: correlationId,
      trace_id: context.traceId,
      category,
      timestamp: new Date().toISOString()
    };

    // 1. Fire-and-forget to EventBus (primary path — async, non-blocking)
    if (this.eventBus) {
      this.eventBus.publish('audit.logged', payload)
        .catch(err => console.error('Failed to publish audit event:', err.message));
    }

    // 2. Write directly to DB as durable backup
    this.pool.query(
      `INSERT INTO audit_logs (
        company_id, user_id, session_id, action, entity_type, entity_id, 
        ip_address, device_info, old_value, new_value, reason, correlation_id, trace_id, immutable
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true)`,
      [
        payload.company_id, payload.user_id, payload.session_id, payload.action, 
        payload.entity_type, payload.entity_id, payload.ip_address, payload.device_info, 
        payload.old_value, payload.new_value, payload.reason, payload.correlation_id, payload.trace_id
      ]
    ).catch(err => console.error('Failed to write audit log to DB:', err.message));

    return correlationId;
  }

  async logSecurityEvent(context, action, entityType, entityId, reason = '') {
    return this.log(context, action, entityType, entityId, null, null, reason, 'SECURITY_EVENT');
  }

  /**
   * Returns a structured log object suitable for ELK/CloudWatch.
   */
  static structuredLog(level, message, meta = {}) {
    return JSON.stringify({
      '@timestamp': new Date().toISOString(),
      level,
      message,
      service: process.env.SERVICE_NAME || 'markova',
      ...meta
    });
  }
}

module.exports = AuditLogger;
