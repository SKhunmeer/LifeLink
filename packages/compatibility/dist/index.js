"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_ELIGIBILITY_CONFIG = exports.WHOLE_BLOOD_COMPATIBILITY = exports.PLATELET_COMPATIBILITY = exports.PLASMA_COMPATIBILITY = exports.PRBC_COMPATIBILITY = void 0;
exports.isBloodCompatible = isBloodCompatible;
exports.calculateDonationEligibility = calculateDonationEligibility;
exports.scoreDonorForRequest = scoreDonorForRequest;
// ==========================================
// 1. Clinical Compatibility Tables
// ==========================================
/**
 * Packed Red Blood Cells (PRBC) Compatibility
 * Maps Patient (Recipient) Blood Group -> List of Compatible Donor Blood Groups
 */
exports.PRBC_COMPATIBILITY = {
    'O-': ['O-'],
    'O+': ['O+', 'O-'],
    'A-': ['A-', 'O-'],
    'A+': ['A+', 'A-', 'O+', 'O-'],
    'B-': ['B-', 'O-'],
    'B+': ['B+', 'B-', 'O+', 'O-'],
    'AB-': ['AB-', 'A-', 'B-', 'O-'],
    'AB+': ['AB+', 'AB-', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-'] // Universal recipient
};
/**
 * Fresh Frozen Plasma (FFP) Compatibility
 * Antibodies in plasma dictate compatibility (AB is universal donor; O can receive all)
 */
exports.PLASMA_COMPATIBILITY = {
    'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
    'O+': ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'],
    'A-': ['A-', 'A+', 'AB-', 'AB+'],
    'A+': ['A+', 'A-', 'AB+', 'AB-'],
    'B-': ['B-', 'B+', 'AB-', 'AB+'],
    'B+': ['B+', 'B-', 'AB+', 'AB-'],
    'AB-': ['AB-', 'AB+'],
    'AB+': ['AB+', 'AB-'] // AB is universal plasma donor; AB recipient needs AB plasma
};
/**
 * Platelet (PLT) Compatibility Matrix
 * Identical group is preferred; acceptable cross-matches permitted during emergency shortage
 */
exports.PLATELET_COMPATIBILITY = {
    'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
    'O+': ['O+', 'O-', 'A+', 'B+', 'AB+'],
    'A-': ['A-', 'A+', 'AB-', 'AB+', 'O-'],
    'A+': ['A+', 'A-', 'AB+', 'O+'],
    'B-': ['B-', 'B+', 'AB-', 'AB+', 'O-'],
    'B+': ['B+', 'B-', 'AB+', 'O+'],
    'AB-': ['AB-', 'AB+', 'A-', 'B-'],
    'AB+': ['AB+', 'AB-', 'A+', 'B+', 'O+']
};
/**
 * Whole Blood Compatibility Matrix
 * Identical typing required for routine; O- / O+ accepted in life-threatening trauma resuscitation
 */
exports.WHOLE_BLOOD_COMPATIBILITY = {
    'O-': ['O-'],
    'O+': ['O+', 'O-'],
    'A-': ['A-', 'O-'],
    'A+': ['A+', 'A-', 'O+'],
    'B-': ['B-', 'O-'],
    'B+': ['B+', 'B-', 'O+'],
    'AB-': ['AB-', 'A-', 'B-', 'O-'],
    'AB+': ['AB+', 'AB-', 'A+', 'B+', 'O+']
};
/**
 * Checks if a donor blood group is compatible for a recipient given a specific component
 */
function isBloodCompatible(patientGroup, donorGroup, component) {
    switch (component) {
        case 'packed_red_blood_cells':
            return exports.PRBC_COMPATIBILITY[patientGroup].includes(donorGroup);
        case 'plasma':
            return exports.PLASMA_COMPATIBILITY[patientGroup].includes(donorGroup);
        case 'platelets':
            return exports.PLATELET_COMPATIBILITY[patientGroup].includes(donorGroup);
        case 'whole_blood':
            return exports.WHOLE_BLOOD_COMPATIBILITY[patientGroup].includes(donorGroup);
        case 'cryoprecipitate':
            // Cryo has negligible antibodies; broadly compatible with preference for identical/AB
            return true;
        default:
            return exports.PRBC_COMPATIBILITY[patientGroup].includes(donorGroup);
    }
}
exports.DEFAULT_ELIGIBILITY_CONFIG = {
    wholeBloodIntervalDays: 56,
    packedRBCIntervalDays: 56,
    plateletsIntervalDays: 7,
    plasmaIntervalDays: 28,
    minAgeYears: 18,
    maxAgeYears: 65,
    minWeightKg: 50
};
/**
 * Evaluates whether a donor meets interval requirements since their last donation
 */
function calculateDonationEligibility(lastDonationDate, component = 'whole_blood', config = exports.DEFAULT_ELIGIBILITY_CONFIG, currentDate = new Date()) {
    if (!lastDonationDate) {
        return {
            isEligible: true,
            reason: 'No previous donation on record; donor is immediately eligible for clinical screening.',
            nextEligibleDate: currentDate.toISOString().split('T')[0],
            daysRemaining: 0
        };
    }
    const lastDate = typeof lastDonationDate === 'string' ? new Date(lastDonationDate) : lastDonationDate;
    if (isNaN(lastDate.getTime())) {
        return {
            isEligible: false,
            reason: 'Invalid last donation timestamp on file.',
            nextEligibleDate: currentDate.toISOString().split('T')[0],
            daysRemaining: 0
        };
    }
    let requiredIntervalDays = config.wholeBloodIntervalDays;
    switch (component) {
        case 'platelets':
            requiredIntervalDays = config.plateletsIntervalDays;
            break;
        case 'plasma':
            requiredIntervalDays = config.plasmaIntervalDays;
            break;
        case 'packed_red_blood_cells':
            requiredIntervalDays = config.packedRBCIntervalDays;
            break;
        case 'whole_blood':
        default:
            requiredIntervalDays = config.wholeBloodIntervalDays;
            break;
    }
    const diffMs = currentDate.getTime() - lastDate.getTime();
    const elapsedDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const eligibleTimestamp = new Date(lastDate.getTime() + requiredIntervalDays * 24 * 60 * 60 * 1000);
    const nextEligibleDateStr = eligibleTimestamp.toISOString().split('T')[0];
    if (elapsedDays >= requiredIntervalDays) {
        return {
            isEligible: true,
            reason: `Mandatory ${requiredIntervalDays}-day safety recovery interval has elapsed (${elapsedDays} days passed).`,
            nextEligibleDate: nextEligibleDateStr,
            daysRemaining: 0
        };
    }
    const daysRemaining = requiredIntervalDays - elapsedDays;
    return {
        isEligible: false,
        reason: `Safety interval requirement: ${daysRemaining} days remaining before donor can safely donate ${component.replace(/_/g, ' ')}. Next eligible date: ${nextEligibleDateStr}.`,
        nextEligibleDate: nextEligibleDateStr,
        daysRemaining
    };
}
/**
 * Calculates a composite compatibility & priority score for ranking potential donors
 */
function scoreDonorForRequest(donor, targetLat, targetLng, patientBloodGroup, component, urgency, distanceKm) {
    // 1. Hard check: compatibility
    const compatible = isBloodCompatible(patientBloodGroup, donor.bloodGroup, component);
    if (!compatible)
        return null;
    // 2. Hard check: availability & eligibility
    if (!donor.isAvailable || !donor.isEligible)
        return null;
    // 3. Hard check: radius limit
    if (distanceKm > (donor.serviceRadiusKm || 50))
        return null;
    // Scoring breakdown:
    // Blood match: exact type gets 40, compatible type gets 30
    const isDirect = donor.bloodGroup === patientBloodGroup;
    const bloodMatchScore = isDirect ? 40 : 30;
    // Distance score (max 35): closer is higher
    // 0 km -> 35 pts, 50 km -> ~5 pts
    const distanceScore = Math.max(5, Math.round(35 * (1 - Math.min(distanceKm, 50) / 50)));
    // Experience / Track Record score (max 15): verified past donations indicate reliability
    const experienceScore = Math.min(15, (donor.donationCount || 0) * 3);
    // Urgency bonus (max 10)
    const urgencyBonus = urgency === 'critical' ? 10 : urgency === 'urgent' ? 6 : 2;
    const totalScore = Math.min(100, bloodMatchScore + distanceScore + experienceScore + urgencyBonus);
    return {
        donorUuid: donor.donorUuid,
        bloodGroup: donor.bloodGroup,
        distanceKm,
        score: totalScore,
        isDirectMatch: isDirect,
        isCompatible: true,
        breakdown: {
            bloodMatchScore,
            distanceScore,
            experienceScore,
            urgencyBonus
        }
    };
}
