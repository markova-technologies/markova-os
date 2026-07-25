/**
 * Shared input validation for Markova microservices.
 * Uses lightweight hand-written validators (no external deps) to avoid
 * pulling in Zod/Joi into every service image.
 *
 * Usage:
 *   const { validate, schemas } = require('../../packages/shared-validation');
 *   app.post('/api/agents', validate(schemas.createAgent), handler);
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Primitive validators
// ─────────────────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isUUID(v)   { return typeof v === 'string' && UUID_RE.test(v); }
function isEmail(v)  { return typeof v === 'string' && EMAIL_RE.test(v); }
function isString(v, min = 1, max = 4096) {
  return typeof v === 'string' && v.length >= min && v.length <= max;
}
function isInt(v, min = 0, max = Number.MAX_SAFE_INTEGER) {
  return Number.isInteger(v) && v >= min && v <= max;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation rule runner
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Runs a schema (plain object of field → validator fn) against a body.
 * Returns { valid, errors } — errors is an array of strings.
 */
function runSchema(schema, body) {
  const errors = [];
  for (const [field, validator] of Object.entries(schema)) {
    const result = validator(body[field], body);
    if (result !== true) {
      errors.push(result || `Invalid value for field: ${field}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Express middleware factory. Pass a schema object.
 * Responds 400 with { error, details } on validation failure.
 */
function validate(schema) {
  return (req, res, next) => {
    const { valid, errors } = runSchema(schema, req.body);
    if (!valid) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors
      });
    }
    next();
  };
}

/**
 * Validate query params instead of body.
 */
function validateQuery(schema) {
  return (req, res, next) => {
    const { valid, errors } = runSchema(schema, req.query);
    if (!valid) {
      return res.status(400).json({ error: 'Invalid query parameters', details: errors });
    }
    next();
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared schemas
// ─────────────────────────────────────────────────────────────────────────────

const schemas = {

  // Auth
  register: {
    name:        v => isString(v, 1, 255)   || 'name must be a non-empty string (max 255)',
    companyName: v => isString(v, 1, 255)   || 'companyName must be a non-empty string (max 255)',
    email:       v => isEmail(v)            || 'email must be a valid email address',
    password:    v => isString(v, 8, 128)   || 'password must be at least 8 characters'
  },

  login: {
    email:    v => isEmail(v)          || 'email must be a valid email address',
    password: v => isString(v, 1, 128) || 'password is required'
  },

  // Agents
  createAgent: {
    name:           v => isString(v, 1, 255)  || 'name is required (max 255)',
    prompt:         v => isString(v, 1, 8000) || 'prompt is required (max 8000 chars)',
    voice_provider: v => isString(v, 1, 100)  || 'voice_provider is required',
    voice_id:       v => isString(v, 1, 100)  || 'voice_id is required',
    model_provider: v => isString(v, 1, 100)  || 'model_provider is required',
    model_id:       v => isString(v, 1, 100)  || 'model_id is required'
  },

  // Tools
  createTool: {
    name:        v => isString(v, 1, 100)  || 'name is required (max 100)',
    webhook_url: v => isString(v, 1, 2048) || 'webhook_url is required (max 2048)',
    description: v => (v === undefined || isString(v, 0, 2048)) || 'description must be a string (max 2048)',
    method:      v => (v === undefined || ['GET','POST','PUT','PATCH','DELETE'].includes(v))
                      || 'method must be GET, POST, PUT, PATCH, or DELETE'
  },

  // CRM Lead (public endpoint)
  contactLead: {
    firstName: v => isString(v, 1, 255) || 'firstName is required',
    lastName:  v => isString(v, 1, 255) || 'lastName is required',
    email:     v => isEmail(v)          || 'email must be valid',
    phone:     v => isString(v, 1, 50)  || 'phone is required'
  },

  // Pagination
  pagination: {
    limit:  v => (v === undefined || isInt(Number(v), 1, 200)) || 'limit must be an integer between 1 and 200',
    offset: v => (v === undefined || isInt(Number(v), 0))      || 'offset must be a non-negative integer'
  },

  // UUID param helper (use with validateQuery or manual check)
  uuidParam: (fieldName) => ({
    [fieldName]: v => isUUID(v) || `${fieldName} must be a valid UUID`
  }),
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  validate,
  validateQuery,
  runSchema,
  schemas,
  // Expose primitive validators for custom use
  validators: { isUUID, isEmail, isString, isInt }
};
