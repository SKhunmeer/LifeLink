-- ========================================================
-- BLOODLINK AI - SEED DATA (REALISTIC DEMONSTRATION DATASET)
-- ========================================================

-- Clear existing data if re-seeding
TRUNCATE TABLE audit_logs, notification_logs, donation_records, appointments, donor_matches, 
patient_requests, blood_inventory_movements, blood_inventory, donor_private_profiles, 
donor_matching_profiles, hospital_staff, hospitals, user_profiles CASCADE;

-- 1. SEED HOSPITALS
INSERT INTO hospitals (id, name, license_number, address, city, state, postal_code, lat, lng, contact_phone, emergency_hotline, is_verified, operating_hours, available_beds)
VALUES
('h0000000-0000-0000-0000-000000000001', 'Metro General Hospital & Level 1 Trauma Center', 'HOSP-CA-94102-01', '1001 Potrero Ave', 'San Francisco', 'CA', '94110', 37.7558, -122.4047, '+1 (415) 206-8000', '+1 (415) 206-8888', TRUE, '24/7 Level 1 Trauma', 450),
('h0000000-0000-0000-0000-000000000002', 'St. Jude Regional Blood Institute & Center', 'HOSP-CA-94115-02', '2351 Clay Street', 'San Francisco', 'CA', '94115', 37.7905, -122.4340, '+1 (415) 600-6000', '+1 (415) 600-2222', TRUE, '24/7 Blood Banking', 220),
('h0000000-0000-0000-0000-000000000003', 'Bay Area Children''s Specialty Hospital', 'HOSP-CA-94609-03', '747 52nd St', 'Oakland', 'CA', '94609', 37.8371, -122.2676, '+1 (510) 428-3000', '+1 (510) 428-3333', TRUE, '24/7 Pediatric Trauma', 180),
('h0000000-0000-0000-0000-000000000004', 'Golden Gate Community Red Cross Blood Bank', 'BB-CA-94107-04', '1663 Mission St', 'San Francisco', 'CA', '94103', 37.7701, -122.4208, '+1 (415) 861-8400', '+1 (415) 861-9999', TRUE, '06:00 - 22:00 Daily', 50);

-- 2. SEED USERS (Bcrypt password hash for 'BloodLink2026!')
-- $2a$10$wT8K48B/jNcrzHk9U5tJg.iP0RjH0E6Z.mD908lB/hI6y6O4sNfje
INSERT INTO user_profiles (id, email, role, full_name, phone, password_hash, is_verified)
VALUES
-- Admins
('u0000000-0000-0000-0000-000000000001', 'admin@bloodlink.ai', 'admin', 'Dr. Sarah Lin (Chief Medical Administrator)', '+1 (415) 555-0100', '$2a$10$wT8K48B/jNcrzHk9U5tJg.iP0RjH0E6Z.mD908lB/hI6y6O4sNfje', TRUE),

-- Hospital Staff
('u0000000-0000-0000-0000-000000000002', 'metro.staff@bloodlink.ai', 'hospital_staff', 'Nurse Elena Rostova (Blood Bank Director)', '+1 (415) 555-0102', '$2a$10$wT8K48B/jNcrzHk9U5tJg.iP0RjH0E6Z.mD908lB/hI6y6O4sNfje', TRUE),
('u0000000-0000-0000-0000-000000000003', 'stjude.staff@bloodlink.ai', 'hospital_staff', 'Dr. Marcus Vance (Transfusion Lead)', '+1 (415) 555-0103', '$2a$10$wT8K48B/jNcrzHk9U5tJg.iP0RjH0E6Z.mD908lB/hI6y6O4sNfje', TRUE),

-- Patient / Attendants
('u0000000-0000-0000-0000-000000000004', 'patient.attendant@bloodlink.ai', 'patient', 'Michael Chen (Patient Attendant)', '+1 (415) 555-0104', '$2a$10$wT8K48B/jNcrzHk9U5tJg.iP0RjH0E6Z.mD908lB/hI6y6O4sNfje', TRUE),
('u0000000-0000-0000-0000-000000000005', 'urgent.case@bloodlink.ai', 'patient', 'Aisha Williams (Patient Family)', '+1 (415) 555-0105', '$2a$10$wT8K48B/jNcrzHk9U5tJg.iP0RjH0E6Z.mD908lB/hI6y6O4sNfje', TRUE),

