export interface AuditLogEntry {
    actorUserId?: string;
    actorRole: string;
    action: string;
    resourceType: string;
    resourceId: string;
    metadata?: Record<string, any>;
    ipAddress?: string;
}
export declare function logAuditEvent(entry: AuditLogEntry): void;
