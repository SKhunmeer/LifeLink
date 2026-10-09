import { afterEach, describe, expect, it, vi } from 'vitest';
import { searchNearbyHospitals } from './nearbyHospitalService.js';

describe('searchNearbyHospitals', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps real OpenStreetMap elements to distance-ranked results without claiming stock', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        elements: [
          {
            type: 'way',
            id: 22,
            center: { lat: 10.01, lon: 20.01 },
            tags: { name: 'Far Hospital', 'addr:street': 'Main Road', 'contact:phone': '+12345678901' },
          },
          {
            type: 'node',
            id: 11,
            lat: 10.001,
            lon: 20.001,
            tags: { name: 'Nearby Hospital', phone: '+12345678902' },
          },
          {
            type: 'node',
            id: 33,
            lat: 10.1,
            lon: 20.1,
            tags: { name: 'Outside Search Radius' },
          },
        ],
      }),
    }));

    const results = await searchNearbyHospitals(10, 20, 5000);

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      id: 'node/11',
      name: 'Nearby Hospital',
      phone: '+12345678902',
      availability: 'unknown',
    });
    expect(results[0].distanceKm).toBeLessThan(results[1].distanceKm);
    expect(results[1].address).toBe('Main Road');
    expect(results[0].directionsUrl).toContain('10%2C20');
  });

  it('reports upstream rate limiting instead of returning an empty success result', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 }));

    await expect(searchNearbyHospitals(10, 20, 5000))
      .rejects.toThrow('rate-limiting requests');
  });

  it('falls back to spatially bounded live Nominatim data when Overpass is unavailable', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 504 })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [{
          place_id: 123,
          osm_type: 'node',
          osm_id: 456,
          lat: '17.6397203',
          lon: '78.4739716',
          category: 'amenity',
          type: 'hospital',
          name: 'Community Health Center Medchal',
          display_name: 'Community Health Center Medchal, Medchal, Telangana, India',
        }],
      });
    vi.stubGlobal('fetch', fetchMock);

    const results = await searchNearbyHospitals(17.6339929, 78.4843146, 5000);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: 'nominatim/node/456',
      name: 'Community Health Center Medchal',
      address: 'Medchal, Telangana, India',
      phone: null,
      availability: 'unknown',
    });
    const fallbackUrl = new URL(fetchMock.mock.calls[1][0] as string);
    expect(fallbackUrl.searchParams.get('bounded')).toBe('1');
  });

  it('returns an empty list when the upstream search finds no places', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ elements: [] }),
    }));

    await expect(searchNearbyHospitals(10, 20, 5000)).resolves.toEqual([]);
  });

  it('reports network failures as retryable hospital-search errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

    await expect(searchNearbyHospitals(10, 20, 5000))
      .rejects.toThrow('Could not connect to live OpenStreetMap hospital search');
  });
});