-- Donors
('u0000000-0000-0000-0000-000000000006', 'donor.onew@bloodlink.ai', 'donor', 'David Martinez', '+1 (415) 555-0201', '$2a$10$wT8K48B/jNcrzHk9U5tJg.iP0RjH0E6Z.mD908lB/hI6y6O4sNfje', TRUE),
('u0000000-0000-0000-0000-000000000007', 'donor.apos@bloodlink.ai', 'donor', 'Rachel Kim', '+1 (415) 555-0202', '$2a$10$wT8K48B/jNcrzHk9U5tJg.iP0RjH0E6Z.mD908lB/hI6y6O4sNfje', TRUE),
('u0000000-0000-0000-0000-000000000008', 'donor.oneg@bloodlink.ai', 'donor', 'James Taylor (Universal Donor)', '+1 (415) 555-0203', '$2a$10$wT8K48B/jNcrzHk9U5tJg.iP0RjH0E6Z.mD908lB/hI6y6O4sNfje', TRUE),
('u0000000-0000-0000-0000-000000000009', 'donor.abpos@bloodlink.ai', 'donor', 'Priya Patel (Universal Plasma)', '+1 (415) 555-0204', '$2a$10$wT8K48B/jNcrzHk9U5tJg.iP0RjH0E6Z.mD908lB/hI6y6O4sNfje', TRUE),
('u0000000-0000-0000-0000-000000000010', 'donor.bpos@bloodlink.ai', 'donor', 'Carlos Mendez', '+1 (415) 555-0205', '$2a$10$wT8K48B/jNcrzHk9U5tJg.iP0RjH0E6Z.mD908lB/hI6y6O4sNfje', TRUE);

-- 3. LINK HOSPITAL STAFF
INSERT INTO hospital_staff (user_id, hospital_id, designation, is_verified)
VALUES
('u0000000-0000-0000-0000-000000000002', 'h0000000-0000-0000-0000-000000000001', 'Lead Transfusion Specialist', TRUE),
('u0000000-0000-0000-0000-000000000003', 'h0000000-0000-0000-0000-000000000002', 'Head of Clinical Hematology', TRUE);

-- 4. SEED PSEUDONYMOUS DONOR MATCHING PROFILES
INSERT INTO donor_matching_profiles (donor_uuid, user_id, blood_group, lat_approx, lng_approx, city, is_available, is_eligible, last_donation_date, next_eligible_date, donation_count, total_units_donated, service_radius_km)
VALUES
('d0000000-0000-0000-0000-000000000001', 'u0000000-0000-0000-0000-000000000006', 'O+', 37.7600, -122.4100, 'San Francisco', TRUE, TRUE, CURRENT_DATE - INTERVAL '90 days', CURRENT_DATE - INTERVAL '34 days', 5, 5, 25),
('d0000000-0000-0000-0000-000000000002', 'u0000000-0000-0000-0000-000000000007', 'A+', 37.7850, -122.4200, 'San Francisco', TRUE, TRUE, CURRENT_DATE - INTERVAL '120 days', CURRENT_DATE - INTERVAL '64 days', 3, 3, 30),
('d0000000-0000-0000-0000-000000000003', 'u0000000-0000-0000-0000-000000000008', 'O-', 37.7750, -122.4150, 'San Francisco', TRUE, TRUE, CURRENT_DATE - INTERVAL '65 days', CURRENT_DATE - INTERVAL '9 days', 8, 8, 35),
('d0000000-0000-0000-0000-000000000004', 'u0000000-0000-0000-0000-000000000009', 'AB+', 37.7950, -122.4050, 'San Francisco', TRUE, TRUE, CURRENT_DATE - INTERVAL '70 days', CURRENT_DATE - INTERVAL '14 days', 4, 4, 20),
('d0000000-0000-0000-0000-000000000005', 'u0000000-0000-0000-0000-000000000010', 'B+', 37.8200, -122.2500, 'Oakland', TRUE, FALSE, CURRENT_DATE - INTERVAL '20 days', CURRENT_DATE + INTERVAL '36 days', 2, 2, 40);

-- 5. SEED DONOR PRIVATE PROFILES (ISOLATED VAULT)
INSERT INTO donor_private_profiles (donor_uuid, user_id, full_name, phone_number, email, address_approx, emergency_notification_consent, opt_out_status)
VALUES
('d0000000-0000-0000-0000-000000000001', 'u0000000-0000-0000-0000-000000000006', 'David Martinez', '+14155550201', 'donor.onew@bloodlink.ai', 'Mission District, San Francisco', TRUE, FALSE),
('d0000000-0000-0000-0000-000000000002', 'u0000000-0000-0000-0000-000000000007', 'Rachel Kim', '+14155550202', 'donor.apos@bloodlink.ai', 'Nob Hill, San Francisco', TRUE, FALSE),
('d0000000-0000-0000-0000-000000000003', 'u0000000-0000-0000-0000-000000000008', 'James Taylor', '+14155550203', 'donor.oneg@bloodlink.ai', 'SoMa, San Francisco', TRUE, FALSE),
('d0000000-0000-0000-0000-000000000004', 'u0000000-0000-0000-0000-000000000009', 'Priya Patel', '+14155550204', 'donor.abpos@bloodlink.ai', 'Financial District, San Francisco', TRUE, FALSE),
('d0000000-0000-0000-0000-000000000005', 'u0000000-0000-0000-0000-000000000010', 'Carlos Mendez', '+14155550205', 'donor.bpos@bloodlink.ai', 'Grand Lake, Oakland', TRUE, FALSE);

