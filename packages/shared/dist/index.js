"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DonorResponseSchema = exports.InventoryAdjustmentSchema = exports.InventoryUpdateSchema = exports.CreatePatientRequestSchema = exports.LoginSchema = exports.RegisterSchema = exports.DONOR_RESPONSE_STATUSES = exports.NOTIFICATION_STATUSES = exports.NOTIFICATION_CHANNELS = exports.USER_ROLES = exports.REQUEST_STATUSES = exports.REQUEST_URGENCIES = exports.INVENTORY_STATUSES = exports.BLOOD_COMPONENT_LABELS = exports.BLOOD_COMPONENTS = exports.BLOOD_GROUPS = void 0;
exports.maskPhoneNumber = maskPhoneNumber;
exports.calculateDistanceKm = calculateDistanceKm;
const zod_1 = require("zod");
// ==========================================
// 1. Core Domain Types & Enums
// ==========================================
exports.BLOOD_GROUPS = [
    'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'
];
exports.BLOOD_COMPONENTS = [
    'packed_red_blood_cells',
    'platelets',
    'plasma',
    'whole_blood',
    'cryoprecipitate'
];
exports.BLOOD_COMPONENT_LABELS = {
    packed_red_blood_cells: 'Packed Red Blood Cells (PRBC)',
    platelets: 'Platelets (PLT)',
    plasma: 'Fresh Frozen Plasma (FFP)',
    whole_blood: 'Whole Blood (WB)',
    cryoprecipitate: 'Cryoprecipitate (CRYO)'
};
exports.INVENTORY_STATUSES = [
    'available',
    'reserved',
    'quarantined',
    'expired'
];
exports.REQUEST_URGENCIES = [
    'routine',
    'urgent',
    'critical'
];
exports.REQUEST_STATUSES = [
    'submitted',
    'verified',
    'reserved',
    'donor_outreach',
    'in_transit',
    'fulfilled',
    'cancelled'
];
exports.USER_ROLES = [
    'donor',
    'patient',
    'hospital_staff',
    'admin'
];
exports.NOTIFICATION_CHANNELS = ['sms', 'whatsapp'];
exports.NOTIFICATION_STATUSES = ['pending', 'sent', 'mock_sent', 'delivered', 'failed'];
exports.DONOR_RESPONSE_STATUSES = ['pending', 'accepted', 'declined', 'expired'];
// ==========================================
// 3. Validation Schemas (Zod)
// ==========================================
exports.RegisterSchema = zod_1.z.object({
    email: zod_1.z.string().email('Valid email address required'),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters'),
    fullName: zod_1.z.string().min(2, 'Full name required'),
    phone: zod_1.z.string().min(10, 'Valid phone number required'),
    role: zod_1.z.enum(exports.USER_ROLES),
    bloodGroup: zod_1.z.enum(exports.BLOOD_GROUPS).optional(),
    hospitalId: zod_1.z.string().optional(),
    approxCity: zod_1.z.string().optional(),
    lat: zod_1.z.number().optional(),
    lng: zod_1.z.number().optional(),
    notificationConsent: zod_1.z.boolean().default(true)
});
exports.LoginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Valid email address required'),
    password: zod_1.z.string().min(1, 'Password is required')
});
exports.CreatePatientRequestSchema = zod_1.z.object({
    patientDisplayName: zod_1.z.string().min(2, 'Patient name or anonymized code required'),
    bloodGroup: zod_1.z.enum(exports.BLOOD_GROUPS),
    component: zod_1.z.enum(exports.BLOOD_COMPONENTS),
    unitsRequired: zod_1.z.number().int().min(1, 'At least 1 unit required').max(20, 'Maximum 20 units per single emergency request'),
    urgency: zod_1.z.enum(exports.REQUEST_URGENCIES),
    hospitalId: zod_1.z.string().min(1).optional(),
    externalHospitalId: zod_1.z.string().min(1).optional(),
    requiredByTime: zod_1.z.string().refine((val) => !isNaN(Date.parse(val)), {
        message: 'Valid required-by ISO timestamp required'
    }),
    clinicalNotes: zod_1.z.string().max(500).optional(),
    treatingDoctor: zod_1.z.string().optional(),
    wardOrBed: zod_1.z.string().optional(),
    requesterLat: zod_1.z.number().min(-90).max(90).optional(),
    requesterLng: zod_1.z.number().min(-180).max(180).optional(),
    requesterLocationSource: zod_1.z.enum(['device', 'manual']).optional()
}).superRefine((data, context) => {
    if (Boolean(data.hospitalId) === Boolean(data.externalHospitalId)) {
        context.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'Select one registered or live nearby receiving hospital',
            path: ['hospitalId']
        });
    }
    if ((data.requesterLat === undefined) !== (data.requesterLng === undefined)) {
        context.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'Both requester latitude and longitude must be provided together',
            path: ['requesterLat']
        });
    }
    if (data.externalHospitalId && (data.requesterLat === undefined || data.requesterLng === undefined)) {
        context.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'Location is required to verify a live nearby receiving hospital',
            path: ['requesterLat']
        });
    }
});
exports.InventoryUpdateSchema = zod_1.z.object({
    bloodGroup: zod_1.z.enum(exports.BLOOD_GROUPS),
    component: zod_1.z.enum(exports.BLOOD_COMPONENTS),
    unitsCount: zod_1.z.number().int().min(0, 'Units count cannot be negative'),
    status: zod_1.z.enum(exports.INVENTORY_STATUSES),
    batchNumber: zod_1.z.string().min(1, 'Batch number required'),
    storageLocation: zod_1.z.string().optional(),
    collectionDate: zod_1.z.string(),
    expiryDate: zod_1.z.string()
});
exports.InventoryAdjustmentSchema = zod_1.z.object({
    action: zod_1.z.enum(['add', 'reserve', 'issue', 'quarantine', 'expire', 'release']),
    units: zod_1.z.number().int().min(1, 'At least 1 unit must be modified'),
    reason: zod_1.z.string().min(3, 'Audit reason required for inventory status modification'),
    referenceRequestId: zod_1.z.string().optional()
});
exports.DonorResponseSchema = zod_1.z.object({
    matchId: zod_1.z.string().uuid(),
    response: zod_1.z.enum(['accepted', 'declined']),
    estimatedArrivalMinutes: zod_1.z.number().min(5).max(360).optional()
});
// ==========================================
// 4. Utility Functions
// ==========================================
/**
 * Masks phone number for privacy preservation while enabling auditing.
 * Example: "+1 415-555-2671" -> "+1 ***-***-2671"
 */
function maskPhoneNumber(phone) {
    if (!phone || phone.length < 4)
        return '***';
    const clean = phone.trim();
    const visibleLast = clean.slice(-4);
    const countryCode = clean.startsWith('+') ? clean.slice(0, clean.indexOf(' ') > 0 ? clean.indexOf(' ') : 2) : '';
    return `${countryCode} ***-***-${visibleLast}`;
}
/**
 * Calculates distance between two latitude/longitude points in kilometers using Haversine formula
 */
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in kilometers
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
}
