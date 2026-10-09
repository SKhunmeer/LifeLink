"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_js_1 = require("../db.js");
const notificationService_js_1 = require("../services/notificationService.js");
const authMiddleware_js_1 = require("../middleware/authMiddleware.js");
const router = (0, express_1.Router)();
// GET notification audit logs (Masked recipient phones!)
router.get('/', authMiddleware_js_1.authenticateJWT, (req, res) => {
    const logs = db_js_1.db.prepare(`
    SELECT n.*, r.blood_group as requestBloodGroup, r.urgency as requestUrgency
    FROM notification_logs n
    LEFT JOIN patient_requests r ON r.id = n.request_id
    ORDER BY n.created_at DESC
    LIMIT 100
  `).all();
    res.json({ logs });
});
// POST send test notification (Admin & Staff)
router.post('/test', authMiddleware_js_1.authenticateJWT, (0, authMiddleware_js_1.requireRole)(['hospital_staff', 'admin']), async (req, res) => {
    const { phone, message } = req.body;
    if (!phone || !message) {
        return res.status(400).json({ error: 'phone and message are required' });
    }
    const result = await (0, notificationService_js_1.sendEmergencyNotification)({
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
        db_js_1.db.prepare(`
      UPDATE notification_logs
      SET status = ?
      WHERE twilio_sid = ?
    `).run(MessageStatus, MessageSid);
    }
    res.status(200).send('<Response></Response>');
});
exports.default = router;
