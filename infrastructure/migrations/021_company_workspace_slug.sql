-- 021_company_workspace_slug.sql
-- Adds workspace slug and company logo for organization-scoped workspace URLs

BEGIN;

-- 1. Add slug and logo_url to companies
ALTER TABLE companies 
    ADD COLUMN IF NOT EXISTS slug VARCHAR(63),
    ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- 2. Function to generate a clean URL slug from company name
CREATE OR REPLACE FUNCTION generate_company_slug(company_name TEXT) 
RETURNS TEXT AS $$
DECLARE
    clean_slug TEXT;
BEGIN
    -- Lowercase, replace non-alphanumeric with hyphens, strip leading/trailing hyphens
    clean_slug := lower(regexp_replace(company_name, '[^a-zA-Z0-9]+', '-', 'g'));
    clean_slug := trim(both '-' from clean_slug);
    
    -- Fallback if name was entirely symbols
    IF clean_slug IS NULL OR clean_slug = '' THEN
        clean_slug := 'workspace';
    END IF;
    
    RETURN substring(clean_slug from 1 for 60);
END;
$$ LANGUAGE plpgsql;

-- 3. Backfill existing companies with slugs if null
DO $$
DECLARE
    rec RECORD;
    base_slug TEXT;
    candidate_slug TEXT;
    suffix INT;
BEGIN
    FOR rec IN SELECT id, name FROM companies WHERE slug IS NULL OR slug = '' LOOP
        base_slug := generate_company_slug(rec.name);
        candidate_slug := base_slug;
        suffix := 2;

        -- Handle potential slug duplicates by appending -2, -3, etc.
        WHILE EXISTS (SELECT 1 FROM companies WHERE slug = candidate_slug AND id <> rec.id) LOOP
            candidate_slug := base_slug || '-' || suffix;
            suffix := suffix + 1;
        END LOOP;

        UPDATE companies SET slug = candidate_slug WHERE id = rec.id;
    END LOOP;
END $$;

-- 4. Enforce unique index and not-null on slug
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_slug ON companies(slug);

COMMENT ON COLUMN companies.slug IS 'Unique URL slug for company-scoped workspace access (e.g. acme-corp)';
COMMENT ON COLUMN companies.logo_url IS 'Custom logo URL for company workspace branding';

COMMIT;
