const { v4: uuidv4 } = require('uuid');

class SecurityContext {
  constructor({
    tenantId,
    organizationId,
    userId,
    role,
    permissions = [],
    subscriptionPlan = 'starter',
    apiKeyId,
    sessionId,
    traceId,
    deviceId,
    ipAddress,
    departmentId,
    isServiceAccount = false
  }) {
    this.tenantId = tenantId;
    this.organizationId = organizationId; // For Phase 2 (Departments)
    this.userId = userId;
    this.role = role;
    this.permissions = permissions;
    this.subscriptionPlan = subscriptionPlan;
    this.apiKeyId = apiKeyId;
    this.sessionId = sessionId;
    this.traceId = traceId || uuidv4();
    this.deviceId = deviceId;
    this.ipAddress = ipAddress;
    this.departmentId = departmentId;
    this.isServiceAccount = isServiceAccount;
  }

  static fromJWT(decoded, req) {
    return new SecurityContext({
      tenantId: decoded.companyId,
      userId: decoded.userId,
      role: decoded.role,
      permissions: decoded.permissions || [],
      subscriptionPlan: decoded.subscriptionPlan || 'starter',
      sessionId: decoded.sessionId,
      traceId: req.headers['x-trace-id'] || uuidv4(),
      ipAddress: req.ip || req.headers['x-forwarded-for'],
      deviceId: req.headers['x-device-id']
    });
  }

  static fromApiKey(keyRecord, req) {
    return new SecurityContext({
      tenantId: keyRecord.company_id,
      subscriptionPlan: keyRecord.plan || 'starter',
      apiKeyId: keyRecord.id,
      role: 'api',
      permissions: ['*'], // Usually API keys have full scope, or scoped by DB
      traceId: req.headers['x-trace-id'] || uuidv4(),
      ipAddress: req.ip || req.headers['x-forwarded-for'],
    });
  }

  validate() {
    if (!this.tenantId && !this.isServiceAccount) {
      throw new Error('TenantContextMissing: SecurityContext must have a tenantId or be a service account');
    }
  }

  toHeaders() {
    const headers = {
      'x-tenant-id': this.tenantId || '',
      'x-user-id': this.userId || '',
      'x-session-id': this.sessionId || '',
      'x-role': this.role || '',
      'x-permissions': this.permissions.join(','),
      'x-trace-id': this.traceId || '',
      'x-subscription-plan': this.subscriptionPlan || 'starter'
    };
    if (this.departmentId) headers['x-department-id'] = this.departmentId;
    if (this.isServiceAccount) headers['x-service-account'] = 'true';
    return headers;
  }

  toAuditRecord() {
    return {
      tenantId: this.tenantId,
      userId: this.userId,
      sessionId: this.sessionId,
      role: this.role,
      ipAddress: this.ipAddress,
      deviceId: this.deviceId,
      traceId: this.traceId,
      isServiceAccount: this.isServiceAccount
    };
  }
}

module.exports = SecurityContext;
