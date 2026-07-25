const { EventTypes } = require('./registry');

function validateEvent(eventType, payload) {
  if (!Object.values(EventTypes).includes(eventType)) {
    throw new Error(`Unknown event type: ${eventType}`);
  }
  
  if (!payload.tenantId) {
    throw new Error(`Event ${eventType} is missing tenantId`);
  }
  
  return true;
}

module.exports = { validateEvent };
