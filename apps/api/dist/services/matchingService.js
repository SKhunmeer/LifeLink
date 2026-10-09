"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findCompatibleHospitalInventory = findCompatibleHospitalInventory;
exports.triggerDonorMatchingWorkflow = triggerDonorMatchingWorkflow;
exports.handleDonorResponse = handleDonorResponse;
const db_js_1 = require("../db.js");
const uuid_1 = require("uuid");
const shared_1 = require("@bloodlink/shared");
const compatibility_1 = require("@bloodlink/compatibility");
const notificationService_js_1 = require("./notificationService.js");
const realtimeService_js_1 = require("./realtimeService.js");
const auditService_js_1 = require("./auditService.js");
/**
 * Discovers and ranks registered hospitals & blood banks with compatible inventory
 */
function findCompatibleHospitalInventory(patientBloodGroup, component, targetLat, targetLng) {
    const hospitals = db_js_1.db.prepare('SELECT * FROM hospitals WHERE is_verified = 1').all();
    const results = [];
    for (const h of hospitals) {
        const distanceKm = (0, shared_1.calculateDistanceKm)(targetLat, targetLng, h.lat, h.lng);
        // Fetch available inventory items for this hospital
        const items = db_js_1.db.prepare(`
      SELECT blood_group, units_count, expiry_date
      FROM blood_inventory
      WHERE hospital_id = ? AND component = ? AND status = 'available'
        AND date(expiry_date) >= date('now') AND units_count > 0
    `).all(h.id, component);
        const compatibleBatches = [];
        let compatibleUnits = 0;
        for (const item of items) {
            if ((0, compatibility_1.isBloodCompatible)(patientBloodGroup, item.blood_group, component)) {
                compatibleBatches.push({
                    bloodGroup: item.blood_group,
                    units: item.units_count,
                    expiryDate: item.expiry_date
                });
                compatibleUnits += item.units_count;
            }
        }
        results.push({
            hospitalId: h.id,
            hospitalName: h.name,
            address: h.address,
            lat: h.lat,
            lng: h.lng,
            distanceKm,
            contactPhone: h.contact_phone,
            emergencyHotline: h.emergency_hotline,
            availableCompatibleUnits: compatibleUnits,
            compatibleBatches
        });
    }
    // Rank by: (1) has inventory, (2) highest units, (3) shortest distance
    return results.sort((a, b) => {
        if (a.availableCompatibleUnits > 0 && b.availableCompatibleUnits === 0)
            return -1;
        if (a.availableCompatibleUnits === 0 && b.availableCompatibleUnits > 0)
            return 1;
        if (a.availableCompatibleUnits !== b.availableCompatibleUnits) {
            return b.availableCompatibleUnits - a.availableCompatibleUnits;
        }
        return a.distanceKm - b.distanceKm;
    });
}
/**
 * Matches eligible voluntary donors and dispatches consent-based emergency alerts
 */
