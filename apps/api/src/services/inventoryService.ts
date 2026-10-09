import { db } from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import { BloodGroup, BloodComponent, InventoryStatus, BloodInventoryItem } from '@bloodlink/shared';
import { broadcastRealtimeEvent } from './realtimeService.js';
import { logAuditEvent } from './auditService.js';
import { sendEmergencyNotification, formatStockAlertMessage } from './notificationService.js';

export interface InventoryFilter {
  hospitalId?: string;
  bloodGroup?: BloodGroup;
  component?: BloodComponent;
  status?: InventoryStatus;
}

export function getInventory(filters: InventoryFilter = {}): BloodInventoryItem[] {
  let query = `
    SELECT i.id, i.hospital_id as hospitalId, i.blood_group as bloodGroup, i.component,
           i.units_count as unitsCount, i.status, i.batch_number as batchNumber,
           i.storage_location as storageLocation, i.collection_date as collectionDate,
           i.expiry_date as expiryDate, i.created_at as createdAt, i.updated_at as updatedAt,
           h.name as hospitalName
    FROM blood_inventory i
    JOIN hospitals h ON h.id = i.hospital_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (filters.hospitalId) {
    query += ' AND i.hospital_id = ?';
    params.push(filters.hospitalId);
  }
  if (filters.bloodGroup) {
    query += ' AND i.blood_group = ?';
    params.push(filters.bloodGroup);
  }
  if (filters.component) {
    query += ' AND i.component = ?';
    params.push(filters.component);
  }
  if (filters.status) {
    query += ' AND i.status = ?';
    params.push(filters.status);
  }

  query += ' ORDER BY i.expiry_date ASC';

  return db.prepare(query).all(...params) as BloodInventoryItem[];
}

export function getAvailableInventoryForMatching(hospitalId: string, bloodGroup: BloodGroup, component: BloodComponent): BloodInventoryItem[] {
  return db.prepare(`
    SELECT i.id, i.hospital_id as hospitalId, i.blood_group as bloodGroup, i.component,
           i.units_count as unitsCount, i.status, i.batch_number as batchNumber,
           i.storage_location as storageLocation, i.collection_date as collectionDate,
           i.expiry_date as expiryDate, i.created_at as createdAt, i.updated_at as updatedAt,
           h.name as hospitalName
    FROM blood_inventory i
    JOIN hospitals h ON h.id = i.hospital_id
    WHERE i.hospital_id = ?
      AND i.blood_group = ?
      AND i.component = ?
      AND i.status = 'available'
      AND date(i.expiry_date) >= date('now')
      AND i.units_count > 0
    ORDER BY i.expiry_date ASC
  `).all(hospitalId, bloodGroup, component) as BloodInventoryItem[];
}

/**
 * Atomic inventory adjustment wrapped in an immediate database transaction
 */
export function adjustInventoryAtomic(params: {
  inventoryId: string;
  action: 'add' | 'reserve' | 'issue' | 'quarantine' | 'expire' | 'release';
  units: number;
  reason: string;
  referenceRequestId?: string;
  performedByUserId: string;
}) {
  const { inventoryId, action, units, reason, referenceRequestId, performedByUserId } = params;

  const transaction = db.transaction(() => {
    const item = db.prepare('SELECT * FROM blood_inventory WHERE id = ?').get(inventoryId) as any;
    if (!item) {
      throw new Error('Inventory item not found');
    }

    let previousStatus = item.status;
    let newStatus = item.status;
    let newCount = item.units_count;

    if (action === 'add') {
      newCount += units;
    } else if (action === 'reserve') {
      if (item.units_count < units) {
        throw new Error(`Insufficient available stock (Available: ${item.units_count}, Requested: ${units})`);
      }
      newCount -= units;
      // create or increment reserved entry
      const existingReserved = db.prepare(`
        SELECT id, units_count FROM blood_inventory
        WHERE hospital_id = ? AND blood_group = ? AND component = ? AND status = 'reserved' AND batch_number = ?
      `).get(item.hospital_id, item.blood_group, item.component, item.batch_number) as any;

      if (existingReserved) {
        db.prepare('UPDATE blood_inventory SET units_count = units_count + ?, updated_at = datetime(\'now\') WHERE id = ?')
          .run(units, existingReserved.id);
      } else {
        db.prepare(`
          INSERT INTO blood_inventory (id, hospital_id, blood_group, component, units_count, status, batch_number, storage_location, collection_date, expiry_date)
          VALUES (?, ?, ?, ?, ?, 'reserved', ?, ?, ?, ?)
        `).run(uuidv4(), item.hospital_id, item.blood_group, item.component, units, item.batch_number, 'Reserved Tray', item.collection_date, item.expiry_date);
      }
    } else if (action === 'issue') {
      if (item.units_count < units) {
        throw new Error(`Cannot issue ${units} units; only ${item.units_count} available.`);
      }
      newCount -= units;
    } else if (action === 'quarantine') {
      if (item.units_count < units) {
        throw new Error(`Cannot quarantine ${units} units; only ${item.units_count} present.`);
      }
      newCount -= units;
      newStatus = 'quarantined';
    } else if (action === 'expire') {
      if (item.units_count < units) {
        throw new Error(`Cannot expire ${units} units; only ${item.units_count} present.`);
      }
      newCount -= units;
      newStatus = 'expired';
    }

    db.prepare('UPDATE blood_inventory SET units_count = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(newCount, inventoryId);

    // Log movement
    const movementId = uuidv4();
    db.prepare(`
      INSERT INTO blood_inventory_movements (id, inventory_id, hospital_id, action, quantity, previous_status, new_status, reason, reference_request_id, performed_by_user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      movementId,
      inventoryId,
      item.hospital_id,
      action,
      units,
      previousStatus,
      newStatus,
      reason,
      referenceRequestId || null,
      performedByUserId
    );

    return { item, newCount };
  });

  const result = transaction();

  // Broadcast real-time event
  broadcastRealtimeEvent('INVENTORY_UPDATED', {
    inventoryId,
    hospitalId: result.item.hospital_id,
    bloodGroup: result.item.blood_group,
    component: result.item.component,
    newUnitsCount: result.newCount
  });

  // Audit log
  logAuditEvent({
    actorUserId: performedByUserId,
    actorRole: 'hospital_staff',
    action: `INVENTORY_${action.toUpperCase()}`,
    resourceType: 'blood_inventory',
    resourceId: inventoryId,
    metadata: { units, reason, referenceRequestId }
  });

  // Check critical thresholds
  checkAndTriggerStockAlerts(result.item.hospital_id, result.item.blood_group, result.item.component);

  return result;
}

