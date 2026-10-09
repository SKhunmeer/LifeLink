import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from './server.js';

describe('BloodLink AI Backend API Integration Tests', () => {
  let authToken = '';
  let hospitalStaffToken = '';
  let testRequestId = '';
  let testInventoryId = '';

  beforeAll(async () => {
    // Login as admin
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@bloodlink.ai', password: 'BloodLink2026!' });
    
    expect(adminLogin.status).toBe(200);
    authToken = adminLogin.body.token;

    // Login as hospital staff
    const staffLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'metro.staff@bloodlink.ai', password: 'BloodLink2026!' });
    
    expect(staffLogin.status).toBe(200);
    hospitalStaffToken = staffLogin.body.token;
  });

  it('GET /api/health returns healthy status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.product).toBe('BloodLink AI');
  });

  it('GET /api/inventory returns seeded blood inventory batches', async () => {
    const res = await request(app).get('/api/inventory');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.inventory)).toBe(true);
    expect(res.body.inventory.length).toBeGreaterThan(0);

    const firstItem = res.body.inventory[0];
    testInventoryId = firstItem.id;
    expect(firstItem).toHaveProperty('bloodGroup');
    expect(firstItem).toHaveProperty('component');
    expect(firstItem).toHaveProperty('unitsCount');
  });

  it('POST /api/requests creates emergency patient blood request with facility ranking', async () => {
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

    const res = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${authToken}`)
      .send(reqBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.requestId).toBeDefined();
    expect(Array.isArray(res.body.facilityMatches)).toBe(true);
    testRequestId = res.body.requestId;
  });

  it('POST /api/requests/:id/verify verifies the emergency request', async () => {
    const res = await request(app)
      .post(`/api/requests/${testRequestId}/verify`)
      .set('Authorization', `Bearer ${hospitalStaffToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('verified');
  });

  it('POST /api/inventory/adjust atomically modifies inventory units', async () => {
    const res = await request(app)
      .post('/api/inventory/adjust')
      .set('Authorization', `Bearer ${hospitalStaffToken}`)
      .send({
        inventoryId: testInventoryId,
        action: 'add',
        units: 2,
        reason: 'Laboratory intake shipment verified'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /api/requests/:id/donor-outreach launches privacy-preserving donor matching & SMS', async () => {
    const res = await request(app)
      .post(`/api/requests/${testRequestId}/donor-outreach`)
      .set('Authorization', `Bearer ${hospitalStaffToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.candidatesAlerted).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(res.body.matches)).toBe(true);
  });

  it('GET /api/notifications returns logs with masked recipient phone numbers', async () => {
    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.logs)).toBe(true);
    expect(res.body.logs.length).toBeGreaterThan(0);

    const log = res.body.logs[0];
    // Crucial privacy check: phone numbers must be masked!
    expect(log.recipient_phone_masked).toContain('***');
    expect(log.recipient_phone_masked).not.toMatch(/^\+1[0-9]{10}$/);
  });
});
