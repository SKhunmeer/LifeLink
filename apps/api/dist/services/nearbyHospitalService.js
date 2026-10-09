"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchNearbyHospitals = searchNearbyHospitals;
const shared_1 = require("@bloodlink/shared");
const nominatimClient_js_1 = require("./nominatimClient.js");
function getAddress(tags) {
    if (tags['addr:full'])
        return tags['addr:full'];
    return [
        [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' '),
        tags['addr:suburb'] || tags['addr:neighbourhood'],
        tags['addr:city'] || tags['addr:town'] || tags['addr:village'],
        tags['addr:postcode'],
    ].filter(Boolean).join(', ') || null;
}
async function searchNominatimHospitals(lat, lng, radiusMeters) {
    const endpoint = process.env.NOMINATIM_API_URL || 'https://nominatim.openstreetmap.org/search';
    const latDelta = radiusMeters / 111_000;
    const lngDelta = radiusMeters / (111_000 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
    const url = new URL(endpoint);
    url.search = new URLSearchParams({
        format: 'jsonv2',
        q: 'hospital',
        viewbox: `${lng - lngDelta},${lat + latDelta},${lng + lngDelta},${lat - latDelta}`,
        bounded: '1',
        limit: '50',
    }).toString();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
        const response = await (0, nominatimClient_js_1.fetchNominatim)(url, controller.signal);
        if (!response.ok) {
            if (response.status === 429)
                throw new Error('The live hospital search is rate-limiting requests. Please wait and retry.');
            throw new Error(`The live hospital search returned HTTP ${response.status}. Please retry later.`);
        }
        const places = await response.json();
        if (!Array.isArray(places))
            throw new Error('The live hospital search returned an invalid response.');
        return places.flatMap((place) => {
            const placeLat = Number(place.lat);
            const placeLng = Number(place.lon);
            const isHospital = (place.category === 'amenity' && place.type === 'hospital')
                || (place.category === 'healthcare' && ['hospital', 'blood_bank', 'blood_donation'].includes(place.type));
            if (!isHospital || !place.name || !Number.isFinite(placeLat) || !Number.isFinite(placeLng))
                return [];
            const distanceKm = (0, shared_1.calculateDistanceKm)(lat, lng, placeLat, placeLng);
            if (distanceKm > radiusMeters / 1000)
                return [];
            const osmType = place.osm_type || 'place';
            const osmId = place.osm_id ?? place.place_id;
            const route = `${lat},${lng};${placeLat},${placeLng}`;
            return [{
                    id: `nominatim/${osmType}/${osmId}`,
                    name: place.name,
                    lat: placeLat,
                    lng: placeLng,
                    address: place.display_name.split(',').slice(1).join(',').trim() || null,
                    phone: null,
                    distanceKm,
                    availability: 'unknown',
                    directionsUrl: `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${encodeURIComponent(route)}`,
                }];
        }).sort((a, b) => a.distanceKm - b.distanceKm);
    }
    catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error('Live hospital search timed out. Please retry.');
        }
        if (error instanceof TypeError && error.message.includes('fetch failed')) {
            throw new Error('Could not connect to live OpenStreetMap hospital search. Check the network and retry.');
        }
        throw error;
    }
    finally {
        clearTimeout(timeout);
    }
}
async function searchNearbyHospitals(lat, lng, radiusMeters) {
    const endpoint = process.env.OVERPASS_API_URL || 'https://overpass-api.de/api/interpreter';
    const query = `
    [out:json][timeout:15];
    (
      nwr(around:${radiusMeters},${lat},${lng})["amenity"="hospital"];
      nwr(around:${radiusMeters},${lat},${lng})["healthcare"~"^(hospital|blood_bank|blood_donation)$"];
    );
    out center tags;
  `;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 18000);
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Accept: 'application/json',
                'User-Agent': 'BloodLinkAI/1.0 (nearby hospital search)',
            },
            body: new URLSearchParams({ data: query }),
            signal: controller.signal,
        });
        if (!response.ok) {
            if (response.status === 429)
                throw new Error('The hospital search service is rate-limiting requests. Please wait and retry.');
            throw new Error(`The hospital search service returned HTTP ${response.status}. Please retry later.`);
        }
        const data = await response.json();
        if (!Array.isArray(data.elements)) {
            throw new Error('The hospital search service returned an invalid response.');
        }
        const uniqueHospitals = new Map();
        for (const element of data.elements) {
            const tags = element.tags || {};
            const elementLat = element.lat ?? element.center?.lat;
            const elementLng = element.lon ?? element.center?.lon;
            if (!tags.name || !Number.isFinite(elementLat) || !Number.isFinite(elementLng))
                continue;
            const hospitalLat = Number(elementLat);
            const hospitalLng = Number(elementLng);
            const distanceKm = (0, shared_1.calculateDistanceKm)(lat, lng, hospitalLat, hospitalLng);
            if (distanceKm > radiusMeters / 1000)
                continue;
            const id = `${element.type}/${element.id}`;
            const route = `${lat},${lng};${hospitalLat},${hospitalLng}`;
            uniqueHospitals.set(id, {
                id,
                name: tags.name,
                lat: hospitalLat,
                lng: hospitalLng,
                address: getAddress(tags),
                phone: tags.phone || tags['contact:phone'] || null,
                distanceKm,
                availability: 'unknown',
                directionsUrl: `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${encodeURIComponent(route)}`,
            });
        }
        return [...uniqueHospitals.values()].sort((a, b) => a.distanceKm - b.distanceKm);
    }
    catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            return searchNominatimHospitals(lat, lng, radiusMeters);
        }
        if (error instanceof TypeError && error.message.includes('fetch failed')) {
            return searchNominatimHospitals(lat, lng, radiusMeters);
        }
        if (error instanceof Error && /returned HTTP 5\d\d/.test(error.message)) {
            return searchNominatimHospitals(lat, lng, radiusMeters);
        }
        if (error instanceof Error && error.message.includes('rate-limiting requests')) {
            return searchNominatimHospitals(lat, lng, radiusMeters);
        }
        throw error;
    }
    finally {
        clearTimeout(timeout);
    }
}
