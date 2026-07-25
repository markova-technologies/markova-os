class ConnectorInterface {
  constructor(options = {}) {
    this.allowedScopes = options.allowedScopes || [];
    this.rateLimits = options.rateLimits || { requestsPerMinute: 60 };
    this.auditLogger = options.auditLogger;
  }

  _checkScope(scope) {
    if (!this.allowedScopes.includes(scope) && !this.allowedScopes.includes('*')) {
      throw new Error(`Sandboxing Error: Connector not authorized for scope '${scope}'`);
    }
  }

  async connect(config) {
    this._checkScope('connect');
    throw new Error('Not implemented');
  }

  async syncDown(config, lastSyncToken) {
    this._checkScope('read');
    throw new Error('Not implemented');
  }

  async syncUp(config, records) {
    this._checkScope('write');
    throw new Error('Not implemented');
  }
}

module.exports = ConnectorInterface;
