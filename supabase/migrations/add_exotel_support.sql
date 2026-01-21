-- ============================================
-- Migration: Add Exotel Support
-- Run this in your Supabase SQL Editor
-- ============================================

-- Add provider column to businesses table
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS provider VARCHAR(20) DEFAULT 'twilio';

-- Add comment
COMMENT ON COLUMN businesses.provider IS 'Telephony provider: twilio (international) or exotel (India)';

-- Add exotel_call_sid column to calls table (nullable, alongside twilio_call_sid)
ALTER TABLE calls 
ADD COLUMN IF NOT EXISTS exotel_call_sid VARCHAR(100);

-- Add provider column to calls table
ALTER TABLE calls 
ADD COLUMN IF NOT EXISTS provider VARCHAR(20) DEFAULT 'twilio';

-- Add index for exotel call lookups
CREATE INDEX IF NOT EXISTS idx_calls_exotel_sid ON calls(exotel_call_sid);

-- Update the unique constraint on calls to allow either twilio or exotel sid
-- First, drop the old unique constraint if it exists
ALTER TABLE calls DROP CONSTRAINT IF EXISTS calls_twilio_call_sid_key;

-- Make twilio_call_sid nullable (if it wasn't already)
ALTER TABLE calls ALTER COLUMN twilio_call_sid DROP NOT NULL;

-- Add a check constraint to ensure at least one call sid is provided
ALTER TABLE calls ADD CONSTRAINT calls_has_call_sid 
CHECK (twilio_call_sid IS NOT NULL OR exotel_call_sid IS NOT NULL);

-- ============================================
-- Verify the changes
-- ============================================
-- Run this to verify:
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'calls' AND column_name IN ('provider', 'exotel_call_sid', 'twilio_call_sid');
