import { Router } from 'express';
import { db } from '../db.js';
import { authenticateJWT, requireRole } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/', authenticateJWT, requireRole(['admin']), (req, res) => {
  const logs = db.prepare(`
    SELECT a.*, u.full_name as actorName, u.email as actorEmail
    FROM audit_logs a
    LEFT JOIN user_profiles u ON u.id = a.actor_user_id
    ORDER BY a.timestamp DESC
    LIMIT 200
  `).all();

  res.json({ logs });
});

export default router;
