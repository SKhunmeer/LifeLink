import { Router } from 'express';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { calculateDonationEligibility } from '@bloodlink/compatibility';
import { handleDonorResponse } from '../services/matchingService.js';
import { db } from '../db.js';

const router = Router();

// GET donor's own profile and stats
router.get('/profile', authenticateJWT, (req: AuthenticatedRequest, res) => {
  const matching = db.prepare(`
    SELECT * FROM donor_matching_profiles WHERE user_id = ?
  `).get(req.user!.userId) as any;

  if (!matching) {
    return res.status(404).json({ error: 'Donor profile not found for this account' });
  }

  const privateProfile = db.prepare(`
    SELECT emergency_notification_consent, opt_out_status, address_approx, last_sms_sent_at
    FROM donor_private_profiles WHERE donor_uuid = ?
  `).get(matching.donor_uuid) as any;

  // Calculate dynamic 56-day eligibility
  const eligibility = calculateDonationEligibility(matching.last_donation_date, 'whole_blood');

  res.json({
    matchingProfile: matching,
    preferences: privateProfile,
    eligibility
  });
});

// PATCH donor availability & preferences
router.patch('/availability', authenticateJWT, (req: AuthenticatedRequest, res) => {
  const { isAvailable, serviceRadiusKm, notificationConsent, optOutStatus } = req.body;

  const matching = db.prepare('SELECT donor_uuid FROM donor_matching_profiles WHERE user_id = ?').get(req.user!.userId) as any;
  if (!matching) {
    return res.status(404).json({ error: 'Donor profile not found' });
  }

  if (isAvailable !== undefined) {
    db.prepare('UPDATE donor_matching_profiles SET is_available = ?, updated_at = datetime(\'now\') WHERE donor_uuid = ?')
      .run(isAvailable ? 1 : 0, matching.donor_uuid);
  }

  if (serviceRadiusKm !== undefined) {
    db.prepare('UPDATE donor_matching_profiles SET service_radius_km = ?, updated_at = datetime(\'now\') WHERE donor_uuid = ?')
      .run(Number(serviceRadiusKm), matching.donor_uuid);
  }

  if (notificationConsent !== undefined || optOutStatus !== undefined) {
    db.prepare(`
      UPDATE donor_private_profiles
      SET emergency_notification_consent = COALESCE(?, emergency_notification_consent),
          opt_out_status = COALESCE(?, opt_out_status),
          updated_at = datetime('now')
      WHERE donor_uuid = ?
    `).run(
      notificationConsent !== undefined ? (notificationConsent ? 1 : 0) : null,
      optOutStatus !== undefined ? (optOutStatus ? 1 : 0) : null,
      matching.donor_uuid
    );
  }

  res.json({ success: true, message: 'Donor preferences updated successfully' });
});

// GET requests matching this donor
router.get('/matching-requests', authenticateJWT, (req: AuthenticatedRequest, res) => {
  const matching = db.prepare('SELECT donor_uuid FROM donor_matching_profiles WHERE user_id = ?').get(req.user!.userId) as any;
  if (!matching) {
    return res.status(404).json({ error: 'Donor profile not found' });
  }

  const matches = db.prepare(`
    SELECT m.id as matchId, m.request_id as requestId, m.distance_km as distanceKm,
           m.compatibility_score as compatibilityScore, m.notification_status as notificationStatus,
           m.donor_response as donorResponse, m.notification_sent_at as notificationSentAt,
           r.blood_group as bloodGroup, r.component, r.urgency, r.status as requestStatus,
           r.required_by_time as requiredByTime,
           h.name as hospitalName, h.address as hospitalAddress, h.emergency_hotline as hospitalHotline
    FROM donor_matches m
    JOIN patient_requests r ON r.id = m.request_id
    JOIN hospitals h ON h.id = r.hospital_id
    WHERE m.donor_uuid = ?
    ORDER BY m.created_at DESC
  `).all(matching.donor_uuid);

  res.json({ matches });
});

// POST donor response to an invitation
router.post('/respond', authenticateJWT, (req: AuthenticatedRequest, res) => {
  const { matchId, response, notes } = req.body;
  if (!matchId || !['accepted', 'declined'].includes(response)) {
    return res.status(400).json({ error: 'Valid matchId and response (accepted | declined) are required' });
  }

  try {
    const result = handleDonorResponse(matchId, response, notes);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// GET donor verified donation history
router.get('/history', authenticateJWT, (req: AuthenticatedRequest, res) => {
  const matching = db.prepare('SELECT donor_uuid FROM donor_matching_profiles WHERE user_id = ?').get(req.user!.userId) as any;
  if (!matching) {
    return res.status(404).json({ error: 'Donor profile not found' });
  }

  const history = db.prepare(`
    SELECT dr.*, h.name as hospitalName, u.full_name as verifiedByName
    FROM donation_records dr
    JOIN hospitals h ON h.id = dr.hospital_id
    LEFT JOIN user_profiles u ON u.id = dr.verified_by_user_id
    WHERE dr.donor_uuid = ?
    ORDER BY dr.donation_date DESC
  `).all(matching.donor_uuid);

  res.json({ history });
});

export default router;
