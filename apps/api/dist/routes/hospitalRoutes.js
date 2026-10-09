"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_js_1 = require("../db.js");
const authMiddleware_js_1 = require("../middleware/authMiddleware.js");
const router = (0, express_1.Router)();
// GET all registered hospitals and blood banks
router.get('/', (req, res) => {
    const hospitals = db_js_1.db.prepare(`
    SELECT h.*, 
           COUNT(DISTINCT i.id) as inventoryBatchesCount,
           COALESCE(SUM(CASE WHEN i.status = 'available' THEN i.units_count ELSE 0 END), 0) as totalAvailableUnits
    FROM hospitals h
    LEFT JOIN blood_inventory i ON i.hospital_id = h.id
    GROUP BY h.id
    ORDER BY h.name ASC
  `).all();
    res.json({ hospitals });
});
// GET single hospital with full inventory breakdown
router.get('/:id', (req, res) => {
    const hospital = db_js_1.db.prepare('SELECT * FROM hospitals WHERE id = ?').get(req.params.id);
    if (!hospital) {
        return res.status(404).json({ error: 'Hospital not found' });
    }
    const inventory = db_js_1.db.prepare(`
    SELECT blood_group as bloodGroup, component, status, SUM(units_count) as units
    FROM blood_inventory
    WHERE hospital_id = ?
    GROUP BY blood_group, component, status
  `).all(req.params.id);
    res.json({ hospital, inventory });
});
// POST verify hospital (Admin only)
router.post('/:id/verify', authMiddleware_js_1.authenticateJWT, (0, authMiddleware_js_1.requireRole)(['admin']), (req, res) => {
    const { id } = req.params;
    db_js_1.db.prepare('UPDATE hospitals SET is_verified = 1, updated_at = datetime(\'now\') WHERE id = ?').run(id);
    res.json({ success: true, message: 'Hospital verification confirmed' });
});
exports.default = router;
