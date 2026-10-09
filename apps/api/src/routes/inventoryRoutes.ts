import { Router } from 'express';
import { getInventory, adjustInventoryAtomic, getInventoryAnalytics } from '../services/inventoryService.js';
import { authenticateJWT, requireRole, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { InventoryAdjustmentSchema, InventoryUpdateSchema } from '@bloodlink/shared';
import { db } from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import { broadcastRealtimeEvent } from '../services/realtimeService.js';

const router = Router();

// GET all inventory (public/authenticated with filters)
router.get('/', (req, res) => {
  const { hospitalId, bloodGroup, component, status } = req.query as any;
  const items = getInventory({
    hospitalId,
    bloodGroup,
    component,
    status
  });
  res.json({ inventory: items });
});

// GET inventory analytics
router.get('/analytics', (req, res) => {
  const analytics = getInventoryAnalytics();
  res.json(analytics);
});

// GET inventory movement history
router.get('/movements', authenticateJWT, (req, res) => {
  const movements = db.prepare(`
    SELECT m.*, h.name as hospitalName, u.full_name as performedByName
    FROM blood_inventory_movements m
    JOIN hospitals h ON h.id = m.hospital_id
    LEFT JOIN user_profiles u ON u.id = m.performed_by_user_id
    ORDER BY m.timestamp DESC
    LIMIT 100
  `).all();
  res.json({ movements });
});

// POST add new inventory batch (Hospital Staff only)
router.post('/', authenticateJWT, requireRole(['hospital_staff', 'admin']), (req: AuthenticatedRequest, res) => {
  try {
    const parse = InventoryUpdateSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.errors[0].message });
    }

    const { bloodGroup, component, unitsCount, status, batchNumber, storageLocation, collectionDate, expiryDate } = parse.data;

    // Determine hospitalId from user's affiliation or body if admin
    let hospitalId = req.body.hospitalId;
    if (!hospitalId) {
      const staff = db.prepare('SELECT hospital_id FROM hospital_staff WHERE user_id = ?').get(req.user!.userId) as any;
      if (staff) {
        hospitalId = staff.hospital_id;
      }
    }

    if (!hospitalId) {
      return res.status(400).json({ error: 'Hospital ID could not be identified' });
    }

    const id = uuidv4();
    db.prepare(`
      INSERT INTO blood_inventory (id, hospital_id, blood_group, component, units_count, status, batch_number, storage_location, collection_date, expiry_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, hospitalId, bloodGroup, component, unitsCount, status, batchNumber, storageLocation || 'Refrig Main', collectionDate, expiryDate);

    // Record movement
    db.prepare(`
      INSERT INTO blood_inventory_movements (id, inventory_id, hospital_id, action, quantity, previous_status, new_status, reason, performed_by_user_id)
      VALUES (?, ?, ?, 'added', ?, 'none', ?, 'Batch intake', ?)
    `).run(uuidv4(), id, hospitalId, unitsCount, status, req.user!.userId);

    broadcastRealtimeEvent('INVENTORY_UPDATED', { id, hospitalId, bloodGroup, component, unitsCount, status });

    res.status(201).json({ success: true, id });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// POST atomic adjustment (reserve, issue, quarantine, expire, add)
router.post('/adjust', authenticateJWT, requireRole(['hospital_staff', 'admin']), (req: AuthenticatedRequest, res) => {
  try {
    const parse = InventoryAdjustmentSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.errors[0].message });
    }

    const { inventoryId } = req.body;
    if (!inventoryId) {
      return res.status(400).json({ error: 'inventoryId is required' });
    }

    const result = adjustInventoryAtomic({
      inventoryId,
      action: parse.data.action,
      units: parse.data.units,
      reason: parse.data.reason,
      referenceRequestId: parse.data.referenceRequestId,
      performedByUserId: req.user!.userId
    });

    res.json({ success: true, result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
