-- 018_white_labeling.sql
BEGIN;

ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS custom_domain TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS white_label_enabled BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS custom_tts_voice_id TEXT;

COMMIT;
