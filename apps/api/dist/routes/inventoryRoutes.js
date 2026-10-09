"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const inventoryService_js_1 = require("../services/inventoryService.js");
const authMiddleware_js_1 = require("../middleware/authMiddleware.js");
const shared_1 = require("@bloodlink/shared");
const db_js_1 = require("../db.js");
const uuid_1 = require("uuid");
const realtimeService_js_1 = require("../services/realtimeService.js");
const router = (0, express_1.Router)();
// GET all inventory (public/authenticated with filters)
router.get('/', (req, res) => {
    const { hospitalId, bloodGroup, component, status } = req.query;
    const items = (0, inventoryService_js_1.getInventory)({
        hospitalId,
        bloodGroup,
        component,
        status
    });
    res.json({ inventory: items });
});
// GET inventory analytics
router.get('/analytics', (req, res) => {
    const analytics = (0, inventoryService_js_1.getInventoryAnalytics)();
    res.json(analytics);
});
// GET inventory movement history
router.get('/movements', authMiddleware_js_1.authenticateJWT, (req, res) => {
    const movements = db_js_1.db.prepare(`
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
router.post('/', authMiddleware_js_1.authenticateJWT, (0, authMiddleware_js_1.requireRole)(['hospital_staff', 'admin']), (req, res) => {
    try {
        const parse = shared_1.InventoryUpdateSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({ error: parse.error.errors[0].message });
        }
        const { bloodGroup, component, unitsCount, status, batchNumber, storageLocation, collectionDate, expiryDate } = parse.data;
        // Determine hospitalId from user's affiliation or body if admin
        let hospitalId = req.body.hospitalId;
        if (!hospitalId) {
            const staff = db_js_1.db.prepare('SELECT hospital_id FROM hospital_staff WHERE user_id = ?').get(req.user.userId);
            if (staff) {
                hospitalId = staff.hospital_id;
            }
        }
        if (!hospitalId) {
            return res.status(400).json({ error: 'Hospital ID could not be identified' });
        }
        const id = (0, uuid_1.v4)();
        db_js_1.db.prepare(`
      INSERT INTO blood_inventory (id, hospital_id, blood_group, component, units_count, status, batch_number, storage_location, collection_date, expiry_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, hospitalId, bloodGroup, component, unitsCount, status, batchNumber, storageLocation || 'Refrig Main', collectionDate, expiryDate);
        // Record movement
        db_js_1.db.prepare(`
      INSERT INTO blood_inventory_movements (id, inventory_id, hospital_id, action, quantity, previous_status, new_status, reason, performed_by_user_id)
      VALUES (?, ?, ?, 'added', ?, 'none', ?, 'Batch intake', ?)
    `).run((0, uuid_1.v4)(), id, hospitalId, unitsCount, status, req.user.userId);
        (0, realtimeService_js_1.broadcastRealtimeEvent)('INVENTORY_UPDATED', { id, hospitalId, bloodGroup, component, unitsCount, status });
        res.status(201).json({ success: true, id });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// POST atomic adjustment (reserve, issue, quarantine, expire, add)
router.post('/adjust', authMiddleware_js_1.authenticateJWT, (0, authMiddleware_js_1.requireRole)(['hospital_staff', 'admin']), (req, res) => {
    try {
        const parse = shared_1.InventoryAdjustmentSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({ error: parse.error.errors[0].message });
        }
        const { inventoryId } = req.body;
        if (!inventoryId) {
            return res.status(400).json({ error: 'inventoryId is required' });
        }
        const result = (0, inventoryService_js_1.adjustInventoryAtomic)({
            inventoryId,
            action: parse.data.action,
            units: parse.data.units,
            reason: parse.data.reason,
            referenceRequestId: parse.data.referenceRequestId,
            performedByUserId: req.user.userId
        });
        res.json({ success: true, result });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
exports.default = router;
