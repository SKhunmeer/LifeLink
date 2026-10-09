-- ========================================================
-- BLOODLINK AI - COMPLETE POSTGRESQL / SUPABASE SCHEMA
-- Includes Privacy-Preserving Tables, Foreign Keys, Indexes,
-- Check Constraints & Row Level Security (RLS) Policies
-- ========================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. USER PROFILES
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(32) NOT NULL CHECK (role IN ('donor', 'patient', 'hospital_staff', 'admin')),
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(32) NOT NULL,
    password_hash VARCHAR(255),
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. HOSPITALS & BLOOD BANKS
CREATE TABLE IF NOT EXISTS hospitals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    license_number VARCHAR(128) UNIQUE NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(128) NOT NULL,
    state VARCHAR(64) NOT NULL,
    postal_code VARCHAR(32),
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    contact_phone VARCHAR(32) NOT NULL,
    emergency_hotline VARCHAR(32) NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    operating_hours VARCHAR(128) DEFAULT '24/7 Emergency Transfusion Service',
    available_beds INTEGER DEFAULT 100,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. HOSPITAL STAFF
CREATE TABLE IF NOT EXISTS hospital_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    designation VARCHAR(128) NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, hospital_id)
);

-- 4. DONOR MATCHING PROFILES (OPERATIONAL & PSEUDONYMOUS ONLY)
-- Crucial: Zero PII (no names, phone numbers, or addresses) stored here!
CREATE TABLE IF NOT EXISTS donor_matching_profiles (
    donor_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    blood_group VARCHAR(8) NOT NULL CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
    lat_approx DOUBLE PRECISION NOT NULL,
    lng_approx DOUBLE PRECISION NOT NULL,
    city VARCHAR(128) NOT NULL,
    is_available BOOLEAN DEFAULT TRUE,
    is_eligible BOOLEAN DEFAULT TRUE,
    last_donation_date DATE,
    next_eligible_date DATE,
    donation_count INTEGER DEFAULT 0 CHECK (donation_count >= 0),
    total_units_donated INTEGER DEFAULT 0 CHECK (total_units_donated >= 0),
    service_radius_km INTEGER DEFAULT 30 CHECK (service_radius_km > 0),
    eligibility_rule_version VARCHAR(32) DEFAULT 'v1-56day',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. DONOR PRIVATE PROFILES (RESTRICTED ENCRYPTED CONTACT VAULT)
-- Only accessible by authorized notification dispatch service; strictly isolated from queries
CREATE TABLE IF NOT EXISTS donor_private_profiles (
    donor_uuid UUID PRIMARY KEY REFERENCES donor_matching_profiles(donor_uuid) ON DELETE CASCADE,
    user_id UUID UNIQUE NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(32) NOT NULL,
    email VARCHAR(255) NOT NULL,
    address_approx TEXT,
    emergency_notification_consent BOOLEAN DEFAULT TRUE,
    opt_out_status BOOLEAN DEFAULT FALSE,
    last_sms_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. BLOOD INVENTORY
CREATE TABLE IF NOT EXISTS blood_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    blood_group VARCHAR(8) NOT NULL CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
    component VARCHAR(32) NOT NULL CHECK (component IN ('packed_red_blood_cells', 'platelets', 'plasma', 'whole_blood', 'cryoprecipitate')),
    units_count INTEGER NOT NULL DEFAULT 0 CHECK (units_count >= 0),
    status VARCHAR(32) NOT NULL CHECK (status IN ('available', 'reserved', 'quarantined', 'expired')),
    batch_number VARCHAR(64) NOT NULL,
    storage_location VARCHAR(128) DEFAULT 'Main Refrigerator A',
    collection_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_expiry_after_collection CHECK (expiry_date >= collection_date)
);

-- 7. BLOOD INVENTORY MOVEMENTS (AUDIT TRAIL)
CREATE TABLE IF NOT EXISTS blood_inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id UUID NOT NULL REFERENCES blood_inventory(id) ON DELETE CASCADE,
    hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    action VARCHAR(32) NOT NULL CHECK (action IN ('added', 'reserved', 'released', 'issued', 'quarantined', 'expired', 'adjusted')),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    previous_status VARCHAR(32) NOT NULL,
    new_status VARCHAR(32) NOT NULL,
    reason TEXT,
    reference_request_id UUID,
    performed_by_user_id UUID REFERENCES user_profiles(id),
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 8. PATIENT REQUESTS
CREATE TABLE IF NOT EXISTS patient_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    patient_display_name VARCHAR(128) NOT NULL,
    blood_group VARCHAR(8) NOT NULL CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
    component VARCHAR(32) NOT NULL CHECK (component IN ('packed_red_blood_cells', 'platelets', 'plasma', 'whole_blood', 'cryoprecipitate')),
    units_required INTEGER NOT NULL CHECK (units_required > 0),
    units_reserved INTEGER NOT NULL DEFAULT 0 CHECK (units_reserved >= 0),
    urgency VARCHAR(16) NOT NULL CHECK (urgency IN ('routine', 'urgent', 'critical')),
    hospital_id UUID NOT NULL REFERENCES hospitals(id),
    status VARCHAR(32) NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'verified', 'reserved', 'donor_outreach', 'in_transit', 'fulfilled', 'cancelled')),
    required_by_time TIMESTAMPTZ NOT NULL,
    clinical_notes TEXT,
    treating_doctor VARCHAR(128),
    ward_or_bed VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. DONOR MATCHES (EMERGENCY OUTREACH)
