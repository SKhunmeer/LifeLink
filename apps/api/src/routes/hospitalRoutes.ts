import { Router } from 'express';
import { db } from '../db.js';
import { authenticateJWT, requireRole, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { searchNearbyHospitals } from '../services/nearbyHospitalService.js';
import { searchPlaces } from '../services/locationSearchService.js';

const router = Router();

router.get('/geocode', async (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (query.length < 3 || query.length > 200) {
    return res.status(400).json({ error: 'Enter a place name between 3 and 200 characters.' });
  }

  try {
    const places = await searchPlaces(query);
    return res.json({ places, source: 'OpenStreetMap Nominatim' });
  } catch (error) {
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
  if (
    !Number.isFinite(lat) || lat < -90 || lat > 90
    || !Number.isFinite(lng) || lng < -180 || lng > 180
    || !Number.isInteger(radius) || radius < 1000 || radius > 25000
  ) {
    return res.status(400).json({ error: 'Valid latitude, longitude, and a search radius from 1–25 km are required.' });
  }

  try {
    const hospitals = await searchNearbyHospitals(lat, lng, radius);
    return res.json({ hospitals, source: 'OpenStreetMap' });
  } catch (error) {
    console.error('[NearbyHospitals] Search failed:', error);
    return res.status(502).json({
      error: error instanceof Error ? error.message : 'Nearby hospital search is temporarily unavailable. Please retry.',
    });
  }
});

// GET all registered hospitals and blood banks
router.get('/', (req, res) => {
  const hospitals = db.prepare(`
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
  const hospital = db.prepare('SELECT * FROM hospitals WHERE id = ?').get(req.params.id) as any;
  if (!hospital) {
    return res.status(404).json({ error: 'Hospital not found' });
  }

  const inventory = db.prepare(`
    SELECT blood_group as bloodGroup, component, status, SUM(units_count) as units
    FROM blood_inventory
    WHERE hospital_id = ?
    GROUP BY blood_group, component, status
  `).all(req.params.id);

  res.json({ hospital, inventory });
});

// POST verify hospital (Admin only)
router.post('/:id/verify', authenticateJWT, requireRole(['admin']), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  db.prepare('UPDATE hospitals SET is_verified = 1, updated_at = datetime(\'now\') WHERE id = ?').run(id);
  res.json({ success: true, message: 'Hospital verification confirmed' });
});

export default router;
