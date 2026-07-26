-- Phase 4: numbers settings, call handoff context, workflow confidence thresholds

ALTER TABLE phone_numbers
  ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS transfer_context JSONB,
  ADD COLUMN IF NOT EXISTS phone_number_id UUID REFERENCES phone_numbers(id) ON DELETE SET NULL;

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS workflow_settings JSONB NOT NULL DEFAULT '{
    "confidence_thresholds": {
      "default": 0.85,
      "refund": 0.95,
      "update_address": 0.70,
      "update_contact": 0.75
    }
  }'::jsonb;

-- Ensure routing_rules.rules is never null for new rows
ALTER TABLE routing_rules
  ALTER COLUMN rules SET DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_routing_rules_phone ON routing_rules (phone_number_id);
-- Vector ANN indexes can be added once tenants have enough embedded chunks.
