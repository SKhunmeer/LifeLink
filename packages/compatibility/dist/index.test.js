"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const index_js_1 = require("./index.js");
(0, vitest_1.describe)('Red Blood Cell (PRBC) Compatibility', () => {
    (0, vitest_1.it)('correctly identifies O- recipient as strictly compatible with only O- RBCs', () => {
        (0, vitest_1.expect)((0, index_js_1.isBloodCompatible)('O-', 'O-', 'packed_red_blood_cells')).toBe(true);
        (0, vitest_1.expect)((0, index_js_1.isBloodCompatible)('O-', 'O+', 'packed_red_blood_cells')).toBe(false);
        (0, vitest_1.expect)((0, index_js_1.isBloodCompatible)('O-', 'A-', 'packed_red_blood_cells')).toBe(false);
        (0, vitest_1.expect)((0, index_js_1.isBloodCompatible)('O-', 'AB+', 'packed_red_blood_cells')).toBe(false);
    });
    (0, vitest_1.it)('correctly identifies AB+ recipient as universal recipient for PRBCs', () => {
        const allGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
        allGroups.forEach((donor) => {
            (0, vitest_1.expect)((0, index_js_1.isBloodCompatible)('AB+', donor, 'packed_red_blood_cells')).toBe(true);
        });
    });
    (0, vitest_1.it)('correctly handles A+ recipient compatible with A+, A-, O+, O-', () => {
        (0, vitest_1.expect)((0, index_js_1.isBloodCompatible)('A+', 'A+', 'packed_red_blood_cells')).toBe(true);
        (0, vitest_1.expect)((0, index_js_1.isBloodCompatible)('A+', 'A-', 'packed_red_blood_cells')).toBe(true);
        (0, vitest_1.expect)((0, index_js_1.isBloodCompatible)('A+', 'O+', 'packed_red_blood_cells')).toBe(true);
        (0, vitest_1.expect)((0, index_js_1.isBloodCompatible)('A+', 'O-', 'packed_red_blood_cells')).toBe(true);
        (0, vitest_1.expect)((0, index_js_1.isBloodCompatible)('A+', 'B+', 'packed_red_blood_cells')).toBe(false);
        (0, vitest_1.expect)((0, index_js_1.isBloodCompatible)('A+', 'AB+', 'packed_red_blood_cells')).toBe(false);
    });
});
(0, vitest_1.describe)('Fresh Frozen Plasma (FFP) Compatibility', () => {
    (0, vitest_1.it)('validates that AB is the universal plasma donor (not O-!)', () => {
        // AB plasma can be given to anyone because it lacks anti-A and anti-B antibodies
        const allGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
        allGroups.forEach((recipient) => {
            (0, vitest_1.expect)((0, index_js_1.isBloodCompatible)(recipient, 'AB+', 'plasma')).toBe(true);
            (0, vitest_1.expect)((0, index_js_1.isBloodCompatible)(recipient, 'AB-', 'plasma')).toBe(true);
        });
    });
    (0, vitest_1.it)('prohibits O plasma from being given to AB recipients', () => {
        // AB recipient has A and B antigens; O plasma has anti-A and anti-B antibodies!
        (0, vitest_1.expect)((0, index_js_1.isBloodCompatible)('AB+', 'O-', 'plasma')).toBe(false);
        (0, vitest_1.expect)((0, index_js_1.isBloodCompatible)('AB+', 'O+', 'plasma')).toBe(false);
        (0, vitest_1.expect)((0, index_js_1.isBloodCompatible)('AB-', 'O-', 'plasma')).toBe(false);
    });
});
(0, vitest_1.describe)('Donation Eligibility & 56-Day Safety Interval', () => {
    const referenceDate = new Date('2026-10-10T12:00:00Z');
    (0, vitest_1.it)('allows donors with no previous recorded donation', () => {
        const result = (0, index_js_1.calculateDonationEligibility)(null, 'whole_blood', undefined, referenceDate);
        (0, vitest_1.expect)(result.isEligible).toBe(true);
        (0, vitest_1.expect)(result.daysRemaining).toBe(0);
    });
    (0, vitest_1.it)('blocks donor who donated 30 days ago under 56-day rule', () => {
        const thirtyDaysAgo = new Date('2026-09-10T12:00:00Z');
        const result = (0, index_js_1.calculateDonationEligibility)(thirtyDaysAgo, 'whole_blood', undefined, referenceDate);
        (0, vitest_1.expect)(result.isEligible).toBe(false);
        (0, vitest_1.expect)(result.daysRemaining).toBe(26);
        (0, vitest_1.expect)(result.reason).toContain('26 days remaining');
    });
    (0, vitest_1.it)('permits donor who donated 60 days ago under 56-day rule', () => {
        const sixtyDaysAgo = new Date('2026-08-11T12:00:00Z');
        const result = (0, index_js_1.calculateDonationEligibility)(sixtyDaysAgo, 'whole_blood', undefined, referenceDate);
        (0, vitest_1.expect)(result.isEligible).toBe(true);
        (0, vitest_1.expect)(result.daysRemaining).toBe(0);
    });
    (0, vitest_1.it)('applies 7-day interval correctly for platelet apheresis', () => {
        const fiveDaysAgo = new Date('2026-10-05T12:00:00Z');
        const resultPlateletBlocked = (0, index_js_1.calculateDonationEligibility)(fiveDaysAgo, 'platelets', undefined, referenceDate);
        (0, vitest_1.expect)(resultPlateletBlocked.isEligible).toBe(false);
        (0, vitest_1.expect)(resultPlateletBlocked.daysRemaining).toBe(2);
        const tenDaysAgo = new Date('2026-09-30T12:00:00Z');
        const resultPlateletAllowed = (0, index_js_1.calculateDonationEligibility)(tenDaysAgo, 'platelets', undefined, referenceDate);
        (0, vitest_1.expect)(resultPlateletAllowed.isEligible).toBe(true);
    });
});
(0, vitest_1.describe)('Intelligent Donor Scoring Engine', () => {
    const candidate = {
        donorUuid: 'donor-abc-123',
        bloodGroup: 'O+',
        latApprox: 37.7749,
        lngApprox: -122.4194,
        isAvailable: true,
        isEligible: true,
        serviceRadiusKm: 25,
        lastDonationDate: null,
        donationCount: 4
    };
    (0, vitest_1.it)('ranks compatible and nearby donor with high score', () => {
        const score = (0, index_js_1.scoreDonorForRequest)(candidate, 37.78, -122.41, 'O+', 'packed_red_blood_cells', 'critical', 5.2);
        (0, vitest_1.expect)(score).not.toBeNull();
        (0, vitest_1.expect)(score?.isDirectMatch).toBe(true);
        (0, vitest_1.expect)(score?.score).toBeGreaterThan(80);
    });
    (0, vitest_1.it)('returns null if donor is out of radius', () => {
        const score = (0, index_js_1.scoreDonorForRequest)(candidate, 37.0, -122.0, 'O+', 'packed_red_blood_cells', 'critical', 60 // 60km > 25km radius
        );
        (0, vitest_1.expect)(score).toBeNull();
    });
    (0, vitest_1.it)('returns null if donor is medically incompatible', () => {
        const score = (0, index_js_1.scoreDonorForRequest)(candidate, // O+
        37.78, -122.41, 'O-', // O- recipient CANNOT receive O+ RBC
        'packed_red_blood_cells', 'urgent', 5);
        (0, vitest_1.expect)(score).toBeNull();
    });
    (0, vitest_1.it)('returns null if donor is unavailable or marked ineligible', () => {
        const unavailableDonor = { ...candidate, isAvailable: false };
        const score = (0, index_js_1.scoreDonorForRequest)(unavailableDonor, 37.78, -122.41, 'O+', 'packed_red_blood_cells', 'urgent', 5);
        (0, vitest_1.expect)(score).toBeNull();
    });
});
