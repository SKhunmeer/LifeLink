import { describe, it, expect } from 'vitest';
import {
  isBloodCompatible,
  calculateDonationEligibility,
  scoreDonorForRequest,
  PRBC_COMPATIBILITY,
  PLASMA_COMPATIBILITY
} from './index.js';
import { BloodGroup } from '@bloodlink/shared';

describe('Red Blood Cell (PRBC) Compatibility', () => {
  it('correctly identifies O- recipient as strictly compatible with only O- RBCs', () => {
    expect(isBloodCompatible('O-', 'O-', 'packed_red_blood_cells')).toBe(true);
    expect(isBloodCompatible('O-', 'O+', 'packed_red_blood_cells')).toBe(false);
    expect(isBloodCompatible('O-', 'A-', 'packed_red_blood_cells')).toBe(false);
    expect(isBloodCompatible('O-', 'AB+', 'packed_red_blood_cells')).toBe(false);
  });

  it('correctly identifies AB+ recipient as universal recipient for PRBCs', () => {
    const allGroups: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    allGroups.forEach((donor) => {
      expect(isBloodCompatible('AB+', donor, 'packed_red_blood_cells')).toBe(true);
    });
  });

  it('correctly handles A+ recipient compatible with A+, A-, O+, O-', () => {
    expect(isBloodCompatible('A+', 'A+', 'packed_red_blood_cells')).toBe(true);
    expect(isBloodCompatible('A+', 'A-', 'packed_red_blood_cells')).toBe(true);
    expect(isBloodCompatible('A+', 'O+', 'packed_red_blood_cells')).toBe(true);
    expect(isBloodCompatible('A+', 'O-', 'packed_red_blood_cells')).toBe(true);
    expect(isBloodCompatible('A+', 'B+', 'packed_red_blood_cells')).toBe(false);
    expect(isBloodCompatible('A+', 'AB+', 'packed_red_blood_cells')).toBe(false);
  });
});

describe('Fresh Frozen Plasma (FFP) Compatibility', () => {
  it('validates that AB is the universal plasma donor (not O-!)', () => {
    // AB plasma can be given to anyone because it lacks anti-A and anti-B antibodies
    const allGroups: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    allGroups.forEach((recipient) => {
      expect(isBloodCompatible(recipient, 'AB+', 'plasma')).toBe(true);
      expect(isBloodCompatible(recipient, 'AB-', 'plasma')).toBe(true);
    });
  });

  it('prohibits O plasma from being given to AB recipients', () => {
    // AB recipient has A and B antigens; O plasma has anti-A and anti-B antibodies!
    expect(isBloodCompatible('AB+', 'O-', 'plasma')).toBe(false);
    expect(isBloodCompatible('AB+', 'O+', 'plasma')).toBe(false);
    expect(isBloodCompatible('AB-', 'O-', 'plasma')).toBe(false);
  });
});

describe('Donation Eligibility & 56-Day Safety Interval', () => {
  const referenceDate = new Date('2026-10-10T12:00:00Z');

  it('allows donors with no previous recorded donation', () => {
    const result = calculateDonationEligibility(null, 'whole_blood', undefined, referenceDate);
    expect(result.isEligible).toBe(true);
    expect(result.daysRemaining).toBe(0);
  });

  it('blocks donor who donated 30 days ago under 56-day rule', () => {
    const thirtyDaysAgo = new Date('2026-09-10T12:00:00Z');
    const result = calculateDonationEligibility(thirtyDaysAgo, 'whole_blood', undefined, referenceDate);
    expect(result.isEligible).toBe(false);
    expect(result.daysRemaining).toBe(26);
    expect(result.reason).toContain('26 days remaining');
  });

  it('permits donor who donated 60 days ago under 56-day rule', () => {
    const sixtyDaysAgo = new Date('2026-08-11T12:00:00Z');
    const result = calculateDonationEligibility(sixtyDaysAgo, 'whole_blood', undefined, referenceDate);
    expect(result.isEligible).toBe(true);
    expect(result.daysRemaining).toBe(0);
  });

  it('applies 7-day interval correctly for platelet apheresis', () => {
    const fiveDaysAgo = new Date('2026-10-05T12:00:00Z');
    const resultPlateletBlocked = calculateDonationEligibility(fiveDaysAgo, 'platelets', undefined, referenceDate);
    expect(resultPlateletBlocked.isEligible).toBe(false);
    expect(resultPlateletBlocked.daysRemaining).toBe(2);

    const tenDaysAgo = new Date('2026-09-30T12:00:00Z');
    const resultPlateletAllowed = calculateDonationEligibility(tenDaysAgo, 'platelets', undefined, referenceDate);
    expect(resultPlateletAllowed.isEligible).toBe(true);
  });
});

describe('Intelligent Donor Scoring Engine', () => {
  const candidate = {
    donorUuid: 'donor-abc-123',
    bloodGroup: 'O+' as BloodGroup,
    latApprox: 37.7749,
    lngApprox: -122.4194,
    isAvailable: true,
    isEligible: true,
    serviceRadiusKm: 25,
    lastDonationDate: null,
    donationCount: 4
  };

  it('ranks compatible and nearby donor with high score', () => {
    const score = scoreDonorForRequest(
      candidate,
      37.78,
      -122.41,
      'O+',
      'packed_red_blood_cells',
      'critical',
      5.2
    );
    expect(score).not.toBeNull();
    expect(score?.isDirectMatch).toBe(true);
    expect(score?.score).toBeGreaterThan(80);
  });

  it('returns null if donor is out of radius', () => {
    const score = scoreDonorForRequest(
      candidate,
      37.0,
      -122.0,
      'O+',
      'packed_red_blood_cells',
      'critical',
      60 // 60km > 25km radius
    );
    expect(score).toBeNull();
  });

  it('returns null if donor is medically incompatible', () => {
    const score = scoreDonorForRequest(
      candidate, // O+
      37.78,
      -122.41,
      'O-', // O- recipient CANNOT receive O+ RBC
      'packed_red_blood_cells',
      'urgent',
      5
    );
    expect(score).toBeNull();
  });

  it('returns null if donor is unavailable or marked ineligible', () => {
    const unavailableDonor = { ...candidate, isAvailable: false };
    const score = scoreDonorForRequest(
      unavailableDonor,
      37.78,
      -122.41,
      'O+',
      'packed_red_blood_cells',
      'urgent',
      5
    );
    expect(score).toBeNull();
  });
});
