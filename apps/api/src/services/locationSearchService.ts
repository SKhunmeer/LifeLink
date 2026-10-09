import { fetchNominatim } from './nominatimClient.js';

export interface GeocodedPlace {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: string;
}

interface NominatimPlace {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  category: string;
}

export async function searchPlaces(query: string): Promise<GeocodedPlace[]> {
  const endpoint = process.env.NOMINATIM_API_URL || 'https://nominatim.openstreetmap.org/search';
  const url = new URL(endpoint);
  url.search = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    limit: '5',
    addressdetails: '0',
  }).toString();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetchNominatim(url, controller.signal);

    if (!response.ok) {
      if (response.status === 429) throw new Error('The live place search is rate-limiting requests. Please wait and retry.');
      throw new Error(`The live place search returned HTTP ${response.status}. Please retry later.`);
    }

    const results = await response.json() as NominatimPlace[];
    if (!Array.isArray(results)) throw new Error('The live place search returned an invalid response.');

    return results.flatMap((place) => {
      const lat = Number(place.lat);
      const lng = Number(place.lon);
      if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
        return [];
      }
      return [{
        id: String(place.place_id),
        name: place.display_name,
        lat,
        lng,
        category: [place.category, place.type].filter(Boolean).join(' · '),
      }];
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Live place search timed out. Please retry.');
    }
    if (error instanceof TypeError && error.message.includes('fetch failed')) {
      throw new Error('Could not connect to live place search. Check the network and retry.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
