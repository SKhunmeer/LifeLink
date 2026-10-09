import { Router } from 'express';
import { db } from '../db.js';
import { sendEmergencyNotification } from '../services/notificationService.js';
import { authenticateJWT, requireRole, AuthenticatedRequest } from '../middleware/authMiddleware.js';

const router = Router();

// GET notification audit logs (Masked recipient phones!)
router.get('/', authenticateJWT, (req: AuthenticatedRequest, res) => {
  const logs = db.prepare(`
    SELECT n.*, r.blood_group as requestBloodGroup, r.urgency as requestUrgency
    FROM notification_logs n
    LEFT JOIN patient_requests r ON r.id = n.request_id
    ORDER BY n.created_at DESC
    LIMIT 100
  `).all();

  res.json({ logs });
});

// POST send test notification (Admin & Staff)
router.post('/test', authenticateJWT, requireRole(['hospital_staff', 'admin']), async (req: AuthenticatedRequest, res) => {
  const { phone, message } = req.body;
  if (!phone || !message) {
    return res.status(400).json({ error: 'phone and message are required' });
  }

  const result = await sendEmergencyNotification({
    recipientPhone: phone,
    messageBody: message,
    allowDuplicate: true
  });

  res.json(result);
});

// POST Twilio webhook status callback
router.post('/webhooks/twilio/status', (req, res) => {
  const { MessageSid, MessageStatus } = req.body;
  if (MessageSid && MessageStatus) {
    db.prepare(`
      UPDATE notification_logs
      SET status = ?
      WHERE twilio_sid = ?
    `).run(MessageStatus, MessageSid);
  }
  res.status(200).send('<Response></Response>');
});

export default router;