-- 6. SEED BLOOD INVENTORY ACROSS HOSPITALS
-- Variety of Available, Reserved, Quarantined, and Expired across blood groups & components
INSERT INTO blood_inventory (id, hospital_id, blood_group, component, units_count, status, batch_number, storage_location, collection_date, expiry_date)
VALUES
-- Metro General
('i0000000-0000-0000-0000-000000000001', 'h0000000-0000-0000-0000-000000000001', 'O+', 'packed_red_blood_cells', 8, 'available', 'B-SF-2026-101', 'Cryo-Vault Bay 1', CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE + INTERVAL '32 days'),
('i0000000-0000-0000-0000-000000000002', 'h0000000-0000-0000-0000-000000000001', 'O-', 'packed_red_blood_cells', 2, 'available', 'B-SF-2026-102', 'Emergency Trauma Frig 1', CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE + INTERVAL '37 days'),
('i0000000-0000-0000-0000-000000000003', 'h0000000-0000-0000-0000-000000000001', 'A+', 'packed_red_blood_cells', 12, 'available', 'B-SF-2026-103', 'Refrig A-02', CURRENT_DATE - INTERVAL '12 days', CURRENT_DATE + INTERVAL '30 days'),
('i0000000-0000-0000-0000-000000000004', 'h0000000-0000-0000-0000-000000000001', 'A-', 'packed_red_blood_cells', 3, 'available', 'B-SF-2026-104', 'Refrig A-03', CURRENT_DATE - INTERVAL '8 days', CURRENT_DATE + INTERVAL '34 days'),
('i0000000-0000-0000-0000-000000000005', 'h0000000-0000-0000-0000-000000000001', 'B+', 'packed_red_blood_cells', 6, 'available', 'B-SF-2026-105', 'Refrig B-01', CURRENT_DATE - INTERVAL '15 days', CURRENT_DATE + INTERVAL '27 days'),
('i0000000-0000-0000-0000-000000000006', 'h0000000-0000-0000-0000-000000000001', 'AB+', 'plasma', 9, 'available', 'B-SF-2026-106', 'Plasma Freezer PF-1', CURRENT_DATE - INTERVAL '40 days', CURRENT_DATE + INTERVAL '325 days'),
('i0000000-0000-0000-0000-000000000007', 'h0000000-0000-0000-0000-000000000001', 'O+', 'platelets', 4, 'available', 'B-SF-2026-107', 'Platelet Agitator PA-1', CURRENT_DATE - INTERVAL '1 days', CURRENT_DATE + INTERVAL '4 days'),
('i0000000-0000-0000-0000-000000000008', 'h0000000-0000-0000-0000-000000000001', 'O+', 'packed_red_blood_cells', 2, 'reserved', 'B-SF-2026-108', 'Reserved Tray RT-1', CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE + INTERVAL '36 days'),
('i0000000-0000-0000-0000-000000000009', 'h0000000-0000-0000-0000-000000000001', 'B-', 'platelets', 1, 'quarantined', 'B-SF-2026-109', 'Quarantine Q-01', CURRENT_DATE - INTERVAL '2 days', CURRENT_DATE + INTERVAL '3 days'),
('i0000000-0000-0000-0000-000000000010', 'h0000000-0000-0000-0000-000000000001', 'AB-', 'packed_red_blood_cells', 1, 'expired', 'B-SF-2026-110', 'Biohazard Disposal', CURRENT_DATE - INTERVAL '45 days', CURRENT_DATE - INTERVAL '3 days'),

-- St. Jude Blood Institute
('i0000000-0000-0000-0000-000000000011', 'h0000000-0000-0000-0000-000000000002', 'O-', 'packed_red_blood_cells', 4, 'available', 'B-SJ-2026-201', 'Vault Zone Alpha', CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE + INTERVAL '35 days'),
('i0000000-0000-0000-0000-000000000012', 'h0000000-0000-0000-0000-000000000002', 'A+', 'platelets', 6, 'available', 'B-SJ-2026-202', 'Agitator Unit 2', CURRENT_DATE - INTERVAL '2 days', CURRENT_DATE + INTERVAL '3 days'),
('i0000000-0000-0000-0000-000000000013', 'h0000000-0000-0000-0000-000000000002', 'B+', 'plasma', 14, 'available', 'B-SJ-2026-203', 'Deep Freeze -80C', CURRENT_DATE - INTERVAL '25 days', CURRENT_DATE + INTERVAL '340 days'),
('i0000000-0000-0000-0000-000000000014', 'h0000000-0000-0000-0000-000000000002', 'AB-', 'packed_red_blood_cells', 2, 'available', 'B-SJ-2026-204', 'Vault Zone Beta', CURRENT_DATE - INTERVAL '14 days', CURRENT_DATE + INTERVAL '28 days');

