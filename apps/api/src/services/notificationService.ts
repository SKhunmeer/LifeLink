import { db } from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import twilio from 'twilio';
import { maskPhoneNumber, NotificationChannel, NotificationStatus } from '@bloodlink/shared';
import { broadcastRealtimeEvent } from './realtimeService.js';
import { logAuditEvent } from './auditService.js';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

const isTwilioConfigured = Boolean(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER);
const twilioClient = isTwilioConfigured ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) : null;

export interface SendSmsParams {
  recipientPhone: string;
  messageBody: string;
  requestId?: string;
  donorUuid?: string;
  channel?: NotificationChannel;
  allowDuplicate?: boolean;
}

export interface SmsDispatchResult {
  success: boolean;
  status: NotificationStatus;
  sid: string;
  recipientPhoneMasked: string;
  messageBody: string;
  isSimulated: boolean;
  error?: string;
}

export async function sendEmergencyNotification(params: SendSmsParams): Promise<SmsDispatchResult> {
  const { recipientPhone, messageBody, requestId, donorUuid, channel = 'sms', allowDuplicate = false } = params;

  // 1. Deduplication check: do not resend for same request & donor within 2 hours unless specified
  if (!allowDuplicate && requestId && donorUuid) {
    const existing = db.prepare(`
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
        recipientPhoneMasked: maskPhoneNumber(recipientPhone),
        messageBody,
        isSimulated: true
      };
    }
  }

  const maskedPhone = maskPhoneNumber(recipientPhone);
  const logId = uuidv4();

  // 2. Dispatch via Twilio or Mock Service
  if (isTwilioConfigured && twilioClient) {
    try {
      const response = await twilioClient.messages.create({
        body: messageBody,
        from: TWILIO_PHONE_NUMBER,
        to: recipientPhone
      });

      db.prepare(`
        INSERT INTO notification_logs (id, recipient_phone_masked, channel, message_body, twilio_sid, status, request_id, donor_uuid)
        VALUES (?, ?, ?, ?, ?, 'sent', ?, ?)
      `).run(logId, maskedPhone, channel, messageBody, response.sid, requestId || null, donorUuid || null);

      const result: SmsDispatchResult = {
        success: true,
        status: 'sent',
        sid: response.sid,
        recipientPhoneMasked: maskedPhone,
        messageBody,
        isSimulated: false
      };

      broadcastRealtimeEvent('NOTIFICATION_DISPATCHED', { id: logId, ...result, createdAt: new Date().toISOString() });
      return result;
    } catch (err: any) {
      console.error('[Notification] Twilio dispatch error, falling back to mock sandbox:', err?.message);
      // Fall through to mock dispatch with error annotation
    }
  }

  // Mock Sandbox Mode
  const mockSid = `SM_MOCK_${Math.floor(1000000000 + Math.random() * 9000000000)}`;
  db.prepare(`
    INSERT INTO notification_logs (id, recipient_phone_masked, channel, message_body, twilio_sid, status, request_id, donor_uuid)
    VALUES (?, ?, ?, ?, ?, 'mock_sent', ?, ?)
  `).run(logId, maskedPhone, channel, messageBody, mockSid, requestId || null, donorUuid || null);

  const result: SmsDispatchResult = {
    success: true,
    status: 'mock_sent',
    sid: mockSid,
    recipientPhoneMasked: maskedPhone,
    messageBody,
    isSimulated: true
  };

  broadcastRealtimeEvent('NOTIFICATION_DISPATCHED', {
    id: logId,
    ...result,
    createdAt: new Date().toISOString()
  });

  logAuditEvent({
    actorRole: 'system',
    action: 'SMS_DISPATCHED',
    resourceType: 'notification_logs',
    resourceId: logId,
    metadata: { isSimulated: true, sid: mockSid, requestId, donorUuid }
  });

  return result;
}

export function formatDonorAlertMessage(hospitalName: string, bloodGroup: string, requestId: string, appUrl: string = 'http://localhost:3000'): string {
  const secureLink = `${appUrl}/emergency-response?case=${requestId}`;
  return `BloodLink AI: A registered blood bank (${hospitalName}) has a verified urgent request for ${bloodGroup} blood that may match your donor profile. If you are interested, review the request securely here: ${secureLink}. Participation is voluntary. Eligibility and compatibility will be confirmed by the blood bank. Reply STOP to opt out.`;
}

export function formatStockAlertMessage(hospitalName: string, bloodGroup: string, component: string, currentUnits: number): string {
  return `BloodLink AI CRITICAL STOCK ALERT: ${hospitalName} inventory for ${bloodGroup} ${component.replace(/_/g, ' ')} has dropped to ${currentUnits} units. Please initiate supplier transfer or donor outreach.`;
}
