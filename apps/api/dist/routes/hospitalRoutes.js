"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_js_1 = require("../db.js");
const authMiddleware_js_1 = require("../middleware/authMiddleware.js");
const nearbyHospitalService_js_1 = require("../services/nearbyHospitalService.js");
const locationSearchService_js_1 = require("../services/locationSearchService.js");
const router = (0, express_1.Router)();
router.get('/geocode', async (req, res) => {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (query.length < 3 || query.length > 200) {
        return res.status(400).json({ error: 'Enter a place name between 3 and 200 characters.' });
    }
    try {
        const places = await (0, locationSearchService_js_1.searchPlaces)(query);
        return res.json({ places, source: 'OpenStreetMap Nominatim' });
    }
    catch (error) {
        console.error('[PlaceSearch] Geocoding failed:', error);
        return res.status(502).json({
            error: error instanceof Error ? error.message : 'Live place search is temporarily unavailable. Please retry.',
        });
    }
});
router.get('/nearby', async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radius = Number(req.query.radius ?? 5000);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90
        || !Number.isFinite(lng) || lng < -180 || lng > 180
        || !Number.isInteger(radius) || radius < 1000 || radius > 25000) {
        return res.status(400).json({ error: 'Valid latitude, longitude, and a search radius from 1–25 km are required.' });
    }
    try {
        const hospitals = await (0, nearbyHospitalService_js_1.searchNearbyHospitals)(lat, lng, radius);
        return res.json({ hospitals, source: 'OpenStreetMap' });
    }
    catch (error) {
        console.error('[NearbyHospitals] Search failed:', error);
        return res.status(502).json({
            error: error instanceof Error ? error.message : 'Nearby hospital search is temporarily unavailable. Please retry.',
        });
    }
});
// GET all registered hospitals and blood banks
router.get('/', (req, res) => {
    const hospitals = db_js_1.db.prepare(`
    SELECT h.*, 
           COUNT(DISTINCT i.id) as inventoryBatchesCount,
           COALESCE(SUM(CASE WHEN i.status = 'available' AND date(i.expiry_date) >= date('now') THEN i.units_count ELSE 0 END), 0) as totalAvailableUnits
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
