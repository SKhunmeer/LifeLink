import { BloodGroup, BloodComponent } from '@bloodlink/shared';
export interface HospitalFacilityMatch {
    hospitalId: string;
    hospitalName: string;
    address: string;
    lat: number;
    lng: number;
    distanceKm: number;
    contactPhone: string;
    emergencyHotline: string;
    availableCompatibleUnits: number;
    compatibleBatches: {
        bloodGroup: BloodGroup;
        units: number;
        expiryDate: string;
    }[];
}
/**
 * Discovers and ranks registered hospitals & blood banks with compatible inventory
 */
export declare function findCompatibleHospitalInventory(patientBloodGroup: BloodGroup, component: BloodComponent, targetLat: number, targetLng: number): HospitalFacilityMatch[];
/**
 * Matches eligible voluntary donors and dispatches consent-based emergency alerts
 */
export declare function triggerDonorMatchingWorkflow(params: {
    requestId: string;
    performedByUserId: string;
}): Promise<{
    requestId: string;
    candidatesAlerted: number;
    matches: any[];
}>;
/**
 * Handle donor response to emergency notification (accept/decline)
 */
export declare function handleDonorResponse(matchId: string, response: 'accepted' | 'declined', notes?: string): {
    success: boolean;
    matchId: string;
    response: "accepted" | "declined";
};
