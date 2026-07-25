const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const PolicyEvaluator = require('../../kernel/policy/evaluator');
const TenantGuard = require('../../kernel/identity/tenant-guard');
const TenantDb = require('../../kernel/identity/tenant-db');
const requestLogger = require('../../kernel/identity/request-logger');

const app = express();
app.use(cors());
app.use(express.json());
app.use(requestLogger);

const PORT = process.env.PORT || 6006;
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/markova' });
const tenantDb = new TenantDb(pool);

app.use('/api', TenantGuard);

app.post('/api/approval/evaluate', async (req, res) => {
  const ctx = req.securityContext;
  const { context, policyId } = req.body;

  if (!policyId) return res.status(400).json({ error: 'Policy ID required' });

  try {
    const result = await tenantDb.query(ctx, 'SELECT rules FROM policies WHERE id = $1 AND company_id = $2', [policyId, ctx.tenantId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Policy not found' });

    const rules = result.rows[0].rules;
    const evaluation = PolicyEvaluator.evaluate(context, rules);

    // If requires approval, would insert an approval request record here...
    
    res.json({ evaluation });
  } catch (error) {
    console.error('Evaluate error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'approval-service' });
});

app.listen(PORT, () => {
  console.log(`🚀 Approval Service listening on port ${PORT}`);
});
