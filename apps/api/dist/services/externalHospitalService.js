"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findOrCreateExternalHospital = findOrCreateExternalHospital;
const uuid_1 = require("uuid");
const db_js_1 = require("../db.js");
function findOrCreateExternalHospital(facility) {
    const sourceId = facility.id.replace(/^nominatim\//, '');
    const existing = db_js_1.db.prepare('SELECT id FROM hospitals WHERE source_id = ?').get(sourceId);
    if (existing) {
        db_js_1.db.prepare(`
      UPDATE hospitals
      SET name = ?, address = ?, lat = ?, lng = ?, contact_phone = ?, emergency_hotline = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(facility.name, facility.address || 'Address not listed in OpenStreetMap', facility.lat, facility.lng, facility.phone || '', facility.phone || '', existing.id);
        return existing.id;
    }
    const id = (0, uuid_1.v4)();
    db_js_1.db.prepare(`
    INSERT INTO hospitals (
      id, name, license_number, address, city, state, postal_code, lat, lng,
      contact_phone, emergency_hotline, source, source_id, is_verified, operating_hours, available_beds
    ) VALUES (?, ?, ?, ?, 'Unknown', 'Unknown', NULL, ?, ?, ?, ?, 'openstreetmap', ?, 0, 'Unknown - verify directly', 0)
  `).run(id, facility.name, `OSM:${sourceId}`, facility.address || 'Address not listed in OpenStreetMap', facility.lat, facility.lng, facility.phone || '', facility.phone || '', sourceId);
    return id;
}
