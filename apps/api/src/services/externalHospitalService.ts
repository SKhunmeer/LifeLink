import { v4 as uuidv4 } from 'uuid';
import { db } from '../db.js';
import type { NearbyHospital } from './nearbyHospitalService.js';

export function findOrCreateExternalHospital(facility: NearbyHospital): string {
  const sourceId = facility.id.replace(/^nominatim\//, '');
  const existing = db.prepare('SELECT id FROM hospitals WHERE source_id = ?').get(sourceId) as { id: string } | undefined;
  if (existing) {
    db.prepare(`
      UPDATE hospitals
      SET name = ?, address = ?, lat = ?, lng = ?, contact_phone = ?, emergency_hotline = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      facility.name,
      facility.address || 'Address not listed in OpenStreetMap',
      facility.lat,
      facility.lng,
      facility.phone || '',
      facility.phone || '',
      existing.id
    );
    return existing.id;
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO hospitals (
      id, name, license_number, address, city, state, postal_code, lat, lng,
      contact_phone, emergency_hotline, source, source_id, is_verified, operating_hours, available_beds
    ) VALUES (?, ?, ?, ?, 'Unknown', 'Unknown', NULL, ?, ?, ?, ?, 'openstreetmap', ?, 0, 'Unknown - verify directly', 0)
  `).run(
    id,
    facility.name,
    `OSM:${sourceId}`,
    facility.address || 'Address not listed in OpenStreetMap',
    facility.lat,
    facility.lng,
    facility.phone || '',
    facility.phone || '',
    sourceId
  );
  return id;
}
