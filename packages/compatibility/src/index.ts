import { BloodGroup, BloodComponent, RequestUrgency } from '@bloodlink/shared';

// ==========================================
// 1. Clinical Compatibility Tables
// ==========================================

/**
 * Packed Red Blood Cells (PRBC) Compatibility
 * Maps Patient (Recipient) Blood Group -> List of Compatible Donor Blood Groups
 */
export const PRBC_COMPATIBILITY: Record<BloodGroup, BloodGroup[]> = {
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
export const PLASMA_COMPATIBILITY: Record<BloodGroup, BloodGroup[]> = {
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
export const PLATELET_COMPATIBILITY: Record<BloodGroup, BloodGroup[]> = {
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
export const WHOLE_BLOOD_COMPATIBILITY: Record<BloodGroup, BloodGroup[]> = {
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
export function isBloodCompatible(
  patientGroup: BloodGroup,
  donorGroup: BloodGroup,
  component: BloodComponent
): boolean {
  switch (component) {
    case 'packed_red_blood_cells':
      return PRBC_COMPATIBILITY[patientGroup].includes(donorGroup);
    case 'plasma':
      return PLASMA_COMPATIBILITY[patientGroup].includes(donorGroup);
    case 'platelets':
      return PLATELET_COMPATIBILITY[patientGroup].includes(donorGroup);
    case 'whole_blood':
      return WHOLE_BLOOD_COMPATIBILITY[patientGroup].includes(donorGroup);
    case 'cryoprecipitate':
      // Cryo has negligible antibodies; broadly compatible with preference for identical/AB
      return true;
    default:
      return PRBC_COMPATIBILITY[patientGroup].includes(donorGroup);
  }
}

// ==========================================
// 2. Donation Eligibility & Interval Rules
// ==========================================

export interface EligibilityRuleConfig {
  wholeBloodIntervalDays: number; // default 56 days
  packedRBCIntervalDays: number;   // default 56 days
  plateletsIntervalDays: number;   // default 7 days
  plasmaIntervalDays: number;      // default 28 days
  minAgeYears: number;             // default 18
  maxAgeYears: number;             // default 65
  minWeightKg: number;             // default 50
}

export const DEFAULT_ELIGIBILITY_CONFIG: EligibilityRuleConfig = {
  wholeBloodIntervalDays: 56,
  packedRBCIntervalDays: 56,
  plateletsIntervalDays: 7,
  plasmaIntervalDays: 28,
  minAgeYears: 18,
  maxAgeYears: 65,
  minWeightKg: 50
};

export interface DonationEligibilityResult {
  isEligible: boolean;
  reason: string;
  nextEligibleDate: string; // ISO date string
  daysRemaining: number;
}

/**
 * Evaluates whether a donor meets interval requirements since their last donation
 */
export function calculateDonationEligibility(
  lastDonationDate: string | Date | null | undefined,
  component: BloodComponent = 'whole_blood',
  config: EligibilityRuleConfig = DEFAULT_ELIGIBILITY_CONFIG,
  currentDate: Date = new Date()
): DonationEligibilityResult {
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

// ==========================================
// 3. Intelligent Match Scoring Algorithm
// ==========================================

export interface CandidateDonor {
  donorUuid: string;
  bloodGroup: BloodGroup;
  latApprox: number;
  lngApprox: number;
  isAvailable: boolean;
  isEligible: boolean;
  serviceRadiusKm: number;
  lastDonationDate: string | null;
  donationCount: number;
}

export interface MatchScoreResult {
  donorUuid: string;
  bloodGroup: BloodGroup;
  distanceKm: number;
  score: number; // 0 to 100
  isDirectMatch: boolean;
  isCompatible: boolean;
  breakdown: {
    bloodMatchScore: number; // 40 max
    distanceScore: number;   // 35 max
    experienceScore: number; // 15 max
    urgencyBonus: number;    // 10 max
  };
}

/**
 * Calculates a composite compatibility & priority score for ranking potential donors
 */
export function scoreDonorForRequest(
  donor: CandidateDonor,
  targetLat: number,
  targetLng: number,
  patientBloodGroup: BloodGroup,
  component: BloodComponent,
  urgency: RequestUrgency,
  distanceKm: number
): MatchScoreResult | null {
  // 1. Hard check: compatibility
  const compatible = isBloodCompatible(patientBloodGroup, donor.bloodGroup, component);
  if (!compatible) return null;

  // 2. Hard check: availability & eligibility
  if (!donor.isAvailable || !donor.isEligible) return null;

  // 3. Hard check: radius limit
  if (distanceKm > (donor.serviceRadiusKm || 50)) return null;

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
