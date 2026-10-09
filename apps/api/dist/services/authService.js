"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateToken = generateToken;
exports.verifyToken = verifyToken;
exports.getUserById = getUserById;
exports.getUserByEmail = getUserByEmail;
exports.registerUser = registerUser;
exports.loginUser = loginUser;
exports.getAllDemoAccounts = getAllDemoAccounts;
const db_js_1 = require("../db.js");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const uuid_1 = require("uuid");
const JWT_SECRET = process.env.JWT_SECRET || 'bloodlink-super-secret-key-2026';
function generateToken(payload) {
    return jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}
function verifyToken(token) {
    try {
        return jsonwebtoken_1.default.verify(token, JWT_SECRET);
    }
    catch {
        return null;
    }
}
function getUserById(id) {
    const row = db_js_1.db.prepare(`
    SELECT id, email, role, full_name as fullName, phone, is_verified as isVerified, created_at as createdAt
    FROM user_profiles WHERE id = ?
  `).get(id);
    if (!row)
        return null;
    return {
        ...row,
        isVerified: Boolean(row.isVerified)
    };
}
function getUserByEmail(email) {
    return db_js_1.db.prepare(`
    SELECT id, email, role, full_name as fullName, phone, password_hash as passwordHash, is_verified as isVerified, created_at as createdAt
    FROM user_profiles WHERE email = ?
  `).get(email);
}
async function registerUser(params) {
    const existing = getUserByEmail(params.email);
    if (existing) {
        throw new Error('An account with this email address already exists');
    }
    const userId = (0, uuid_1.v4)();
    const passwordHash = await bcryptjs_1.default.hash(params.password, 10);
    const insertUser = db_js_1.db.prepare(`
    INSERT INTO user_profiles (id, email, role, full_name, phone, password_hash, is_verified)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `);
    insertUser.run(userId, params.email, params.role, params.fullName, params.phone, passwordHash);
    // If role is donor, create matching and private profiles
    if (params.role === 'donor') {
        const donorUuid = (0, uuid_1.v4)();
        db_js_1.db.prepare(`
      INSERT INTO donor_matching_profiles (donor_uuid, user_id, blood_group, lat_approx, lng_approx, city, is_available, is_eligible)
      VALUES (?, ?, ?, ?, ?, ?, 1, 1)
    `).run(donorUuid, userId, params.bloodGroup || 'O+', params.lat || 37.7749, params.lng || -122.4194, params.approxCity || 'San Francisco');
        db_js_1.db.prepare(`
      INSERT INTO donor_private_profiles (donor_uuid, user_id, full_name, phone_number, email, address_approx, emergency_notification_consent)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(donorUuid, userId, params.fullName, params.phone, params.email, params.approxCity || 'San Francisco', params.notificationConsent !== false ? 1 : 0);
    }
    // If role is hospital_staff and hospitalId provided
    if (params.role === 'hospital_staff' && params.hospitalId) {
        db_js_1.db.prepare(`
      INSERT INTO hospital_staff (id, user_id, hospital_id, designation, is_verified)
      VALUES (?, ?, ?, 'Staff Specialist', 1)
    `).run((0, uuid_1.v4)(), userId, params.hospitalId);
    }
    const user = getUserById(userId);
    const token = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName
    });
    return { user, token };
}
async function loginUser(email, password) {
    const userRecord = getUserByEmail(email);
    if (!userRecord) {
        throw new Error('Invalid email or password');
    }
    if (password && userRecord.passwordHash) {
        const matches = await bcryptjs_1.default.compare(password, userRecord.passwordHash);
        if (!matches) {
            throw new Error('Invalid email or password');
        }
    }
    const user = getUserById(userRecord.id);
    const token = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName
    });
    return { user, token };
}
function getAllDemoAccounts() {
    return db_js_1.db.prepare(`
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