async function triggerDonorMatchingWorkflow(params) {
    const { requestId, performedByUserId } = params;
    // 1. Fetch patient request and receiving hospital
    const request = db_js_1.db.prepare(`
    SELECT r.*, h.name as hospital_name, h.lat as hospital_lat, h.lng as hospital_lng
    FROM patient_requests r
    JOIN hospitals h ON h.id = r.hospital_id
    WHERE r.id = ?
  `).get(requestId);
    if (!request) {
        throw new Error('Patient request not found');
    }
    const patientBloodGroup = request.blood_group;
    const component = request.component;
    const urgency = request.urgency;
    const hospitalLat = request.hospital_lat;
    const hospitalLng = request.hospital_lng;
    // 2. Query pseudonymous donor matching profiles
    const candidateRows = db_js_1.db.prepare(`
    SELECT donor_uuid as donorUuid, blood_group as bloodGroup, lat_approx as latApprox,
           lng_approx as lngApprox, is_available as isAvailable, is_eligible as isEligible,
           service_radius_km as serviceRadiusKm, last_donation_date as lastDonationDate,
           donation_count as donationCount
    FROM donor_matching_profiles
    WHERE is_available = 1 AND is_eligible = 1
  `).all();
    const scoredMatches = [];
    for (const c of candidateRows) {
        const dist = (0, shared_1.calculateDistanceKm)(hospitalLat, hospitalLng, c.latApprox, c.lngApprox);
        // Dynamic 56-day safety interval verification
        const intervalCheck = (0, compatibility_1.calculateDonationEligibility)(c.lastDonationDate, component);
        if (!intervalCheck.isEligible) {
            continue;
        }
        const scoreResult = (0, compatibility_1.scoreDonorForRequest)(c, hospitalLat, hospitalLng, patientBloodGroup, component, urgency, dist);
        if (scoreResult) {
            scoredMatches.push({
                donorUuid: c.donorUuid,
                bloodGroup: c.bloodGroup,
                distanceKm: dist,
                score: scoreResult.score
            });
        }
    }
    // Sort by highest score first, limit outreach to top candidates (e.g. 5)
    scoredMatches.sort((a, b) => b.score - a.score);
    const selectedDonors = scoredMatches.slice(0, 5);
    const createdMatches = [];
    for (const match of selectedDonors) {
        // Check if match already recorded
        let matchRecord = db_js_1.db.prepare(`
      SELECT * FROM donor_matches WHERE request_id = ? AND donor_uuid = ?
    `).get(requestId, match.donorUuid);
        const matchId = matchRecord ? matchRecord.id : (0, uuid_1.v4)();
        if (!matchRecord) {
            db_js_1.db.prepare(`
        INSERT INTO donor_matches (id, request_id, donor_uuid, distance_km, compatibility_score, notification_status, donor_response)
        VALUES (?, ?, ?, ?, ?, 'pending', 'pending')
      `).run(matchId, requestId, match.donorUuid, match.distanceKm, match.score);
        }
        // Resolve contact details strictly inside this authorized server-side service
        const privateProfile = db_js_1.db.prepare(`
      SELECT phone_number, emergency_notification_consent, opt_out_status
      FROM donor_private_profiles
      WHERE donor_uuid = ?
    `).get(match.donorUuid);
        if (privateProfile && privateProfile.emergency_notification_consent && !privateProfile.opt_out_status) {
            const messageBody = (0, notificationService_js_1.formatDonorAlertMessage)(request.hospital_name, patientBloodGroup, requestId);
            const smsResult = await (0, notificationService_js_1.sendEmergencyNotification)({
                recipientPhone: privateProfile.phone_number,
                messageBody,
                requestId,
                donorUuid: match.donorUuid,
                allowDuplicate: false
            });
            db_js_1.db.prepare(`
        UPDATE donor_matches
        SET notification_status = ?, notification_sid = ?, notification_sent_at = datetime('now')
        WHERE id = ?
      `).run(smsResult.status, smsResult.sid, matchId);
            createdMatches.push({
                matchId,
                donorUuid: match.donorUuid,
                bloodGroup: match.bloodGroup,
                distanceKm: match.distanceKm,
                score: match.score,
                notificationStatus: smsResult.status,
                smsSid: smsResult.sid
            });
        }
    }
    // Update request status to donor_outreach
    db_js_1.db.prepare(`
    UPDATE patient_requests
    SET status = 'donor_outreach', updated_at = datetime('now')
    WHERE id = ?
  `).run(requestId);
    (0, realtimeService_js_1.broadcastRealtimeEvent)('REQUEST_STATUS_UPDATED', {
        requestId,
        newStatus: 'donor_outreach',
        matchedDonorsCount: createdMatches.length
    });
    (0, auditService_js_1.logAuditEvent)({
        actorUserId: performedByUserId,
        actorRole: 'hospital_staff',
        action: 'DONOR_OUTREACH_TRIGGERED',
        resourceType: 'patient_requests',
        resourceId: requestId,
        metadata: {
            matchedCandidates: createdMatches.length,
            patientBloodGroup,
            component
        }
    });
    return {
        requestId,
        candidatesAlerted: createdMatches.length,
        matches: createdMatches
    };
}
/**
 * Handle donor response to emergency notification (accept/decline)
 */
function handleDonorResponse(matchId, response, notes) {
    const match = db_js_1.db.prepare('SELECT * FROM donor_matches WHERE id = ?').get(matchId);
    if (!match) {
        throw new Error('Donor match record not found');
    }
    db_js_1.db.prepare(`
    UPDATE donor_matches
    SET donor_response = ?, responded_at = datetime('now'), notes = ?
    WHERE id = ?
  `).run(response, notes || null, matchId);
    // Notify hospital dashboard in real-time!
    (0, realtimeService_js_1.broadcastRealtimeEvent)('DONOR_RESPONSE_RECEIVED', {
        matchId,
        requestId: match.request_id,
        donorUuid: match.donor_uuid,
        response,
        notes,
        timestamp: new Date().toISOString()
    });
    (0, auditService_js_1.logAuditEvent)({
        actorRole: 'donor',
        action: `DONOR_${response.toUpperCase()}`,
        resourceType: 'donor_matches',
        resourceId: matchId,
        metadata: { requestId: match.request_id, donorUuid: match.donor_uuid }
    });
    return { success: true, matchId, response };
}
