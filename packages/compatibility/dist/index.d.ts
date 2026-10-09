import { BloodGroup, BloodComponent, RequestUrgency } from '@bloodlink/shared';
/**
 * Packed Red Blood Cells (PRBC) Compatibility
 * Maps Patient (Recipient) Blood Group -> List of Compatible Donor Blood Groups
 */
export declare const PRBC_COMPATIBILITY: Record<BloodGroup, BloodGroup[]>;
/**
 * Fresh Frozen Plasma (FFP) Compatibility
 * Antibodies in plasma dictate compatibility (AB is universal donor; O can receive all)
 */
export declare const PLASMA_COMPATIBILITY: Record<BloodGroup, BloodGroup[]>;
/**
 * Platelet (PLT) Compatibility Matrix
 * Identical group is preferred; acceptable cross-matches permitted during emergency shortage
 */
export declare const PLATELET_COMPATIBILITY: Record<BloodGroup, BloodGroup[]>;
/**
 * Whole Blood Compatibility Matrix
 * Identical typing required for routine; O- / O+ accepted in life-threatening trauma resuscitation
 */
export declare const WHOLE_BLOOD_COMPATIBILITY: Record<BloodGroup, BloodGroup[]>;
/**
 * Checks if a donor blood group is compatible for a recipient given a specific component
 */
export declare function isBloodCompatible(patientGroup: BloodGroup, donorGroup: BloodGroup, component: BloodComponent): boolean;
export interface EligibilityRuleConfig {
    wholeBloodIntervalDays: number;
    packedRBCIntervalDays: number;
    plateletsIntervalDays: number;
    plasmaIntervalDays: number;
    minAgeYears: number;
    maxAgeYears: number;
    minWeightKg: number;
}
export declare const DEFAULT_ELIGIBILITY_CONFIG: EligibilityRuleConfig;
export interface DonationEligibilityResult {
    isEligible: boolean;
    reason: string;
    nextEligibleDate: string;
    daysRemaining: number;
}
/**
 * Evaluates whether a donor meets interval requirements since their last donation
 */
export declare function calculateDonationEligibility(lastDonationDate: string | Date | null | undefined, component?: BloodComponent, config?: EligibilityRuleConfig, currentDate?: Date): DonationEligibilityResult;
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
    score: number;
    isDirectMatch: boolean;
    isCompatible: boolean;
    breakdown: {
        bloodMatchScore: number;
        distanceScore: number;
        experienceScore: number;
        urgencyBonus: number;
    };
}
/**
 * Calculates a composite compatibility & priority score for ranking potential donors
 */
export declare function scoreDonorForRequest(donor: CandidateDonor, targetLat: number, targetLng: number, patientBloodGroup: BloodGroup, component: BloodComponent, urgency: RequestUrgency, distanceKm: number): MatchScoreResult | null;
