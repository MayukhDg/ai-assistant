-- ============================================
-- AI Voice Receptionist - Database Schema
-- Multi-tenant SaaS for SMB appointment booking
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- BUSINESSES (Tenants)
-- ============================================
CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic Info
  name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) UNIQUE, -- Twilio number assigned to this business
  timezone VARCHAR(50) DEFAULT 'America/New_York',
  
  -- AI Configuration
  business_type VARCHAR(100), -- e.g., 'dental_clinic', 'salon', 'consultant'
  system_prompt TEXT, -- Custom AI personality/instructions
  greeting_message TEXT DEFAULT 'Hello! Thank you for calling. How can I help you today?',
  
  -- Working Hours (JSON: { "monday": { "start": "09:00", "end": "17:00" }, ... })
  working_hours JSONB DEFAULT '{
    "monday": { "start": "09:00", "end": "17:00", "enabled": true },
    "tuesday": { "start": "09:00", "end": "17:00", "enabled": true },
    "wednesday": { "start": "09:00", "end": "17:00", "enabled": true },
    "thursday": { "start": "09:00", "end": "17:00", "enabled": true },
    "friday": { "start": "09:00", "end": "17:00", "enabled": true },
    "saturday": { "start": "10:00", "end": "14:00", "enabled": false },
    "sunday": { "start": "10:00", "end": "14:00", "enabled": false }
  }'::jsonb,
  
  -- Booking Settings
  slot_duration_minutes INT DEFAULT 30,
  buffer_minutes INT DEFAULT 10,
  max_advance_days INT DEFAULT 30, -- How far in advance can book
  
  -- Fallback Settings
  fallback_phone VARCHAR(20), -- Transfer to human if needed
  fallback_enabled BOOLEAN DEFAULT true,
  
  -- Billing
  plan VARCHAR(50) DEFAULT 'free', -- 'free', 'starter', 'pro', 'enterprise'
  calls_this_month INT DEFAULT 0,
  bookings_this_month INT DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for looking up business by phone number (Twilio webhook)
CREATE INDEX idx_businesses_phone ON businesses(phone_number);
CREATE INDEX idx_businesses_user ON businesses(user_id);

-- ============================================
-- SERVICES (What the business offers)
-- ============================================
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  name VARCHAR(255) NOT NULL,
  description TEXT,
  duration_minutes INT NOT NULL DEFAULT 30,
  price_cents INT, -- Price in cents (e.g., 5000 = $50.00)
  
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_services_business ON services(business_id);

-- ============================================
-- CUSTOMERS (Callers)
-- ============================================
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  phone VARCHAR(20) NOT NULL,
  name VARCHAR(255),
  email VARCHAR(255),
  
  notes TEXT, -- Any notes about this customer
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(business_id, phone)
);

CREATE INDEX idx_customers_business ON customers(business_id);
CREATE INDEX idx_customers_phone ON customers(phone);

-- ============================================
-- APPOINTMENTS
-- ============================================
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  call_id UUID, -- Will reference calls table
  
  -- Appointment Details
  customer_name VARCHAR(255),
  customer_phone VARCHAR(20) NOT NULL,
  customer_email VARCHAR(255),
  
  -- Timing
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 30,
  
  -- Status: 'pending', 'confirmed', 'cancelled', 'completed', 'no_show'
  status VARCHAR(50) DEFAULT 'confirmed',
  
  -- Additional Info
  notes TEXT,
  confirmation_sent BOOLEAN DEFAULT false,
  reminder_sent BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_appointments_business ON appointments(business_id);
CREATE INDEX idx_appointments_scheduled ON appointments(scheduled_at);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_customer_phone ON appointments(customer_phone);

-- ============================================
-- CALLS (Call Logs)
-- ============================================
CREATE TABLE calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  
  -- Twilio Data
  twilio_call_sid VARCHAR(100) UNIQUE,
  from_number VARCHAR(20) NOT NULL,
  to_number VARCHAR(20) NOT NULL,
  
  -- Call Details
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INT,
  
  -- AI Processing
  transcript TEXT, -- Full conversation transcript
  summary TEXT, -- AI-generated summary
  
  -- Outcome: 'booked', 'rescheduled', 'cancelled', 'inquiry', 'transferred', 'missed', 'failed'
  outcome VARCHAR(50) DEFAULT 'inquiry',
  intent_detected VARCHAR(100), -- 'book_appointment', 'reschedule', 'cancel', 'faq', 'other'
  
  -- Recording
  recording_url TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_calls_business ON calls(business_id);
CREATE INDEX idx_calls_twilio_sid ON calls(twilio_call_sid);
CREATE INDEX idx_calls_from ON calls(from_number);
CREATE INDEX idx_calls_outcome ON calls(outcome);

-- ============================================
-- CONVERSATION_MESSAGES (Per-call message history)
-- ============================================
CREATE TABLE conversation_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  
  role VARCHAR(20) NOT NULL, -- 'user', 'assistant', 'system', 'tool'
  content TEXT NOT NULL,
  
  -- If this was a tool call
  tool_name VARCHAR(100),
  tool_args JSONB,
  tool_result JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_call ON conversation_messages(call_id);

