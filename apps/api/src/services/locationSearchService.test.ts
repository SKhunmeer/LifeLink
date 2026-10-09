import { afterEach, describe, expect, it, vi } from 'vitest';
import { searchPlaces } from './locationSearchService.js';

describe('searchPlaces', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps live Nominatim search results to validated place coordinates', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        {
          place_id: 123,
          display_name: 'Medchal, Telangana, India',
          lat: '17.6300',
          lon: '78.4800',
          category: 'boundary',
          type: 'administrative',
        },
        {
          place_id: 456,
          display_name: 'Invalid location',
          lat: '91',
          lon: '181',
          category: 'place',
          type: 'town',
        },
      ],
    });
    vi.stubGlobal('fetch', fetchMock);

    const results = await searchPlaces('Medchal district, Telangana, India');

    expect(results).toEqual([{
      id: '123',
      name: 'Medchal, Telangana, India',
      lat: 17.63,
      lng: 78.48,
      category: 'boundary · administrative',
    }]);
    expect(fetchMock).toHaveBeenCalledOnce();
    const requestedUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(requestedUrl.searchParams.get('q')).toBe('Medchal district, Telangana, India');
  });

  it('reports rate limiting instead of returning an empty result', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 }));

    await expect(searchPlaces('Medchal, Telangana')).rejects.toThrow('rate-limiting requests');
  });

  it('reports network failures as retryable place-search errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

    await expect(searchPlaces('Medchal, Telangana'))
      .rejects.toThrow('Could not connect to live place search');
  });
});
