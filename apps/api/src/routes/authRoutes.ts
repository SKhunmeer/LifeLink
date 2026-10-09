import { Router } from 'express';
import { RegisterSchema, LoginSchema } from '@bloodlink/shared';
import { registerUser, loginUser, getUserById, getAllDemoAccounts, generateToken } from '../services/authService.js';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { db } from '../db.js';

const router = Router();

router.post('/register', authLimiter, async (req, res) => {
  try {
    const parseResult = RegisterSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const { user, token } = await registerUser(parseResult.data);
    res.status(201).json({ user, token });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/login', authLimiter, async (req, res) => {
  try {
    const parseResult = LoginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const { user, token } = await loginUser(parseResult.data.email, parseResult.data.password);
    res.json({ user, token });
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
});

router.get('/me', authenticateJWT, (req: AuthenticatedRequest, res) => {
  const user = getUserById(req.user!.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Enrich with role specific metadata
  let hospitalDetails = null;
  if (user.role === 'hospital_staff') {
    hospitalDetails = db.prepare(`
      SELECT hs.designation, hs.is_verified as staffVerified, h.*
      FROM hospital_staff hs
      JOIN hospitals h ON h.id = hs.hospital_id
      WHERE hs.user_id = ?
    `).get(user.id);
  }

  let donorDetails = null;
  if (user.role === 'donor') {
    donorDetails = db.prepare(`
      SELECT dmp.*, dpp.emergency_notification_consent, dpp.opt_out_status
      FROM donor_matching_profiles dmp
      JOIN donor_private_profiles dpp ON dpp.donor_uuid = dmp.donor_uuid
      WHERE dmp.user_id = ?
    `).get(user.id);
  }

  res.json({
    user,
    hospital: hospitalDetails,
    donor: donorDetails
  });
});

router.get('/demo-accounts', (req, res) => {
  const accounts = getAllDemoAccounts();
  res.json({ accounts });
});

router.post('/switch-demo', (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const user = getUserById(userId);
  if (!user) {
    return res.status(404).json({ error: 'Demo user not found' });
  }

  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    fullName: user.fullName
  });

  res.json({ user, token });
});

export default router;
