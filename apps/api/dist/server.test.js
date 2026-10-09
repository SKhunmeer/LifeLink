"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const supertest_1 = __importDefault(require("supertest"));
const server_js_1 = require("./server.js");
(0, vitest_1.describe)('BloodLink AI Backend API Integration Tests', () => {
    let authToken = '';
    let hospitalStaffToken = '';
    let testRequestId = '';
    let testInventoryId = '';
    (0, vitest_1.beforeAll)(async () => {
        // Login as admin
        const adminLogin = await (0, supertest_1.default)(server_js_1.app)
            .post('/api/auth/login')
            .send({ email: 'admin@bloodlink.ai', password: 'BloodLink2026!' });
        (0, vitest_1.expect)(adminLogin.status).toBe(200);
        authToken = adminLogin.body.token;
        // Login as hospital staff
        const staffLogin = await (0, supertest_1.default)(server_js_1.app)
            .post('/api/auth/login')
            .send({ email: 'metro.staff@bloodlink.ai', password: 'BloodLink2026!' });
        (0, vitest_1.expect)(staffLogin.status).toBe(200);
        hospitalStaffToken = staffLogin.body.token;
    });
    (0, vitest_1.it)('GET /api/health returns healthy status', async () => {
        const res = await (0, supertest_1.default)(server_js_1.app).get('/api/health');
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.status).toBe('healthy');
        (0, vitest_1.expect)(res.body.product).toBe('BloodLink AI');
    });
    (0, vitest_1.it)('GET /api/inventory returns seeded blood inventory batches', async () => {
        const res = await (0, supertest_1.default)(server_js_1.app).get('/api/inventory');
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(Array.isArray(res.body.inventory)).toBe(true);
        (0, vitest_1.expect)(res.body.inventory.length).toBeGreaterThan(0);
        const firstItem = res.body.inventory[0];
        testInventoryId = firstItem.id;
        (0, vitest_1.expect)(firstItem).toHaveProperty('bloodGroup');
        (0, vitest_1.expect)(firstItem).toHaveProperty('component');
        (0, vitest_1.expect)(firstItem).toHaveProperty('unitsCount');
    });
    (0, vitest_1.it)('POST /api/requests creates emergency patient blood request with facility ranking', async () => {
        const reqBody = {
            patientDisplayName: 'Emergency Trauma Patient #104',
            bloodGroup: 'O-',
            component: 'packed_red_blood_cells',
            unitsRequired: 2,
            urgency: 'critical',
            hospitalId: 'h0000000-0000-0000-0000-000000000001',
            requiredByTime: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
            clinicalNotes: 'Major arterial bleed in OR 3',
            treatingDoctor: 'Dr. Evans'
        };
        const res = await (0, supertest_1.default)(server_js_1.app)
            .post('/api/requests')
            .set('Authorization', `Bearer ${authToken}`)
            .send(reqBody);
        (0, vitest_1.expect)(res.status).toBe(201);
        (0, vitest_1.expect)(res.body.success).toBe(true);
        (0, vitest_1.expect)(res.body.requestId).toBeDefined();
        (0, vitest_1.expect)(Array.isArray(res.body.facilityMatches)).toBe(true);
        testRequestId = res.body.requestId;
    });
    (0, vitest_1.it)('POST /api/requests/:id/verify verifies the emergency request', async () => {
        const res = await (0, supertest_1.default)(server_js_1.app)
            .post(`/api/requests/${testRequestId}/verify`)
            .set('Authorization', `Bearer ${hospitalStaffToken}`);
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.status).toBe('verified');
    });
    (0, vitest_1.it)('POST /api/inventory/adjust atomically modifies inventory units', async () => {
        const res = await (0, supertest_1.default)(server_js_1.app)
            .post('/api/inventory/adjust')
            .set('Authorization', `Bearer ${hospitalStaffToken}`)
            .send({
            inventoryId: testInventoryId,
            action: 'add',
            units: 2,
            reason: 'Laboratory intake shipment verified'
        });
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.success).toBe(true);
    });
    (0, vitest_1.it)('POST /api/requests/:id/donor-outreach launches privacy-preserving donor matching & SMS', async () => {
        const res = await (0, supertest_1.default)(server_js_1.app)
            .post(`/api/requests/${testRequestId}/donor-outreach`)
            .set('Authorization', `Bearer ${hospitalStaffToken}`);
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.success).toBe(true);
        (0, vitest_1.expect)(res.body.candidatesAlerted).toBeGreaterThanOrEqual(1);
        (0, vitest_1.expect)(Array.isArray(res.body.matches)).toBe(true);
    });
    (0, vitest_1.it)('GET /api/notifications returns logs with masked recipient phone numbers', async () => {
        const res = await (0, supertest_1.default)(server_js_1.app)
            .get('/api/notifications')
            .set('Authorization', `Bearer ${authToken}`);
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(Array.isArray(res.body.logs)).toBe(true);
        (0, vitest_1.expect)(res.body.logs.length).toBeGreaterThan(0);
        const log = res.body.logs[0];
        // Crucial privacy check: phone numbers must be masked!
        (0, vitest_1.expect)(log.recipient_phone_masked).toContain('***');
        (0, vitest_1.expect)(log.recipient_phone_masked).not.toMatch(/^\+1[0-9]{10}$/);
    });
});
