"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAuditEvent = logAuditEvent;
const db_js_1 = require("../db.js");
const uuid_1 = require("uuid");
const realtimeService_js_1 = require("./realtimeService.js");
function logAuditEvent(entry) {
    try {
        const id = (0, uuid_1.v4)();
        const metadataStr = JSON.stringify(entry.metadata || {});
        db_js_1.db.prepare(`
      INSERT INTO audit_logs (id, actor_user_id, actor_role, action, resource_type, resource_id, metadata_json, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, entry.actorUserId || null, entry.actorRole, entry.action, entry.resourceType, entry.resourceId, metadataStr, entry.ipAddress || '127.0.0.1');
        (0, realtimeService_js_1.broadcastRealtimeEvent)('AUDIT_LOG_CREATED', {
            id,
            ...entry,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('[AuditService] Failed to record audit log:', error);
    }
}
