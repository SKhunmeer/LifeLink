import { z } from 'zod';

// ==========================================
// 1. Core Domain Types & Enums
// ==========================================

export const BLOOD_GROUPS = [
  'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'
] as const;

export type BloodGroup = (typeof BLOOD_GROUPS)[number];

export const BLOOD_COMPONENTS = [
  'packed_red_blood_cells',
  'platelets',
  'plasma',
  'whole_blood',
  'cryoprecipitate'
] as const;

export type BloodComponent = (typeof BLOOD_COMPONENTS)[number];

export const BLOOD_COMPONENT_LABELS: Record<BloodComponent, string> = {
  packed_red_blood_cells: 'Packed Red Blood Cells (PRBC)',
  platelets: 'Platelets (PLT)',
  plasma: 'Fresh Frozen Plasma (FFP)',
  whole_blood: 'Whole Blood (WB)',
  cryoprecipitate: 'Cryoprecipitate (CRYO)'
};

export const INVENTORY_STATUSES = [
  'available',
  'reserved',
  'quarantined',
  'expired'
] as const;

export type InventoryStatus = (typeof INVENTORY_STATUSES)[number];

export const REQUEST_URGENCIES = [
  'routine',
  'urgent',
  'critical'
] as const;

export type RequestUrgency = (typeof REQUEST_URGENCIES)[number];

export const REQUEST_STATUSES = [
  'submitted',
  'verified',
  'reserved',
  'donor_outreach',
  'in_transit',
  'fulfilled',
  'cancelled'
] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const USER_ROLES = [
  'donor',
  'patient',
  'hospital_staff',
  'admin'
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const NOTIFICATION_CHANNELS = ['sms', 'whatsapp'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_STATUSES = ['pending', 'sent', 'mock_sent', 'delivered', 'failed'] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const DONOR_RESPONSE_STATUSES = ['pending', 'accepted', 'declined', 'expired'] as const;
export type DonorResponseStatus = (typeof DONOR_RESPONSE_STATUSES)[number];

// ==========================================
// 2. Data Models & Interfaces
// ==========================================

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

// ==========================================
// 3. Validation Schemas (Zod)
// ==========================================

export const RegisterSchema = z.object({
  email: z.string().email('Valid email address required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(2, 'Full name required'),
  phone: z.string().min(10, 'Valid phone number required'),
  role: z.enum(USER_ROLES),
  bloodGroup: z.enum(BLOOD_GROUPS).optional(),
  hospitalId: z.string().optional(),
  approxCity: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  notificationConsent: z.boolean().default(true)
});

export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().email('Valid email address required'),
  password: z.string().min(1, 'Password is required')
});

export type LoginInput = z.infer<typeof LoginSchema>;

export const CreatePatientRequestSchema = z.object({
  patientDisplayName: z.string().min(2, 'Patient name or anonymized code required'),
  bloodGroup: z.enum(BLOOD_GROUPS),
  component: z.enum(BLOOD_COMPONENTS),
  unitsRequired: z.number().int().min(1, 'At least 1 unit required').max(20, 'Maximum 20 units per single emergency request'),
  urgency: z.enum(REQUEST_URGENCIES),
  hospitalId: z.string().min(1).optional(),
  externalHospitalId: z.string().min(1).optional(),
  requiredByTime: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Valid required-by ISO timestamp required'
  }),
  clinicalNotes: z.string().max(500).optional(),
  treatingDoctor: z.string().optional(),
  wardOrBed: z.string().optional(),
  requesterLat: z.number().min(-90).max(90).optional(),
  requesterLng: z.number().min(-180).max(180).optional(),
  requesterLocationSource: z.enum(['device', 'manual']).optional()
}).superRefine((data, context) => {
  if (Boolean(data.hospitalId) === Boolean(data.externalHospitalId)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Select one registered or live nearby receiving hospital',
      path: ['hospitalId']
    });
  }
  if ((data.requesterLat === undefined) !== (data.requesterLng === undefined)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Both requester latitude and longitude must be provided together',
      path: ['requesterLat']
    });
  }
  if (data.externalHospitalId && (data.requesterLat === undefined || data.requesterLng === undefined)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Location is required to verify a live nearby receiving hospital',
      path: ['requesterLat']
    });
  }
});

export type CreatePatientRequestInput = z.infer<typeof CreatePatientRequestSchema>;

export const InventoryUpdateSchema = z.object({
  bloodGroup: z.enum(BLOOD_GROUPS),
  component: z.enum(BLOOD_COMPONENTS),
  unitsCount: z.number().int().min(0, 'Units count cannot be negative'),
  status: z.enum(INVENTORY_STATUSES),
  batchNumber: z.string().min(1, 'Batch number required'),
  storageLocation: z.string().optional(),
  collectionDate: z.string(),
  expiryDate: z.string()
});

export type InventoryUpdateInput = z.infer<typeof InventoryUpdateSchema>;

export const InventoryAdjustmentSchema = z.object({
  action: z.enum(['add', 'reserve', 'issue', 'quarantine', 'expire', 'release']),
  units: z.number().int().min(1, 'At least 1 unit must be modified'),
  reason: z.string().min(3, 'Audit reason required for inventory status modification'),
  referenceRequestId: z.string().optional()
});

export type InventoryAdjustmentInput = z.infer<typeof InventoryAdjustmentSchema>;

export const DonorResponseSchema = z.object({
  matchId: z.string().uuid(),
  response: z.enum(['accepted', 'declined']),
  estimatedArrivalMinutes: z.number().min(5).max(360).optional()
});

export type DonorResponseInput = z.infer<typeof DonorResponseSchema>;

// ==========================================
// 4. Utility Functions
// ==========================================

/**
 * Masks phone number for privacy preservation while enabling auditing.
 * Example: "+1 415-555-2671" -> "+1 ***-***-2671"
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone || phone.length < 4) return '***';
  const clean = phone.trim();
  const visibleLast = clean.slice(-4);
  const countryCode = clean.startsWith('+') ? clean.slice(0, clean.indexOf(' ') > 0 ? clean.indexOf(' ') : 2) : '';
  return `${countryCode} ***-***-${visibleLast}`;
}

/**
 * Calculates distance between two latitude/longitude points in kilometers using Haversine formula
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}
