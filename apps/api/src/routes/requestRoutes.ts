import { Router } from 'express';
import { CreatePatientRequestSchema, BloodGroup, BloodComponent } from '@bloodlink/shared';
import { authenticateJWT, requireRole, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { findCompatibleHospitalInventory, triggerDonorMatchingWorkflow } from '../services/matchingService.js';
import { adjustInventoryAtomic } from '../services/inventoryService.js';
import { broadcastRealtimeEvent } from '../services/realtimeService.js';
import { logAuditEvent } from '../services/auditService.js';
import { db } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// GET all blood requests
router.get('/', (req, res) => {
  const { status, hospitalId, urgency } = req.query as any;
  let query = `
    SELECT r.*, h.name as hospitalName, h.contact_phone as hospitalPhone,
           u.full_name as patientRequesterName
    FROM patient_requests r
    JOIN hospitals h ON h.id = r.hospital_id
    JOIN user_profiles u ON u.id = r.patient_user_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (status) {
    query += ' AND r.status = ?';
    params.push(status);
  }
  if (hospitalId) {
    query += ' AND r.hospital_id = ?';
    params.push(hospitalId);
  }
  if (urgency) {
    query += ' AND r.urgency = ?';
    params.push(urgency);
  }

  // Order by critical urgency first, then submitted date
  query += `
    ORDER BY 
      CASE r.urgency 
        WHEN 'critical' THEN 1 
        WHEN 'urgent' THEN 2 
        ELSE 3 
      END,
      r.created_at DESC
  `;

  const requests = db.prepare(query).all(...params);
  res.json({ requests });
});

// GET single blood request
router.get('/:id', (req, res) => {
  const request = db.prepare(`
    SELECT r.*, h.name as hospitalName, h.lat as hospitalLat, h.lng as hospitalLng,
           h.contact_phone as hospitalPhone, h.emergency_hotline as emergencyHotline,
           u.full_name as patientRequesterName, u.phone as patientRequesterPhone
    FROM patient_requests r
    JOIN hospitals h ON h.id = r.hospital_id
    JOIN user_profiles u ON u.id = r.patient_user_id
    WHERE r.id = ?
  `).get(req.params.id) as any;

  if (!request) {
    return res.status(404).json({ error: 'Blood request not found' });
  }

  // Also query facility compatibility
  const facilityMatches = findCompatibleHospitalInventory(
    request.blood_group as BloodGroup,
    request.component as BloodComponent,
    request.hospitalLat,
    request.hospitalLng
  );

  // Query donor matches (pseudonymous!)
  const donorMatches = db.prepare(`
    SELECT m.*, dmp.blood_group as donorBloodGroup, dmp.city as donorCity
    FROM donor_matches m
    JOIN donor_matching_profiles dmp ON dmp.donor_uuid = m.donor_uuid
    WHERE m.request_id = ?
    ORDER BY m.compatibility_score DESC
  `).all(req.params.id);

  res.json({
    request,
    facilityMatches,
    donorMatches
  });
});

// POST submit urgent blood request (Patients, Attendants, Staff)
router.post('/', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const parse = CreatePatientRequestSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.errors[0].message });
    }

    const {
      patientDisplayName,
      bloodGroup,
      component,
      unitsRequired,
      urgency,
      hospitalId,
      requiredByTime,
      clinicalNotes,
      treatingDoctor,
      wardOrBed
    } = parse.data;

    // Verify hospital exists
    const hospital = db.prepare('SELECT * FROM hospitals WHERE id = ?').get(hospitalId) as any;
    if (!hospital) {
      return res.status(404).json({ error: 'Selected hospital not found' });
    }

    const requestId = uuidv4();
    db.prepare(`
      INSERT INTO patient_requests (id, patient_user_id, patient_display_name, blood_group, component, units_required, units_reserved, urgency, hospital_id, status, required_by_time, clinical_notes, treating_doctor, ward_or_bed)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 'submitted', ?, ?, ?, ?)
    `).run(
      requestId,
      req.user!.userId,
      patientDisplayName,
      bloodGroup,
      component,
      unitsRequired,
      urgency,
      hospitalId,
      requiredByTime,
      clinicalNotes || null,
      treatingDoctor || null,
      wardOrBed || null
    );

    // Rank available compatible hospital inventory
    const facilityMatches = findCompatibleHospitalInventory(
      bloodGroup,
      component,
      hospital.lat,
      hospital.lng
    );

    broadcastRealtimeEvent('REQUEST_CREATED', {
      requestId,
      patientDisplayName,
      bloodGroup,
      component,
      unitsRequired,
      urgency,
      hospitalId,
      hospitalName: hospital.name
    });

    logAuditEvent({
      actorUserId: req.user!.userId,
      actorRole: req.user!.role,
      action: 'PATIENT_REQUEST_SUBMITTED',
      resourceType: 'patient_requests',
      resourceId: requestId,
      metadata: { bloodGroup, component, unitsRequired, urgency, hospitalId }
    });

    res.status(201).json({
      success: true,
      requestId,
      facilityMatches
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// POST verify request by hospital staff
router.post('/:id/verify', authenticateJWT, requireRole(['hospital_staff', 'admin']), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const request = db.prepare('SELECT * FROM patient_requests WHERE id = ?').get(id) as any;
  if (!request) {
    return res.status(404).json({ error: 'Request not found' });
  }

  db.prepare(`
    UPDATE patient_requests
    SET status = 'verified', updated_at = datetime('now')
    WHERE id = ?
  `).run(id);

  broadcastRealtimeEvent('REQUEST_STATUS_UPDATED', { requestId: id, newStatus: 'verified' });

  logAuditEvent({
    actorUserId: req.user!.userId,
    actorRole: 'hospital_staff',
    action: 'REQUEST_VERIFIED',
    resourceType: 'patient_requests',
    resourceId: id
  });

  res.json({ success: true, status: 'verified' });
});

// POST reserve blood units atomically for verified request
router.post('/:id/reserve', authenticateJWT, requireRole(['hospital_staff', 'admin']), (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { inventoryId, units } = req.body;

    if (!inventoryId || !units || units < 1) {
      return res.status(400).json({ error: 'inventoryId and units (>= 1) are required' });
    }

    const request = db.prepare('SELECT * FROM patient_requests WHERE id = ?').get(id) as any;
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Atomic reservation through inventoryService
    const adjustResult = adjustInventoryAtomic({
      inventoryId,
      action: 'reserve',
      units: Number(units),
      reason: `Reserved for emergency request #${id}`,
      referenceRequestId: id,
      performedByUserId: req.user!.userId
    });

    // Update patient_requests
    const newReserved = (request.units_reserved || 0) + Number(units);
    const newStatus = newReserved >= request.units_required ? 'reserved' : request.status;

    db.prepare(`
      UPDATE patient_requests
      SET units_reserved = ?, status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(newReserved, newStatus, id);

    broadcastRealtimeEvent('REQUEST_STATUS_UPDATED', {
      requestId: id,
      unitsReserved: newReserved,
      newStatus
    });

    res.json({ success: true, unitsReserved: newReserved, status: newStatus });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// POST trigger emergency donor outreach
router.post('/:id/donor-outreach', authenticateJWT, requireRole(['hospital_staff', 'admin']), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const result = await triggerDonorMatchingWorkflow({
      requestId: id,
      performedByUserId: req.user!.userId
    });

    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// POST fulfill request
router.post('/:id/fulfill', authenticateJWT, requireRole(['hospital_staff', 'admin']), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const request = db.prepare('SELECT * FROM patient_requests WHERE id = ?').get(id) as any;
  if (!request) {
    return res.status(404).json({ error: 'Request not found' });
  }

  db.prepare(`
    UPDATE patient_requests
    SET status = 'fulfilled', updated_at = datetime('now')
    WHERE id = ?
  `).run(id);

  broadcastRealtimeEvent('REQUEST_STATUS_UPDATED', { requestId: id, newStatus: 'fulfilled' });

  logAuditEvent({
    actorUserId: req.user!.userId,
    actorRole: 'hospital_staff',
    action: 'REQUEST_FULFILLED',
    resourceType: 'patient_requests',
    resourceId: id
  });

  res.json({ success: true, status: 'fulfilled' });
});

// POST cancel request
router.post('/:id/cancel', authenticateJWT, (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const request = db.prepare('SELECT * FROM patient_requests WHERE id = ?').get(id) as any;
  if (!request) {
    return res.status(404).json({ error: 'Request not found' });
  }

  db.prepare(`
    UPDATE patient_requests
    SET status = 'cancelled', updated_at = datetime('now')
    WHERE id = ?
  `).run(id);

  broadcastRealtimeEvent('REQUEST_STATUS_UPDATED', { requestId: id, newStatus: 'cancelled' });

  logAuditEvent({
    actorUserId: req.user!.userId,
    actorRole: req.user!.role,
    action: 'REQUEST_CANCELLED',
    resourceType: 'patient_requests',
    resourceId: id
  });

  res.json({ success: true, status: 'cancelled' });
});

export default router;
