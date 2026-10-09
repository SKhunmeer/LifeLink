import Database, { type Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

const DB_PATH = process.env.DATABASE_PATH || path.resolve(process.cwd(), 'bloodlink.db');
const db: DatabaseType = new Database(DB_PATH);

// Enable WAL mode and foreign keys for high performance and integrity
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('donor', 'patient', 'hospital_staff', 'admin')),
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      password_hash TEXT,
      is_verified INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS hospitals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      license_number TEXT UNIQUE NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      postal_code TEXT,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      contact_phone TEXT NOT NULL,
      emergency_hotline TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'bloodlink',
      source_id TEXT,
      is_verified INTEGER DEFAULT 0,
      operating_hours TEXT DEFAULT '24/7 Emergency Transfusion Service',
      available_beds INTEGER DEFAULT 100,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS hospital_staff (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
      hospital_id TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
      designation TEXT NOT NULL,
      is_verified INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, hospital_id)
    );

    CREATE TABLE IF NOT EXISTS donor_matching_profiles (
      donor_uuid TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
      blood_group TEXT NOT NULL,
      lat_approx REAL NOT NULL,
      lng_approx REAL NOT NULL,
      city TEXT NOT NULL,
      is_available INTEGER DEFAULT 1,
      is_eligible INTEGER DEFAULT 1,
      last_donation_date TEXT,
      next_eligible_date TEXT,
      donation_count INTEGER DEFAULT 0,
      total_units_donated INTEGER DEFAULT 0,
      service_radius_km INTEGER DEFAULT 30,
      eligibility_rule_version TEXT DEFAULT 'v1-56day',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS donor_private_profiles (
      donor_uuid TEXT PRIMARY KEY REFERENCES donor_matching_profiles(donor_uuid) ON DELETE CASCADE,
      user_id TEXT UNIQUE NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL,
      phone_number TEXT NOT NULL,
      email TEXT NOT NULL,
      address_approx TEXT,
      emergency_notification_consent INTEGER DEFAULT 1,
      opt_out_status INTEGER DEFAULT 0,
      last_sms_sent_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS blood_inventory (
      id TEXT PRIMARY KEY,
      hospital_id TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
      blood_group TEXT NOT NULL,
      component TEXT NOT NULL,
      units_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL CHECK (status IN ('available', 'reserved', 'quarantined', 'expired')),
      batch_number TEXT NOT NULL,
      storage_location TEXT DEFAULT 'Main Refrigerator A',
      collection_date TEXT NOT NULL,
      expiry_date TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS blood_inventory_movements (
      id TEXT PRIMARY KEY,
      inventory_id TEXT NOT NULL REFERENCES blood_inventory(id) ON DELETE CASCADE,
      hospital_id TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      previous_status TEXT NOT NULL,
      new_status TEXT NOT NULL,
      reason TEXT,
      reference_request_id TEXT,
      performed_by_user_id TEXT REFERENCES user_profiles(id),
      timestamp TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS patient_requests (
      id TEXT PRIMARY KEY,
      patient_user_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
      patient_display_name TEXT NOT NULL,
      blood_group TEXT NOT NULL,
      component TEXT NOT NULL,
      units_required INTEGER NOT NULL,
      units_reserved INTEGER NOT NULL DEFAULT 0,
      urgency TEXT NOT NULL CHECK (urgency IN ('routine', 'urgent', 'critical')),
      hospital_id TEXT NOT NULL REFERENCES hospitals(id),
      requester_lat REAL,
      requester_lng REAL,
      requester_location_source TEXT,
      status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'verified', 'reserved', 'donor_outreach', 'in_transit', 'fulfilled', 'cancelled')),
      required_by_time TEXT NOT NULL,
      clinical_notes TEXT,
      treating_doctor TEXT,
      ward_or_bed TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS donor_matches (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL REFERENCES patient_requests(id) ON DELETE CASCADE,
      donor_uuid TEXT NOT NULL REFERENCES donor_matching_profiles(donor_uuid) ON DELETE CASCADE,
      distance_km REAL NOT NULL,
      compatibility_score INTEGER NOT NULL,
      notification_status TEXT NOT NULL DEFAULT 'pending',
      notification_sid TEXT,
      donor_response TEXT NOT NULL DEFAULT 'pending',
      notification_sent_at TEXT,
      responded_at TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(request_id, donor_uuid)
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      donor_uuid TEXT NOT NULL REFERENCES donor_matching_profiles(donor_uuid) ON DELETE CASCADE,
      hospital_id TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
      request_id TEXT REFERENCES patient_requests(id),
      scheduled_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled',
      verified_by_user_id TEXT REFERENCES user_profiles(id),
      clinical_notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS donation_records (
      id TEXT PRIMARY KEY,
      donor_uuid TEXT NOT NULL REFERENCES donor_matching_profiles(donor_uuid) ON DELETE CASCADE,
      hospital_id TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
      donation_date TEXT NOT NULL,
      component TEXT NOT NULL,
      units_donated INTEGER NOT NULL DEFAULT 1,
      hemoglobin_g_dl REAL,
      adverse_reaction INTEGER DEFAULT 0,
      verified_by_user_id TEXT NOT NULL REFERENCES user_profiles(id),
      blockchain_tx_hash TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notification_logs (
      id TEXT PRIMARY KEY,
      recipient_phone_masked TEXT NOT NULL,
      channel TEXT NOT NULL DEFAULT 'sms',
      message_body TEXT NOT NULL,
      twilio_sid TEXT,
      status TEXT NOT NULL,
      error_message TEXT,
      request_id TEXT REFERENCES patient_requests(id),
      donor_uuid TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT REFERENCES user_profiles(id),
      actor_role TEXT NOT NULL,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      metadata_json TEXT DEFAULT '{}',
      ip_address TEXT,
      timestamp TEXT DEFAULT (datetime('now'))
    );
  `);

  const ensureColumn = (table: string, column: string, definition: string) => {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!columns.some((item) => item.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  };

  ensureColumn('hospitals', 'source', "TEXT NOT NULL DEFAULT 'bloodlink'");
  ensureColumn('hospitals', 'source_id', 'TEXT');
  ensureColumn('patient_requests', 'requester_lat', 'REAL');
  ensureColumn('patient_requests', 'requester_lng', 'REAL');
  ensureColumn('patient_requests', 'requester_location_source', 'TEXT');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_hospitals_source_id ON hospitals(source_id) WHERE source_id IS NOT NULL');

  seedIfEmpty();
}

function seedIfEmpty() {
  const userCount = db.prepare('SELECT count(*) as count FROM user_profiles').get() as { count: number };
  if (userCount.count > 0) {
    return;
  }

  console.log('[DB] Seeding initial demonstration dataset...');

  // 1. Hospitals
  const insertHospital = db.prepare(`
    INSERT INTO hospitals (id, name, license_number, address, city, state, postal_code, lat, lng, contact_phone, emergency_hotline, is_verified, operating_hours, available_beds)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertHospital.run(
    'h0000000-0000-0000-0000-000000000001',
    'Metro General Hospital & Level 1 Trauma Center',
    'HOSP-CA-94102-01',
    '1001 Potrero Ave',
    'San Francisco',
    'CA',
    '94110',
    37.7558,
    -122.4047,
    '+1 (415) 206-8000',
    '+1 (415) 206-8888',
    1,
    '24/7 Level 1 Trauma',
    450
  );

  insertHospital.run(
    'h0000000-0000-0000-0000-000000000002',
    'St. Jude Regional Blood Institute & Center',
    'HOSP-CA-94115-02',
    '2351 Clay Street',
    'San Francisco',
    'CA',
    '94115',
    37.7905,
    -122.4340,
    '+1 (415) 600-6000',
    '+1 (415) 600-2222',
    1,
    '24/7 Blood Banking',
    220
  );

  insertHospital.run(
    'h0000000-0000-0000-0000-000000000003',
    'Bay Area Children\'s Specialty Hospital',
    'HOSP-CA-94609-03',
    '747 52nd St',
    'Oakland',
    'CA',
    '94609',
    37.8371,
    -122.2676,
    '+1 (510) 428-3000',
    '+1 (510) 428-3333',
    1,
    '24/7 Pediatric Trauma',
    180
  );

  insertHospital.run(
    'h0000000-0000-0000-0000-000000000004',
    'Golden Gate Community Red Cross Blood Bank',
    'BB-CA-94107-04',
    '1663 Mission St',
    'San Francisco',
    'CA',
    '94103',
    37.7701,
    -122.4208,
    '+1 (415) 861-8400',
    '+1 (415) 861-9999',
    1,
    '06:00 - 22:00 Daily',
    50
  );

  // 2. Users
  const insertUser = db.prepare(`
    INSERT INTO user_profiles (id, email, role, full_name, phone, password_hash, is_verified)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // Generate verified bcrypt hash for 'BloodLink2026!'
  const passwordHash = bcrypt.hashSync('BloodLink2026!', 10);

  insertUser.run('u0000000-0000-0000-0000-000000000001', 'admin@bloodlink.ai', 'admin', 'Dr. Sarah Lin (Chief Medical Admin)', '+1 (415) 555-0100', passwordHash, 1);
  insertUser.run('u0000000-0000-0000-0000-000000000002', 'metro.staff@bloodlink.ai', 'hospital_staff', 'Nurse Elena Rostova (Blood Bank Director)', '+1 (415) 555-0102', passwordHash, 1);
  insertUser.run('u0000000-0000-0000-0000-000000000003', 'stjude.staff@bloodlink.ai', 'hospital_staff', 'Dr. Marcus Vance (Transfusion Lead)', '+1 (415) 555-0103', passwordHash, 1);
  insertUser.run('u0000000-0000-0000-0000-000000000004', 'patient.attendant@bloodlink.ai', 'patient', 'Michael Chen (Patient Attendant)', '+1 (415) 555-0104', passwordHash, 1);
  insertUser.run('u0000000-0000-0000-0000-000000000005', 'urgent.case@bloodlink.ai', 'patient', 'Aisha Williams (Patient Family)', '+1 (415) 555-0105', passwordHash, 1);
  insertUser.run('u0000000-0000-0000-0000-000000000006', 'donor.onew@bloodlink.ai', 'donor', 'David Martinez', '+1 (415) 555-0201', passwordHash, 1);
  insertUser.run('u0000000-0000-0000-0000-000000000007', 'donor.apos@bloodlink.ai', 'donor', 'Rachel Kim', '+1 (415) 555-0202', passwordHash, 1);
  insertUser.run('u0000000-0000-0000-0000-000000000008', 'donor.oneg@bloodlink.ai', 'donor', 'James Taylor (Universal Donor)', '+1 (415) 555-0203', passwordHash, 1);
  insertUser.run('u0000000-0000-0000-0000-000000000009', 'donor.abpos@bloodlink.ai', 'donor', 'Priya Patel (Universal Plasma)', '+1 (415) 555-0204', passwordHash, 1);
  insertUser.run('u0000000-0000-0000-0000-000000000010', 'donor.bpos@bloodlink.ai', 'donor', 'Carlos Mendez', '+1 (415) 555-0205', passwordHash, 1);

  // 3. Hospital Staff
  db.prepare(`
    INSERT INTO hospital_staff (id, user_id, hospital_id, designation, is_verified)
    VALUES (?, ?, ?, ?, ?)
  `).run(uuidv4(), 'u0000000-0000-0000-0000-000000000002', 'h0000000-0000-0000-0000-000000000001', 'Lead Transfusion Specialist', 1);

  db.prepare(`
    INSERT INTO hospital_staff (id, user_id, hospital_id, designation, is_verified)
    VALUES (?, ?, ?, ?, ?)
  `).run(uuidv4(), 'u0000000-0000-0000-0000-000000000003', 'h0000000-0000-0000-0000-000000000002', 'Head of Clinical Hematology', 1);

  // 4. Donors - Matching & Private Profiles
  const insertDonorMatching = db.prepare(`
    INSERT INTO donor_matching_profiles (donor_uuid, user_id, blood_group, lat_approx, lng_approx, city, is_available, is_eligible, last_donation_date, next_eligible_date, donation_count, total_units_donated, service_radius_km)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, date('now', ?), date('now', ?), ?, ?, ?)
  `);

  const insertDonorPrivate = db.prepare(`
    INSERT INTO donor_private_profiles (donor_uuid, user_id, full_name, phone_number, email, address_approx, emergency_notification_consent, opt_out_status)
    VALUES (?, ?, ?, ?, ?, ?, 1, 0)
  `);

  // Donor 1: O+
  insertDonorMatching.run('d0000000-0000-0000-0000-000000000001', 'u0000000-0000-0000-0000-000000000006', 'O+', 37.7600, -122.4100, 'San Francisco', 1, 1, '-90 days', '-34 days', 5, 5, 25);
  insertDonorPrivate.run('d0000000-0000-0000-0000-000000000001', 'u0000000-0000-0000-0000-000000000006', 'David Martinez', '+14155550201', 'donor.onew@bloodlink.ai', 'Mission District, San Francisco');

  // Donor 2: A+
  insertDonorMatching.run('d0000000-0000-0000-0000-000000000002', 'u0000000-0000-0000-0000-000000000007', 'A+', 37.7850, -122.4200, 'San Francisco', 1, 1, '-120 days', '-64 days', 3, 3, 30);
  insertDonorPrivate.run('d0000000-0000-0000-0000-000000000002', 'u0000000-0000-0000-0000-000000000007', 'Rachel Kim', '+14155550202', 'donor.apos@bloodlink.ai', 'Nob Hill, San Francisco');

  // Donor 3: O- (Universal)
  insertDonorMatching.run('d0000000-0000-0000-0000-000000000003', 'u0000000-0000-0000-0000-000000000008', 'O-', 37.7750, -122.4150, 'San Francisco', 1, 1, '-65 days', '-9 days', 8, 8, 35);
  insertDonorPrivate.run('d0000000-0000-0000-0000-000000000003', 'u0000000-0000-0000-0000-000000000008', 'James Taylor', '+14155550203', 'donor.oneg@bloodlink.ai', 'SoMa, San Francisco');

  // Donor 4: AB+
  insertDonorMatching.run('d0000000-0000-0000-0000-000000000004', 'u0000000-0000-0000-0000-000000000009', 'AB+', 37.7950, -122.4050, 'San Francisco', 1, 1, '-70 days', '-14 days', 4, 4, 20);
  insertDonorPrivate.run('d0000000-0000-0000-0000-000000000004', 'u0000000-0000-0000-0000-000000000009', 'Priya Patel', '+14155550204', 'donor.abpos@bloodlink.ai', 'Financial District, San Francisco');

  // Donor 5: B+ (Ineligible - 20 days ago)
  insertDonorMatching.run('d0000000-0000-0000-0000-000000000005', 'u0000000-0000-0000-0000-000000000010', 'B+', 37.8200, -122.2500, 'Oakland', 1, 0, '-20 days', '+36 days', 2, 2, 40);
  insertDonorPrivate.run('d0000000-0000-0000-0000-000000000005', 'u0000000-0000-0000-0000-000000000010', 'Carlos Mendez', '+14155550205', 'donor.bpos@bloodlink.ai', 'Grand Lake, Oakland');

  // 5. Blood Inventory
  const insertInv = db.prepare(`
    INSERT INTO blood_inventory (id, hospital_id, blood_group, component, units_count, status, batch_number, storage_location, collection_date, expiry_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, date('now', ?), date('now', ?))
  `);

  // Metro General Inventory
  insertInv.run('i0000000-0000-0000-0000-000000000001', 'h0000000-0000-0000-0000-000000000001', 'O+', 'packed_red_blood_cells', 8, 'available', 'B-SF-2026-101', 'Cryo-Vault Bay 1', '-10 days', '+32 days');
  insertInv.run('i0000000-0000-0000-0000-000000000002', 'h0000000-0000-0000-0000-000000000001', 'O-', 'packed_red_blood_cells', 2, 'available', 'B-SF-2026-102', 'Emergency Trauma Frig 1', '-5 days', '+37 days');
  insertInv.run('i0000000-0000-0000-0000-000000000003', 'h0000000-0000-0000-0000-000000000001', 'A+', 'packed_red_blood_cells', 12, 'available', 'B-SF-2026-103', 'Refrig A-02', '-12 days', '+30 days');
  insertInv.run('i0000000-0000-0000-0000-000000000004', 'h0000000-0000-0000-0000-000000000001', 'A-', 'packed_red_blood_cells', 3, 'available', 'B-SF-2026-104', 'Refrig A-03', '-8 days', '+34 days');
  insertInv.run('i0000000-0000-0000-0000-000000000005', 'h0000000-0000-0000-0000-000000000001', 'B+', 'packed_red_blood_cells', 6, 'available', 'B-SF-2026-105', 'Refrig B-01', '-15 days', '+27 days');
  insertInv.run('i0000000-0000-0000-0000-000000000006', 'h0000000-0000-0000-0000-000000000001', 'AB+', 'plasma', 9, 'available', 'B-SF-2026-106', 'Plasma Freezer PF-1', '-40 days', '+325 days');
  insertInv.run('i0000000-0000-0000-0000-000000000007', 'h0000000-0000-0000-0000-000000000001', 'O+', 'platelets', 4, 'available', 'B-SF-2026-107', 'Platelet Agitator PA-1', '-1 days', '+4 days');
  insertInv.run('i0000000-0000-0000-0000-000000000008', 'h0000000-0000-0000-0000-000000000001', 'O+', 'packed_red_blood_cells', 2, 'reserved', 'B-SF-2026-108', 'Reserved Tray RT-1', '-6 days', '+36 days');
  insertInv.run('i0000000-0000-0000-0000-000000000009', 'h0000000-0000-0000-0000-000000000001', 'B-', 'platelets', 1, 'quarantined', 'B-SF-2026-109', 'Quarantine Q-01', '-2 days', '+3 days');
  insertInv.run('i0000000-0000-0000-0000-000000000010', 'h0000000-0000-0000-0000-000000000001', 'AB-', 'packed_red_blood_cells', 1, 'expired', 'B-SF-2026-110', 'Biohazard Disposal', '-45 days', '-3 days');

  // St. Jude Inventory
  insertInv.run('i0000000-0000-0000-0000-000000000011', 'h0000000-0000-0000-0000-000000000002', 'O-', 'packed_red_blood_cells', 4, 'available', 'B-SJ-2026-201', 'Vault Zone Alpha', '-7 days', '+35 days');
  insertInv.run('i0000000-0000-0000-0000-000000000012', 'h0000000-0000-0000-0000-000000000002', 'A+', 'platelets', 6, 'available', 'B-SJ-2026-202', 'Agitator Unit 2', '-2 days', '+3 days');
  insertInv.run('i0000000-0000-0000-0000-000000000013', 'h0000000-0000-0000-0000-000000000002', 'B+', 'plasma', 14, 'available', 'B-SJ-2026-203', 'Deep Freeze -80C', '-25 days', '+340 days');
  insertInv.run('i0000000-0000-0000-0000-000000000014', 'h0000000-0000-0000-0000-000000000002', 'AB-', 'packed_red_blood_cells', 2, 'available', 'B-SJ-2026-204', 'Vault Zone Beta', '-14 days', '+28 days');

  // 6. Patient Requests
  const insertReq = db.prepare(`
    INSERT INTO patient_requests (id, patient_user_id, patient_display_name, blood_group, component, units_required, units_reserved, urgency, hospital_id, status, required_by_time, clinical_notes, treating_doctor, ward_or_bed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?), ?, ?, ?)
  `);

  insertReq.run(
    'r0000000-0000-0000-0000-000000000001',
    'u0000000-0000-0000-0000-000000000004',
    'Patient Case #921 (S. Chen)',
    'O-',
    'packed_red_blood_cells',
    3,
    2,
    'critical',
    'h0000000-0000-0000-0000-000000000001',
    'donor_outreach',
    '+3 hours',
    'Acute hemoperitoneum secondary to blunt trauma. Need 1 additional O- unit immediately.',
    'Dr. K. Anderson (Trauma)',
    'Trauma Bay 4'
  );

  insertReq.run(
    'r0000000-0000-0000-0000-000000000002',
    'u0000000-0000-0000-0000-000000000005',
    'Patient Case #843 (J. Williams)',
    'A+',
    'platelets',
    2,
    2,
    'urgent',
    'h0000000-0000-0000-0000-000000000002',
    'reserved',
    '+8 hours',
    'Post-chemotherapy severe thrombocytopenia. Platelet count 9,000/uL.',
    'Dr. S. Thorne (Oncology)',
    'Oncology Wing 3B'
  );

  // 7. Donor Matches for Request 1
  const insertMatch = db.prepare(`
    INSERT INTO donor_matches (id, request_id, donor_uuid, distance_km, compatibility_score, notification_status, donor_response, notification_sent_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', ?))
  `);

  insertMatch.run(
    'm0000000-0000-0000-0000-000000000001',
    'r0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000003',
    2.4,
    98,
    'mock_sent',
    'accepted',
    '-25 minutes'
  );

  insertMatch.run(
    'm0000000-0000-0000-0000-000000000002',
    'r0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000001',
    3.8,
    72,
    'mock_sent',
    'pending',
    '-20 minutes'
  );

  // 8. Notification Logs
  const insertNotif = db.prepare(`
    INSERT INTO notification_logs (id, recipient_phone_masked, channel, message_body, twilio_sid, status, request_id, donor_uuid, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))
  `);

  insertNotif.run(
    uuidv4(),
    '+1 ***-***-0203',
    'sms',
    'BloodLink AI: A registered blood bank has a verified urgent request that may match your donor profile. Review securely: https://bloodlink.ai/d/case-921. Reply STOP to opt out.',
    'SM_MOCK_7719283401',
    'mock_sent',
    'r0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000003',
    '-25 minutes'
  );

  // 9. Audit Logs
  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (id, actor_user_id, actor_role, action, resource_type, resource_id, metadata_json, ip_address, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))
  `);

  insertAudit.run(
    uuidv4(),
    'u0000000-0000-0000-0000-000000000002',
    'hospital_staff',
    'RESERVE_INVENTORY',
    'patient_requests',
    'r0000000-0000-0000-0000-000000000001',
    JSON.stringify({ units: 2, batch: 'B-SF-2026-108', hospital: 'Metro General' }),
    '127.0.0.1',
    '-40 minutes'
  );

  console.log('[DB] Seeding completed successfully.');
}

export { db };
