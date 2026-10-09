"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmergencyNotification = sendEmergencyNotification;
exports.formatDonorAlertMessage = formatDonorAlertMessage;
exports.formatStockAlertMessage = formatStockAlertMessage;
const db_js_1 = require("../db.js");
const uuid_1 = require("uuid");
const twilio_1 = __importDefault(require("twilio"));
const shared_1 = require("@bloodlink/shared");
const realtimeService_js_1 = require("./realtimeService.js");
const auditService_js_1 = require("./auditService.js");
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const isTwilioConfigured = Boolean(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER);
const twilioClient = isTwilioConfigured ? (0, twilio_1.default)(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) : null;
async function sendEmergencyNotification(params) {
    const { recipientPhone, messageBody, requestId, donorUuid, channel = 'sms', allowDuplicate = false } = params;
    // 1. Deduplication check: do not resend for same request & donor within 2 hours unless specified
    if (!allowDuplicate && requestId && donorUuid) {
        const existing = db_js_1.db.prepare(`
      SELECT id, status, created_at FROM notification_logs
      WHERE request_id = ? AND donor_uuid = ? AND status IN ('sent', 'mock_sent', 'delivered')
      AND datetime(created_at) >= datetime('now', '-2 hours')
      LIMIT 1
    `).get(requestId, donorUuid);
        if (existing) {
            console.log(`[Notification] Suppressed duplicate SMS for donor ${donorUuid} and request ${requestId}`);
            return {
                success: true,
                status: 'mock_sent',
                sid: 'DEDUPLICATED_SKIPPED',
                recipientPhoneMasked: (0, shared_1.maskPhoneNumber)(recipientPhone),
                messageBody,
                isSimulated: true
            };
        }
    }
    const maskedPhone = (0, shared_1.maskPhoneNumber)(recipientPhone);
    const logId = (0, uuid_1.v4)();
    // 2. Dispatch via Twilio or Mock Service
    if (isTwilioConfigured && twilioClient) {
        try {
            const response = await twilioClient.messages.create({
                body: messageBody,
                from: TWILIO_PHONE_NUMBER,
                to: recipientPhone
            });
            db_js_1.db.prepare(`
        INSERT INTO notification_logs (id, recipient_phone_masked, channel, message_body, twilio_sid, status, request_id, donor_uuid)
        VALUES (?, ?, ?, ?, ?, 'sent', ?, ?)
      `).run(logId, maskedPhone, channel, messageBody, response.sid, requestId || null, donorUuid || null);
            const result = {
                success: true,
                status: 'sent',
                sid: response.sid,
                recipientPhoneMasked: maskedPhone,
                messageBody,
                isSimulated: false
            };
            (0, realtimeService_js_1.broadcastRealtimeEvent)('NOTIFICATION_DISPATCHED', { id: logId, ...result, createdAt: new Date().toISOString() });
            return result;
        }
        catch (err) {
            console.error('[Notification] Twilio dispatch error, falling back to mock sandbox:', err?.message);
            // Fall through to mock dispatch with error annotation
        }
    }
    // Mock Sandbox Mode
    const mockSid = `SM_MOCK_${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    db_js_1.db.prepare(`
    INSERT INTO notification_logs (id, recipient_phone_masked, channel, message_body, twilio_sid, status, request_id, donor_uuid)
    VALUES (?, ?, ?, ?, ?, 'mock_sent', ?, ?)
  `).run(logId, maskedPhone, channel, messageBody, mockSid, requestId || null, donorUuid || null);
    const result = {
        success: true,
        status: 'mock_sent',
        sid: mockSid,
        recipientPhoneMasked: maskedPhone,
        messageBody,
        isSimulated: true
    };
    (0, realtimeService_js_1.broadcastRealtimeEvent)('NOTIFICATION_DISPATCHED', {
        id: logId,
        ...result,
        createdAt: new Date().toISOString()
    });
    (0, auditService_js_1.logAuditEvent)({
        actorRole: 'system',
        action: 'SMS_DISPATCHED',
        resourceType: 'notification_logs',
        resourceId: logId,
        metadata: { isSimulated: true, sid: mockSid, requestId, donorUuid }
    });
    return result;
}
function formatDonorAlertMessage(hospitalName, bloodGroup, requestId, appUrl = 'http://localhost:3000') {
    const secureLink = `${appUrl}/emergency-response?case=${requestId}`;
    return `BloodLink AI: A registered blood bank (${hospitalName}) has a verified urgent request for ${bloodGroup} blood that may match your donor profile. If you are interested, review the request securely here: ${secureLink}. Participation is voluntary. Eligibility and compatibility will be confirmed by the blood bank. Reply STOP to opt out.`;
}
function formatStockAlertMessage(hospitalName, bloodGroup, component, currentUnits) {
    return `BloodLink AI CRITICAL STOCK ALERT: ${hospitalName} inventory for ${bloodGroup} ${component.replace(/_/g, ' ')} has dropped to ${currentUnits} units. Please initiate supplier transfer or donor outreach.`;
}