-- 7. SEED PATIENT EMERGENCY REQUESTS
INSERT INTO patient_requests (id, patient_user_id, patient_display_name, blood_group, component, units_required, units_reserved, urgency, hospital_id, status, required_by_time, clinical_notes, treating_doctor, ward_or_bed)
VALUES
('r0000000-0000-0000-0000-000000000001', 'u0000000-0000-0000-0000-000000000004', 'Patient Case #921 (S. Chen)', 'O-', 'packed_red_blood_cells', 3, 2, 'critical', 'h0000000-0000-0000-0000-000000000001', 'donor_outreach', NOW() + INTERVAL '3 hours', 'Acute hemoperitoneum secondary to blunt trauma. Crossmatch initiated. Need 1 additional O- unit immediately.', 'Dr. K. Anderson (Trauma)', 'Trauma Bay 4'),
('r0000000-0000-0000-0000-000000000002', 'u0000000-0000-0000-0000-000000000005', 'Patient Case #843 (J. Williams)', 'A+', 'platelets', 2, 2, 'urgent', 'h0000000-0000-0000-0000-000000000002', 'reserved', NOW() + INTERVAL '8 hours', 'Post-chemotherapy severe thrombocytopenia. Platelet count 9,000/uL.', 'Dr. S. Thorne (Oncology)', 'Oncology Wing 3B'),
('r0000000-0000-0000-0000-000000000003', 'u0000000-0000-0000-0000-000000000004', 'Patient Case #712 (R. Miller)', 'B+', 'packed_red_blood_cells', 2, 0, 'routine', 'h0000000-0000-0000-0000-000000000001', 'submitted', NOW() + INTERVAL '24 hours', 'Pre-operative crossmatch for elective cardiac valve repair.', 'Dr. P. Gomez (Cardiothoracic)', 'Cardio ICU 12');

-- 8. SEED DONOR MATCHES FOR CASE #921
INSERT INTO donor_matches (id, request_id, donor_uuid, distance_km, compatibility_score, notification_status, donor_response, notification_sent_at)
VALUES
('m0000000-0000-0000-0000-000000000001', 'r0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 2.4, 98, 'mock_sent', 'accepted', NOW() - INTERVAL '25 minutes'),
('m0000000-0000-0000-0000-000000000002', 'r0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 3.8, 72, 'mock_sent', 'pending', NOW() - INTERVAL '20 minutes');

-- 9. SEED NOTIFICATION LOGS
INSERT INTO notification_logs (recipient_phone_masked, channel, message_body, twilio_sid, status, request_id, donor_uuid, created_at)
VALUES
('+1 ***-***-0203', 'sms', 'BloodLink AI: A registered blood bank has a verified urgent request for O- Red Blood Cells near San Francisco. Review securely: https://bloodlink.ai/d/case-921. Reply STOP to opt out.', 'SM_MOCK_7719283401', 'mock_sent', 'r0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', NOW() - INTERVAL '25 minutes'),
('+1 ***-***-0201', 'sms', 'BloodLink AI: Emergency blood bank request within your radius. Review securely: https://bloodlink.ai/d/case-921. Reply STOP to opt out.', 'SM_MOCK_7719283402', 'mock_sent', 'r0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', NOW() - INTERVAL '20 minutes');

-- 10. SEED AUDIT LOGS
INSERT INTO audit_logs (actor_user_id, actor_role, action, resource_type, resource_id, metadata_json, ip_address, timestamp)
VALUES
('u0000000-0000-0000-0000-000000000002', 'hospital_staff', 'RESERVE_INVENTORY', 'patient_requests', 'r0000000-0000-0000-0000-000000000001', '{"units": 2, "batch": "B-SF-2026-108", "hospital": "Metro General"}'::jsonb, '127.0.0.1', NOW() - INTERVAL '40 minutes'),
('u0000000-0000-0000-0000-000000000002', 'hospital_staff', 'TRIGGER_DONOR_OUTREACH', 'patient_requests', 'r0000000-0000-0000-0000-000000000001', '{"shortfall": 1, "blood_group": "O-", "urgency": "critical", "matched_count": 2}'::jsonb, '127.0.0.1', NOW() - INTERVAL '26 minutes');
