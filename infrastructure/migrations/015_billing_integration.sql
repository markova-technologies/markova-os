BEGIN;

ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
    ADD COLUMN IF NOT EXISTS billing_plan TEXT DEFAULT 'starter',  
    ADD COLUMN IF NOT EXISTS plan_call_limit INTEGER DEFAULT 1000,
    ADD COLUMN IF NOT EXISTS billing_cycle_start TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_companies_stripe 
    ON companies(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- Billing plans: starter (1k mins), pro (10k mins), enterprise (unlimited)
COMMENT ON COLUMN companies.billing_plan IS 'starter | pro | enterprise';
COMMENT ON COLUMN companies.plan_call_limit IS 'Monthly call minute limit. -1 = unlimited.';

COMMIT;
