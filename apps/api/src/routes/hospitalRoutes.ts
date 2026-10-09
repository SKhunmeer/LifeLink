import { Router } from 'express';
import { db } from '../db.js';
import { authenticateJWT, requireRole, AuthenticatedRequest } from '../middleware/authMiddleware.js';

const router = Router();

// GET all registered hospitals and blood banks
router.get('/', (req, res) => {
  const hospitals = db.prepare(`
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
