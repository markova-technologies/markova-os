const express = require('express');
const { Pool } = require('pg');
const CostEngine = require('../../kernel/billing/cost-engine');
const MeteringEngine = require('../../kernel/billing/metering');
const FeatureFlags = require('../../kernel/billing/feature-flags');
const { PlanManager } = require('../../kernel/billing/plans');
const TenantGuard = require('../../kernel/identity/tenant-guard');
const TenantDb = require('../../kernel/identity/tenant-db');
const serviceAuth = require('../../kernel/identity/service-auth');
const requestLogger = require('../../kernel/identity/request-logger');
require('dotenv').config();

const app = express();
app.use(requestLogger);
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const tenantDb = new TenantDb(pool);

// Internal service auth guard for specific internal routes
const internalGuard = serviceAuth.guard.bind(serviceAuth);

// Main tenant security guard for all other API routes
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/api/billing/internal') || req.path.startsWith('/api/billing/webhooks')) {
    return next();
  }
  TenantGuard(req, res, next);
});

const costEngine = new CostEngine(pool);
const metering = new MeteringEngine(pool);
const featureFlags = new FeatureFlags(pool);

// Get current billing metrics and unbilled line items
app.get('/api/billing/invoice', async (req, res) => {
  try {
    const ctx = req.securityContext;
    const usage = await tenantDb.query(ctx, `SELECT * FROM usage_limits WHERE company_id = $1`, [ctx.tenantId]);
    const lineItems = await tenantDb.query(ctx, `SELECT * FROM billing_line_items WHERE company_id = $1 AND status = 'unbilled'`, [ctx.tenantId]);
    const costLogs = await tenantDb.query(ctx, `SELECT SUM(final_billed_usd) as total_ai_cost FROM ai_cost_logs WHERE company_id = $1`, [ctx.tenantId]);

    res.json({
      usage: usage.rows,
      lineItems: lineItems.rows,
      totalUnbilledAiCost: costLogs.rows[0].total_ai_cost || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Internal endpoint: Used by AI runtime to log token usage
app.post('/api/billing/internal/log-cost', internalGuard, async (req, res) => {
  const { tenantId, agentId, modelName, provider, promptTokens, completionTokens, traceId } = req.body;
  try {
    const result = await costEngine.calculateAndLogCost(
      tenantId, agentId, modelName, provider, promptTokens, completionTokens, traceId
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Setup Stripe Mock Webhook
app.post('/api/billing/webhooks/stripe', (req, res) => {
  // In real implementation, this validates Stripe signature and updates billing status
  res.json({ received: true });
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'billing-service' });
});

const PORT = process.env.PORT || 5007;
app.listen(PORT, () => console.log(`Billing Service running on port ${PORT}`));
