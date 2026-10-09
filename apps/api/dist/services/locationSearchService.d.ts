export interface GeocodedPlace {
    id: string;
    name: string;
    lat: number;
    lng: number;
    category: string;
}
export declare function searchPlaces(query: string): Promise<GeocodedPlace[]>;