/**
 * Checks if stock drops below critical threshold and alerts staff
 */
export function checkAndTriggerStockAlerts(hospitalId: string, bloodGroup: BloodGroup, component: BloodComponent) {
  const stock = db.prepare(`
    SELECT SUM(units_count) as total
    FROM blood_inventory
    WHERE hospital_id = ? AND blood_group = ? AND component = ? AND status = 'available' AND date(expiry_date) >= date('now')
  `).get(hospitalId, bloodGroup, component) as { total: number };

  const currentUnits = stock?.total || 0;
  if (currentUnits <= 2) {
    const hospital = db.prepare('SELECT name, emergency_hotline, contact_phone FROM hospitals WHERE id = ?').get(hospitalId) as any;
    if (hospital) {
      console.warn(`[Stock Alert] Critical shortage at ${hospital.name}: ${bloodGroup} ${component} has only ${currentUnits} units remaining!`);
      const alertMsg = formatStockAlertMessage(hospital.name, bloodGroup, component, currentUnits);
      sendEmergencyNotification({
        recipientPhone: hospital.contact_phone,
        messageBody: alertMsg,
        allowDuplicate: false
      }).catch(console.error);
    }
  }
}

/**
 * Returns inventory analytics and threshold monitoring status
 */
export function getInventoryAnalytics() {
  const totalUnits = db.prepare(`
    SELECT status, SUM(units_count) as count
    FROM blood_inventory
    GROUP BY status
  `).all() as { status: string; count: number }[];

  const stockByBloodGroup = db.prepare(`
    SELECT blood_group as bloodGroup, component, SUM(units_count) as units
    FROM blood_inventory
    WHERE status = 'available' AND date(expiry_date) >= date('now')
    GROUP BY blood_group, component
  `).all() as any[];

  const hospitalStocks = db.prepare(`
    SELECT h.id, h.name, SUM(i.units_count) as totalUnits,
           SUM(CASE WHEN i.status = 'available' THEN i.units_count ELSE 0 END) as availableUnits,
           SUM(CASE WHEN i.status = 'reserved' THEN i.units_count ELSE 0 END) as reservedUnits,
           SUM(CASE WHEN i.status = 'quarantined' THEN i.units_count ELSE 0 END) as quarantinedUnits
    FROM hospitals h
    LEFT JOIN blood_inventory i ON i.hospital_id = h.id
    GROUP BY h.id, h.name
  `).all() as any[];

  const requestStats = db.prepare(`
    SELECT status, count(*) as count
    FROM patient_requests
    GROUP BY status
  `).all() as any[];

  return {
    totalUnits,
    stockByBloodGroup,
    hospitalStocks,
    requestStats
  };
}
