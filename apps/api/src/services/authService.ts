import { db } from '../db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { UserProfile, UserRole } from '@bloodlink/shared';

const JWT_SECRET = process.env.JWT_SECRET || 'bloodlink-super-secret-key-2026';

export interface AuthTokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  fullName: string;
}

export function generateToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): AuthTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
  } catch {
    return null;
  }
}

export function getUserById(id: string): UserProfile | null {
  const row = db.prepare(`
    SELECT id, email, role, full_name as fullName, phone, is_verified as isVerified, created_at as createdAt
    FROM user_profiles WHERE id = ?
  `).get(id) as any;
  if (!row) return null;
  return {
    ...row,
    isVerified: Boolean(row.isVerified)
  };
}

export function getUserByEmail(email: string): any {
  return db.prepare(`
    SELECT id, email, role, full_name as fullName, phone, password_hash as passwordHash, is_verified as isVerified, created_at as createdAt
    FROM user_profiles WHERE email = ?
  `).get(email);
}

export async function registerUser(params: {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  role: UserRole;
  bloodGroup?: string;
  hospitalId?: string;
  approxCity?: string;
  lat?: number;
  lng?: number;
  notificationConsent?: boolean;
}): Promise<{ user: UserProfile; token: string }> {
  const existing = getUserByEmail(params.email);
  if (existing) {
    throw new Error('An account with this email address already exists');
  }

  const userId = uuidv4();
  const passwordHash = await bcrypt.hash(params.password, 10);

  const insertUser = db.prepare(`
    INSERT INTO user_profiles (id, email, role, full_name, phone, password_hash, is_verified)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `);

  insertUser.run(userId, params.email, params.role, params.fullName, params.phone, passwordHash);

  // If role is donor, create matching and private profiles
  if (params.role === 'donor') {
    const donorUuid = uuidv4();
    db.prepare(`
      INSERT INTO donor_matching_profiles (donor_uuid, user_id, blood_group, lat_approx, lng_approx, city, is_available, is_eligible)
      VALUES (?, ?, ?, ?, ?, ?, 1, 1)
    `).run(
      donorUuid,
      userId,
      params.bloodGroup || 'O+',
      params.lat || 37.7749,
      params.lng || -122.4194,
      params.approxCity || 'San Francisco'
    );

    db.prepare(`
      INSERT INTO donor_private_profiles (donor_uuid, user_id, full_name, phone_number, email, address_approx, emergency_notification_consent)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      donorUuid,
      userId,
      params.fullName,
      params.phone,
      params.email,
      params.approxCity || 'San Francisco',
      params.notificationConsent !== false ? 1 : 0
    );
  }

  // If role is hospital_staff and hospitalId provided
  if (params.role === 'hospital_staff' && params.hospitalId) {
    db.prepare(`
      INSERT INTO hospital_staff (id, user_id, hospital_id, designation, is_verified)
      VALUES (?, ?, ?, 'Staff Specialist', 1)
    `).run(uuidv4(), userId, params.hospitalId);
  }

  const user = getUserById(userId)!;
  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    fullName: user.fullName
  });

  return { user, token };
}

export async function loginUser(email: string, password?: string): Promise<{ user: UserProfile; token: string }> {
  const userRecord = getUserByEmail(email);
  if (!userRecord) {
    throw new Error('Invalid email or password');
  }

  if (password && userRecord.passwordHash) {
    const matches = await bcrypt.compare(password, userRecord.passwordHash);
    if (!matches) {
      throw new Error('Invalid email or password');
    }
  }

  const user = getUserById(userRecord.id)!;
  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    fullName: user.fullName
  });

  return { user, token };
}

export function getAllDemoAccounts(): any[] {
  return db.prepare(`
    SELECT u.id, u.email, u.role, u.full_name as fullName, u.phone,
           hs.hospital_id as hospitalId, h.name as hospitalName,
           dmp.donor_uuid as donorUuid, dmp.blood_group as bloodGroup
    FROM user_profiles u
    LEFT JOIN hospital_staff hs ON hs.user_id = u.id
    LEFT JOIN hospitals h ON h.id = hs.hospital_id
    LEFT JOIN donor_matching_profiles dmp ON dmp.user_id = u.id
    ORDER BY u.role ASC
  `).all();
}