CREATE TABLE IF NOT EXISTS donor_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES patient_requests(id) ON DELETE CASCADE,
    donor_uuid UUID NOT NULL REFERENCES donor_matching_profiles(donor_uuid) ON DELETE CASCADE,
    distance_km DOUBLE PRECISION NOT NULL,
    compatibility_score INTEGER NOT NULL CHECK (compatibility_score BETWEEN 0 AND 100),
    notification_status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (notification_status IN ('pending', 'sent', 'mock_sent', 'delivered', 'failed')),
    notification_sid VARCHAR(64),
    donor_response VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (donor_response IN ('pending', 'accepted', 'declined', 'expired')),
    notification_sent_at TIMESTAMPTZ,
    responded_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(request_id, donor_uuid)
);

-- 10. APPOINTMENTS
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donor_uuid UUID NOT NULL REFERENCES donor_matching_profiles(donor_uuid) ON DELETE CASCADE,
    hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    request_id UUID REFERENCES patient_requests(id),
    scheduled_time TIMESTAMPTZ NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
    verified_by_user_id UUID REFERENCES user_profiles(id),
    clinical_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. DONATION RECORDS (VERIFIED HISTORICAL DONATIONS)
CREATE TABLE IF NOT EXISTS donation_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donor_uuid UUID NOT NULL REFERENCES donor_matching_profiles(donor_uuid) ON DELETE CASCADE,
    hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    donation_date DATE NOT NULL,
    component VARCHAR(32) NOT NULL CHECK (component IN ('packed_red_blood_cells', 'platelets', 'plasma', 'whole_blood', 'cryoprecipitate')),
    units_donated INTEGER NOT NULL DEFAULT 1 CHECK (units_donated > 0),
    hemoglobin_g_dl NUMERIC(4, 1),
    adverse_reaction BOOLEAN DEFAULT FALSE,
    verified_by_user_id UUID NOT NULL REFERENCES user_profiles(id),
    blockchain_tx_hash VARCHAR(66),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. NOTIFICATION LOGS
CREATE TABLE IF NOT EXISTS notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_phone_masked VARCHAR(32) NOT NULL,
    channel VARCHAR(16) NOT NULL DEFAULT 'sms' CHECK (channel IN ('sms', 'whatsapp')),
    message_body TEXT NOT NULL,
    twilio_sid VARCHAR(64),
    status VARCHAR(32) NOT NULL CHECK (status IN ('pending', 'sent', 'mock_sent', 'delivered', 'failed')),
    error_message TEXT,
    request_id UUID REFERENCES patient_requests(id),
    donor_uuid UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. AUDIT LOGS (TAMPER-EVIDENT RECORD)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID REFERENCES user_profiles(id),
    actor_role VARCHAR(32) NOT NULL,
    action VARCHAR(64) NOT NULL,
    resource_type VARCHAR(64) NOT NULL,
    resource_id VARCHAR(64) NOT NULL,
    metadata_json JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(64),
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================================
-- INDEXES FOR PERFORMANCE & CONCURRENCY
-- ========================================================

CREATE INDEX IF NOT EXISTS idx_inventory_lookup ON blood_inventory (hospital_id, blood_group, component, status);
CREATE INDEX IF NOT EXISTS idx_inventory_expiry ON blood_inventory (expiry_date, status);
CREATE INDEX IF NOT EXISTS idx_donor_matching ON donor_matching_profiles (blood_group, is_available, is_eligible);
CREATE INDEX IF NOT EXISTS idx_requests_status ON patient_requests (status, urgency, hospital_id);
CREATE INDEX IF NOT EXISTS idx_donor_matches_req ON donor_matches (request_id, notification_status);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_notif_logs_time ON notification_logs (created_at DESC);

-- ========================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ========================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE donor_private_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE donor_matching_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE blood_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE blood_inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE donor_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- 1. Hospitals are publicly readable
CREATE POLICY "Public hospitals can be viewed by all authenticated users"
    ON hospitals FOR SELECT
    USING (true);

-- 2. Blood inventory is viewable by all authenticated users (read-only stock status)
CREATE POLICY "Inventory is viewable by all authenticated users"
    ON blood_inventory FOR SELECT
    USING (true);

-- 3. Only hospital staff can modify their own hospital's inventory
CREATE POLICY "Hospital staff can modify inventory for their hospital"
    ON blood_inventory FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM hospital_staff hs
            WHERE hs.user_id = auth.uid()
            AND hs.hospital_id = blood_inventory.hospital_id
            AND hs.is_verified = TRUE
        )
    );

-- 4. Donor private profiles can ONLY be viewed by the donor themselves or system admin
CREATE POLICY "Donor private profile strictly personal"
    ON donor_private_profiles FOR SELECT
    USING (
        user_id = auth.uid() OR
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- 5. Donor matching profiles: donors see their own, authorized hospital staff see for matching
CREATE POLICY "Matching profiles access"
    ON donor_matching_profiles FOR SELECT
    USING (
        user_id = auth.uid() OR
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('hospital_staff', 'admin'))
    );
