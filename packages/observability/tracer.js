const { v4: uuidv4 } = require('uuid');
const { AsyncLocalStorage } = require('async_hooks');

const asyncLocalStorage = new AsyncLocalStorage();

function middleware(req, res, next) {
  const traceId = req.headers['x-trace-id'] || uuidv4();
  req.traceId = traceId;
  res.setHeader('x-trace-id', traceId);

  asyncLocalStorage.run(new Map([['traceId', traceId]]), () => {
    next();
  });
}

function getTraceId() {
  const store = asyncLocalStorage.getStore();
  return store ? store.get('traceId') : null;
}

module.exports = { middleware, getTraceId, asyncLocalStorage };
