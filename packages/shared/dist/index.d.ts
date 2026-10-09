import { z } from 'zod';
export declare const BLOOD_GROUPS: readonly ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
export type BloodGroup = (typeof BLOOD_GROUPS)[number];
export declare const BLOOD_COMPONENTS: readonly ["packed_red_blood_cells", "platelets", "plasma", "whole_blood", "cryoprecipitate"];
export type BloodComponent = (typeof BLOOD_COMPONENTS)[number];
export declare const BLOOD_COMPONENT_LABELS: Record<BloodComponent, string>;
export declare const INVENTORY_STATUSES: readonly ["available", "reserved", "quarantined", "expired"];
export type InventoryStatus = (typeof INVENTORY_STATUSES)[number];
export declare const REQUEST_URGENCIES: readonly ["routine", "urgent", "critical"];
export type RequestUrgency = (typeof REQUEST_URGENCIES)[number];
export declare const REQUEST_STATUSES: readonly ["submitted", "verified", "reserved", "donor_outreach", "in_transit", "fulfilled", "cancelled"];
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export declare const USER_ROLES: readonly ["donor", "patient", "hospital_staff", "admin"];
export type UserRole = (typeof USER_ROLES)[number];
export declare const NOTIFICATION_CHANNELS: readonly ["sms", "whatsapp"];
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];
export declare const NOTIFICATION_STATUSES: readonly ["pending", "sent", "mock_sent", "delivered", "failed"];
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];
export declare const DONOR_RESPONSE_STATUSES: readonly ["pending", "accepted", "declined", "expired"];
export type DonorResponseStatus = (typeof DONOR_RESPONSE_STATUSES)[number];
export interface UserProfile {
    id: string;
    email: string;
    role: UserRole;
    fullName: string;
    phone: string;
    createdAt: string;
    isVerified?: boolean;
}
export interface Hospital {
    id: string;
    name: string;
    licenseNumber: string;
    address: string;
    city: string;
    state: string;
    postalCode?: string;
    lat: number;
    lng: number;
    contactPhone: string;
    emergencyHotline: string;
    isVerified: boolean;
    operatingHours?: string;
    availableBeds?: number;
    createdAt: string;
}
export interface BloodInventoryItem {
    id: string;
    hospitalId: string;
    bloodGroup: BloodGroup;
    component: BloodComponent;
    unitsCount: number;
    status: InventoryStatus;
    batchNumber: string;
    storageLocation?: string;
    collectionDate: string;
    expiryDate: string;
    createdAt: string;
    updatedAt: string;
    hospitalName?: string;
}
export interface BloodInventoryMovement {
    id: string;
    inventoryId: string;
    hospitalId: string;
    action: 'added' | 'reserved' | 'released' | 'issued' | 'quarantined' | 'expired' | 'adjusted';
    quantity: number;
    previousStatus: InventoryStatus;
    newStatus: InventoryStatus;
    reason?: string;
    referenceRequestId?: string;
    performedByUserId: string;
    timestamp: string;
}
export interface DonorMatchingProfile {
    donorUuid: string;
    bloodGroup: BloodGroup;
    latApprox: number;
    lngApprox: number;
    city: string;
    isAvailable: boolean;
    isEligible: boolean;
    lastDonationDate: string | null;
    nextEligibleDate: string | null;
    donationCount: number;
    totalUnitsDonated: number;
    serviceRadiusKm: number;
}
export interface DonorPrivateProfile {
    donorUuid: string;
    userId: string;
    fullName: string;
    phoneNumber: string;
    email: string;
    addressApprox: string;
    emergencyNotificationConsent: boolean;
    optOutStatus: boolean;
    lastSmsSentAt?: string | null;
}
export interface PatientRequest {
    id: string;
    patientUserId: string;
    patientDisplayName: string;
    bloodGroup: BloodGroup;
    component: BloodComponent;
    unitsRequired: number;
    unitsReserved: number;
    urgency: RequestUrgency;
    hospitalId: string;
    status: RequestStatus;
    requiredByTime: string;
    clinicalNotes?: string;
    hospitalName?: string;
    patientContact?: string;
    treatingDoctor?: string;
    wardOrBed?: string;
    createdAt: string;
    updatedAt: string;
}
export interface DonorMatch {
    id: string;
    requestId: string;
    donorUuid: string;
    bloodGroup: BloodGroup;
    distanceKm: number;
    compatibilityScore: number;
    notificationStatus: NotificationStatus;
    notificationSid?: string;
    donorResponse: DonorResponseStatus;
    notificationSentAt?: string;
    respondedAt?: string;
    notes?: string;
}
export interface NotificationLog {
    id: string;
    recipientPhoneMasked: string;
    channel: NotificationChannel;
    messageBody: string;
    twilioSid?: string;
    status: NotificationStatus;
    errorMessage?: string;
    requestId?: string;
    donorUuid?: string;
    createdAt: string;
}
export interface AuditLog {
    id: string;
    actorUserId: string;
    actorRole: UserRole;
    action: string;
    resourceType: string;
    resourceId: string;
    metadata?: Record<string, any>;
    ipAddress?: string;
    timestamp: string;
}
export declare const RegisterSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    fullName: z.ZodString;
    phone: z.ZodString;
    role: z.ZodEnum<["donor", "patient", "hospital_staff", "admin"]>;
    bloodGroup: z.ZodOptional<z.ZodEnum<["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]>>;
    hospitalId: z.ZodOptional<z.ZodString>;
    approxCity: z.ZodOptional<z.ZodString>;
    lat: z.ZodOptional<z.ZodNumber>;
    lng: z.ZodOptional<z.ZodNumber>;
    notificationConsent: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
    fullName: string;
    phone: string;
    role: "donor" | "patient" | "hospital_staff" | "admin";
    notificationConsent: boolean;
    bloodGroup?: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-" | undefined;
    hospitalId?: string | undefined;
    approxCity?: string | undefined;
    lat?: number | undefined;
    lng?: number | undefined;
}, {
    email: string;
    password: string;
    fullName: string;
    phone: string;
    role: "donor" | "patient" | "hospital_staff" | "admin";
    bloodGroup?: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-" | undefined;
    hospitalId?: string | undefined;
    approxCity?: string | undefined;
    lat?: number | undefined;
    lng?: number | undefined;
    notificationConsent?: boolean | undefined;
}>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export declare const LoginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export type LoginInput = z.infer<typeof LoginSchema>;
export declare const CreatePatientRequestSchema: z.ZodObject<{
    patientDisplayName: z.ZodString;
    bloodGroup: z.ZodEnum<["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]>;
    component: z.ZodEnum<["packed_red_blood_cells", "platelets", "plasma", "whole_blood", "cryoprecipitate"]>;
    unitsRequired: z.ZodNumber;
    urgency: z.ZodEnum<["routine", "urgent", "critical"]>;
    hospitalId: z.ZodString;
    requiredByTime: z.ZodEffects<z.ZodString, string, string>;
    clinicalNotes: z.ZodOptional<z.ZodString>;
    treatingDoctor: z.ZodOptional<z.ZodString>;
    wardOrBed: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    bloodGroup: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";
    hospitalId: string;
    patientDisplayName: string;
    component: "packed_red_blood_cells" | "platelets" | "plasma" | "whole_blood" | "cryoprecipitate";
    unitsRequired: number;
    urgency: "routine" | "urgent" | "critical";
    requiredByTime: string;
    clinicalNotes?: string | undefined;
    treatingDoctor?: string | undefined;
    wardOrBed?: string | undefined;
}, {
    bloodGroup: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";
    hospitalId: string;
    patientDisplayName: string;
    component: "packed_red_blood_cells" | "platelets" | "plasma" | "whole_blood" | "cryoprecipitate";
    unitsRequired: number;
    urgency: "routine" | "urgent" | "critical";
    requiredByTime: string;
    clinicalNotes?: string | undefined;
    treatingDoctor?: string | undefined;
    wardOrBed?: string | undefined;
}>;
export type CreatePatientRequestInput = z.infer<typeof CreatePatientRequestSchema>;
export declare const InventoryUpdateSchema: z.ZodObject<{
    bloodGroup: z.ZodEnum<["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]>;
    component: z.ZodEnum<["packed_red_blood_cells", "platelets", "plasma", "whole_blood", "cryoprecipitate"]>;
    unitsCount: z.ZodNumber;
    status: z.ZodEnum<["available", "reserved", "quarantined", "expired"]>;
    batchNumber: z.ZodString;
    storageLocation: z.ZodOptional<z.ZodString>;
    collectionDate: z.ZodString;
    expiryDate: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "available" | "reserved" | "quarantined" | "expired";
    bloodGroup: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";
    component: "packed_red_blood_cells" | "platelets" | "plasma" | "whole_blood" | "cryoprecipitate";
    unitsCount: number;
    batchNumber: string;
    collectionDate: string;
    expiryDate: string;
    storageLocation?: string | undefined;
}, {
    status: "available" | "reserved" | "quarantined" | "expired";
    bloodGroup: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";
    component: "packed_red_blood_cells" | "platelets" | "plasma" | "whole_blood" | "cryoprecipitate";
    unitsCount: number;
    batchNumber: string;
    collectionDate: string;
    expiryDate: string;
    storageLocation?: string | undefined;
}>;
export type InventoryUpdateInput = z.infer<typeof InventoryUpdateSchema>;
export declare const InventoryAdjustmentSchema: z.ZodObject<{
    action: z.ZodEnum<["add", "reserve", "issue", "quarantine", "expire", "release"]>;
    units: z.ZodNumber;
    reason: z.ZodString;
    referenceRequestId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    action: "add" | "reserve" | "issue" | "quarantine" | "expire" | "release";
    units: number;
    reason: string;
    referenceRequestId?: string | undefined;
}, {
    action: "add" | "reserve" | "issue" | "quarantine" | "expire" | "release";
    units: number;
    reason: string;
    referenceRequestId?: string | undefined;
}>;
export type InventoryAdjustmentInput = z.infer<typeof InventoryAdjustmentSchema>;
export declare const DonorResponseSchema: z.ZodObject<{
    matchId: z.ZodString;
    response: z.ZodEnum<["accepted", "declined"]>;
    estimatedArrivalMinutes: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    matchId: string;
    response: "accepted" | "declined";
    estimatedArrivalMinutes?: number | undefined;
}, {
    matchId: string;
    response: "accepted" | "declined";
    estimatedArrivalMinutes?: number | undefined;
}>;
export type DonorResponseInput = z.infer<typeof DonorResponseSchema>;
/**
 * Masks phone number for privacy preservation while enabling auditing.
 * Example: "+1 415-555-2671" -> "+1 ***-***-2671"
 */
export declare function maskPhoneNumber(phone: string): string;
/**
 * Calculates distance between two latitude/longitude points in kilometers using Haversine formula
 */
export declare function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number;
