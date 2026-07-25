const { getTraceId } = require('./tracer');

class Logger {
  constructor(serviceName) {
    this.serviceName = serviceName;
  }

  log(level, message, meta = {}) {
    const traceId = getTraceId();
    const logEntry = {
      timestamp: new Date().toISOString(),
      service: this.serviceName,
      level,
      message,
      ...(traceId ? { traceId } : {}),
      ...meta
    };
    console.log(JSON.stringify(logEntry));
  }

  info(message, meta) { this.log('INFO', message, meta); }
  warn(message, meta) { this.log('WARN', message, meta); }
  error(message, meta) { this.log('ERROR', message, meta); }
  debug(message, meta) { this.log('DEBUG', message, meta); }
}

module.exports = Logger;
