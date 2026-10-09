export interface NearbyHospital {
    id: string;
    name: string;
    lat: number;
    lng: number;
    address: string | null;
    phone: string | null;
    distanceKm: number;
    availability: 'unknown';
    directionsUrl: string;
}
export declare function searchNearbyHospitals(lat: number, lng: number, radiusMeters: number): Promise<NearbyHospital[]>;
