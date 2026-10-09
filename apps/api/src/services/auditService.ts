import { db } from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import { broadcastRealtimeEvent } from './realtimeService.js';

export interface AuditLogEntry {
  actorUserId?: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
}

export function logAuditEvent(entry: AuditLogEntry) {
  try {
    const id = uuidv4();
    const metadataStr = JSON.stringify(entry.metadata || {});

    db.prepare(`
      INSERT INTO audit_logs (id, actor_user_id, actor_role, action, resource_type, resource_id, metadata_json, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      entry.actorUserId || null,
      entry.actorRole,
      entry.action,
      entry.resourceType,
      entry.resourceId,
      metadataStr,
      entry.ipAddress || '127.0.0.1'
    );

    broadcastRealtimeEvent('AUDIT_LOG_CREATED', {
      id,
      ...entry,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[AuditService] Failed to record audit log:', error);
  }
}
