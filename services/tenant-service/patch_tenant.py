with open('server.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Add requires
require_block = "const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_mock');\nconst cron = require('node-cron');\n"
if "const stripe =" not in content:
    content = content.replace("const uuid = require('uuid');", "const uuid = require('uuid');\n" + require_block)

# Add endpoints and cron job
endpoints = """
// ─── Phase 9: Billing Engine & White Labeling ──────────────────────────────────────────

app.post('/api/tenant/billing/portal', async (req, res) => {
  try {
    const ctx = req.securityContext;
    
    // Check if customer exists in companies
    const companyRes = await tenantDb.query(ctx, 'SELECT stripe_customer_id, name, billing_plan FROM companies WHERE id = ', [ctx.tenantId]);
    if (companyRes.rows.length === 0) return res.status(404).json({error: 'Company not found'});
    
    let stripeCustomerId = companyRes.rows[0].stripe_customer_id;
    if (!stripeCustomerId) {
      // Create Stripe Customer
      const customer = await stripe.customers.create({
        name: companyRes.rows[0].name,
        metadata: { companyId: ctx.tenantId }
      });
      stripeCustomerId = customer.id;
      await tenantDb.query(ctx, 'UPDATE companies SET stripe_customer_id =  WHERE id = ', [stripeCustomerId, ctx.tenantId]);
    }
    
    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: process.env.DASHBOARD_URL || 'http://localhost:3000',
    });
    
    res.json({ url: session.url });
  } catch (error) {
    console.error('Billing portal error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/tenant/white-label', async (req, res) => {
  try {
    const ctx = req.securityContext;
    const result = await tenantDb.query(ctx, 'SELECT custom_domain, white_label_enabled, custom_tts_voice_id FROM companies WHERE id = ', [ctx.tenantId]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Fetch white-label error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/tenant/white-label', async (req, res) => {
  try {
    const ctx = req.securityContext;
    const { custom_domain, white_label_enabled, custom_tts_voice_id } = req.body;
    
    await tenantDb.query(ctx, 
      'UPDATE companies SET custom_domain = , white_label_enabled = , custom_tts_voice_id =  WHERE id = ',
      [custom_domain, white_label_enabled, custom_tts_voice_id, ctx.tenantId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Update white-label error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Nightly cron job to sync usage metrics to Stripe
cron.schedule('59 23 * * *', async () => {
  console.log('Running nightly Stripe usage sync...');
  try {
    // 1. Get all usage_metrics from the last day
    const result = await pool.query(
      SELECT u.company_id, SUM(u.call_minutes) as total_minutes, c.stripe_customer_id
      FROM usage_metrics u
      JOIN companies c ON u.company_id = c.id
      WHERE u.created_at >= NOW() - INTERVAL '1 day'
      AND c.stripe_customer_id IS NOT NULL
      GROUP BY u.company_id, c.stripe_customer_id
    );
    
    for (const row of result.rows) {
      if (!row.stripe_customer_id || row.total_minutes <= 0) continue;
      
      // Look up subscriptions for this customer (In a real app, we'd cache this or store subscription_item_id)
      const subscriptions = await stripe.subscriptions.list({
        customer: row.stripe_customer_id,
        status: 'active',
        limit: 1
      });
      
      if (subscriptions.data.length > 0) {
        const subItem = subscriptions.data[0].items.data[0]; // Assume first item is usage-based
        if (subItem) {
          await stripe.subscriptionItems.createUsageRecord(
            subItem.id,
            { quantity: parseInt(row.total_minutes), timestamp: 'now', action: 'increment' }
          );
        }
      }
    }
  } catch (error) {
    console.error('Stripe usage sync failed:', error);
  }
});

"""

injection_point = "app.listen(port, () => {"
if "Billing Engine & White Labeling" not in content:
    content = content.replace(injection_point, endpoints + "\n" + injection_point)
    with open('server.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Patch successful")
else:
    print("Already patched")