-- ============================================
-- BLACKOUT_DATES (Days business is closed)
-- ============================================
CREATE TABLE blackout_dates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  date DATE NOT NULL,
  reason VARCHAR(255), -- e.g., "Holiday", "Vacation"
  
  UNIQUE(business_id, date)
);

CREATE INDEX idx_blackout_business ON blackout_dates(business_id);

-- ============================================
-- ROW LEVEL SECURITY (Multi-tenant isolation)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE blackout_dates ENABLE ROW LEVEL SECURITY;

-- Businesses: Users can only see their own business
CREATE POLICY "Users can view own business" ON businesses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own business" ON businesses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own business" ON businesses
  FOR UPDATE USING (auth.uid() = user_id);

-- Services: Users can manage services for their business
CREATE POLICY "Users can view own services" ON services
  FOR SELECT USING (
    business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert own services" ON services
  FOR INSERT WITH CHECK (
    business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update own services" ON services
  FOR UPDATE USING (
    business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete own services" ON services
  FOR DELETE USING (
    business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
  );

-- Customers: Users can manage customers for their business
CREATE POLICY "Users can view own customers" ON customers
  FOR SELECT USING (
    business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert own customers" ON customers
  FOR INSERT WITH CHECK (
    business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update own customers" ON customers
  FOR UPDATE USING (
    business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
  );

-- Appointments: Users can manage appointments for their business
CREATE POLICY "Users can view own appointments" ON appointments
  FOR SELECT USING (
    business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert own appointments" ON appointments
  FOR INSERT WITH CHECK (
    business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update own appointments" ON appointments
  FOR UPDATE USING (
    business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete own appointments" ON appointments
  FOR DELETE USING (
    business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
  );

-- Calls: Users can view calls for their business
CREATE POLICY "Users can view own calls" ON calls
  FOR SELECT USING (
    business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert own calls" ON calls
  FOR INSERT WITH CHECK (
    business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
  );

-- Conversation Messages: Users can view messages for their calls
CREATE POLICY "Users can view own messages" ON conversation_messages
  FOR SELECT USING (
    call_id IN (
      SELECT c.id FROM calls c 
      JOIN businesses b ON c.business_id = b.id 
      WHERE b.user_id = auth.uid()
    )
  );

-- Blackout Dates: Users can manage blackout dates for their business
CREATE POLICY "Users can view own blackout dates" ON blackout_dates
  FOR SELECT USING (
    business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert own blackout dates" ON blackout_dates
  FOR INSERT WITH CHECK (
    business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete own blackout dates" ON blackout_dates
  FOR DELETE USING (
    business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
  );

-- ============================================
-- SERVICE ROLE POLICIES (For API/Webhooks)
-- These allow the backend to access data without user context
-- ============================================

-- Allow service role to read businesses by phone number (for Twilio webhooks)
CREATE POLICY "Service role can read all businesses" ON businesses
  FOR SELECT TO service_role USING (true);

CREATE POLICY "Service role can read all services" ON services
  FOR SELECT TO service_role USING (true);

CREATE POLICY "Service role can read all customers" ON customers
  FOR ALL TO service_role USING (true);

CREATE POLICY "Service role can manage all appointments" ON appointments
  FOR ALL TO service_role USING (true);

CREATE POLICY "Service role can manage all calls" ON calls
  FOR ALL TO service_role USING (true);

CREATE POLICY "Service role can manage all messages" ON conversation_messages
  FOR ALL TO service_role USING (true);

CREATE POLICY "Service role can read blackout dates" ON blackout_dates
  FOR SELECT TO service_role USING (true);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to relevant tables
CREATE TRIGGER update_businesses_updated_at
  BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to increment call/booking counters
CREATE OR REPLACE FUNCTION increment_business_counters()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'calls' THEN
    UPDATE businesses SET calls_this_month = calls_this_month + 1 WHERE id = NEW.business_id;
  ELSIF TG_TABLE_NAME = 'appointments' THEN
    UPDATE businesses SET bookings_this_month = bookings_this_month + 1 WHERE id = NEW.business_id;
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER increment_calls_counter
  AFTER INSERT ON calls
  FOR EACH ROW EXECUTE FUNCTION increment_business_counters();

CREATE TRIGGER increment_bookings_counter
  AFTER INSERT ON appointments
  FOR EACH ROW EXECUTE FUNCTION increment_business_counters();

-- ============================================
-- SEED DATA (Optional - for testing)
-- ============================================

-- You can uncomment this to add test data after creating a user
/*
INSERT INTO businesses (user_id, name, phone_number, business_type, system_prompt)
VALUES (
  'YOUR_USER_UUID_HERE',
  'Demo Dental Clinic',
  '+15551234567',
  'dental_clinic',
  'You are a friendly receptionist for Demo Dental Clinic. We offer general dentistry, teeth cleaning, and cosmetic procedures. Be professional and helpful.'
);
*/
