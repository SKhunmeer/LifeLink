'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Loader2, LocateFixed, MapPinned, Navigation, Phone, RefreshCw, Search } from 'lucide-react';
import { api, type GeocodedPlace, type NearbyHospital } from '../lib/api';

export interface LocationSelection {
  lat: number;
  lng: number;
  accuracy?: number;
  source?: 'device' | 'manual';
  label?: string;
}

interface InteractiveMapProps {
  onLocationChange?: (location: LocationSelection | null) => void;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({ onLocationChange }) => {
  const [mounted, setMounted] = useState(false);
  const [selectedNearbyId, setSelectedNearbyId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showList, setShowList] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<LocationSelection | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [locationError, setLocationError] = useState('');
  const [manualLocationOpen, setManualLocationOpen] = useState(false);
  const [manualPlaceQuery, setManualPlaceQuery] = useState('Medchal, Telangana, India');
  const [placeResults, setPlaceResults] = useState<GeocodedPlace[]>([]);
  const [placeSearchLoading, setPlaceSearchLoading] = useState(false);
  const [placeSearchError, setPlaceSearchError] = useState('');
  const [nearbyHospitals, setNearbyHospitals] = useState<NearbyHospital[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState('');
  const [radiusKm, setRadiusKm] = useState(5);
  const [nearbyRefreshKey, setNearbyRefreshKey] = useState(0);
  const locationRequestId = useRef(0);
  const currentLocationRef = useRef<LocationSelection | null>(null);
  currentLocationRef.current = currentLocation;

  useEffect(() => {
    setMounted(true);
  }, []);

  const requestCurrentLocation = useCallback(() => {
    if (!window.isSecureContext) {
      setLocationStatus('error');
      setLocationError('Location access requires a secure connection (HTTPS, or localhost during development).');
      return;
    }
    if (!navigator.geolocation) {
      setLocationStatus('error');
      setLocationError('This browser does not support device location. You can retry in a supported browser.');
      return;
    }

    const requestId = ++locationRequestId.current;
    if (currentLocationRef.current?.source !== 'manual') {
      setCurrentLocation(null);
      onLocationChange?.(null);
      setNearbyHospitals([]);
      setNearbyLoading(false);
      setNearbyError('');
    }
    setLocationStatus('loading');
    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (requestId !== locationRequestId.current) return;
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          source: 'device' as const,
        };
        setCurrentLocation(location);
        setLocationStatus('success');
        onLocationChange?.(location);
      },
      (error) => {
        if (requestId !== locationRequestId.current) return;
        setLocationStatus('error');
        if (error.code === error.PERMISSION_DENIED) {
          setLocationError('Location permission was denied. Enable location access for this site in your browser settings, then retry.');
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setLocationError('Your device could not determine a location. Check location services and retry.');
        } else if (error.code === error.TIMEOUT) {
          setLocationError('Location detection timed out. Move to an area with better GPS or network reception and retry.');
        } else {
          setLocationError('The browser could not detect your location. Please retry.');
        }
        setManualLocationOpen(true);
      },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
    );
  }, [onLocationChange]);

  const searchManualPlace = async (event: React.FormEvent) => {
    event.preventDefault();
    setPlaceSearchLoading(true);
    setPlaceSearchError('');
    setPlaceResults([]);
    try {
      const result = await api.searchPlaces(manualPlaceQuery.trim());
      setPlaceResults(result.places);
      if (result.places.length === 0) {
        setPlaceSearchError('No matching places found. Try a more specific locality or PIN code.');
      }
    } catch (error) {
      setPlaceSearchError(error instanceof Error ? error.message : 'Live place search failed. Please retry.');
    } finally {
      setPlaceSearchLoading(false);
    }
  };

  const selectManualPlace = (place: GeocodedPlace) => {
    const location: LocationSelection = {
      lat: place.lat,
      lng: place.lng,
      accuracy: 0,
      source: 'manual',
      label: place.name,
    };
    setCurrentLocation(location);
    setLocationStatus('success');
    setLocationError('');
    setManualLocationOpen(false);
    onLocationChange?.(location);
  };

  const renderManualPlaceSearch = () => (
    <form onSubmit={searchManualPlace} className="mt-3 space-y-2">
      <label htmlFor="manual-location-search" className="block text-xs font-semibold text-slate-700">
        Search an area or PIN code (approximate, not GPS)
      </label>
      <div className="flex gap-2">
        <input
          id="manual-location-search"
          value={manualPlaceQuery}
          onChange={(event) => setManualPlaceQuery(event.target.value)}
          minLength={3}
          maxLength={200}
          required
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
        />
        <button
          type="submit"
          disabled={placeSearchLoading}
          className="rounded-lg bg-blue-700 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          {placeSearchLoading ? 'Searching…' : 'Search live map'}
        </button>
      </div>
      <p className="text-[10px] text-slate-500">Search OpenStreetMap, then choose a result to use its approximate map point. A specific locality or PIN code gives better nearby results.</p>
      {placeSearchError && <p className="text-xs text-rose-700" role="alert">{placeSearchError}</p>}
      {placeResults.map((place) => (
        <button
          key={place.id}
          type="button"
          onClick={() => selectManualPlace(place)}
          className="block w-full rounded-lg border border-slate-200 bg-white p-2 text-left text-xs text-slate-700 hover:border-blue-300"
        >
          <span className="block font-semibold">{place.name}</span>
          {place.category && <span className="mt-0.5 block text-[10px] text-slate-500">{place.category}</span>}
        </button>
      ))}
    </form>
  );

  useEffect(() => {
    requestCurrentLocation();
  }, [requestCurrentLocation]);

  useEffect(() => {
    if (!currentLocation) return;
    let active = true;
    setNearbyLoading(true);
    setNearbyError('');
    api.getNearbyHospitals(currentLocation.lat, currentLocation.lng, radiusKm * 1000)
      .then((result) => {
        if (active) {
          setNearbyHospitals(result.hospitals);
          setSelectedNearbyId(result.hospitals[0]?.id ?? null);
        }
      })
      .catch((error: Error) => {
        if (active) {
          setNearbyHospitals([]);
          setNearbyError(error.message || 'Nearby hospitals could not be loaded. Please retry.');
        }
      })
      .finally(() => {
        if (active) setNearbyLoading(false);
      });
    return () => {
      active = false;
    };
  }, [currentLocation, nearbyRefreshKey, radiusKm]);

  const filteredNearbyHospitals = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return nearbyHospitals.filter((facility) => !query
      || facility.name.toLowerCase().includes(query)
      || facility.address?.toLowerCase().includes(query)
      || facility.phone?.toLowerCase().includes(query));
  }, [nearbyHospitals, searchTerm]);

  const selectedNearby = filteredNearbyHospitals.find((facility) => facility.id === selectedNearbyId)
    ?? filteredNearbyHospitals[0]
    ?? null;

  if (!mounted) {
    return (
      <div className="flex h-[520px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 text-sm text-slate-500">
        Loading facility network map...
      </div>
    );
  }

  const MapComponent = dynamic(
    async () => {
      const mod = await import('react-leaflet');
      const { Circle, CircleMarker, MapContainer, Popup, TileLayer, Tooltip, ZoomControl, useMap } = mod;

      const MapFocus = ({ center, zoom }: { center: [number, number]; zoom: number }) => {
        const map = useMap();

        useEffect(() => {
          map.flyTo(center, zoom, { duration: 1.1 });
        }, [center, map, zoom]);

        return null;
      };

      return function LeafletMap() {
        if (!currentLocation) {
          return (
            <div className="flex h-[420px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center">
              {locationStatus === 'loading' ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin text-blue-700" />
                  <p className="text-sm font-semibold text-slate-700">Detecting your device location…</p>
                </>
              ) : (
                <>
                  <MapPinned className="h-7 w-7 text-slate-400" />
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Map waiting for your location</p>
                    <p className="mt-1 max-w-md text-xs text-slate-500">
                      The map will only show your position and nearby facilities after your browser provides your current coordinates. No demo-city location is used.
                    </p>
                    {locationError && <p className="mt-2 text-xs text-rose-700" role="alert">{locationError}</p>}
                    {!currentLocation && (
                      <button
                        type="button"
                        onClick={() => setManualLocationOpen((open) => !open)}
                        className="mt-2 text-xs font-semibold text-blue-800 underline"
                      >
                        {manualLocationOpen ? 'Use device location instead' : 'Choose a location manually'}
                      </button>
                    )}
                    {manualLocationOpen && renderManualPlaceSearch()}
                  </div>
                </>
              )}
            </div>
          );
        }

        const center: [number, number] = [currentLocation.lat, currentLocation.lng];
        const zoom = 13;

        return (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_320px]">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <MapPinned className="h-4 w-4 text-rose-600" />
                  Live OpenStreetMap data
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-600" />{currentLocation.source === 'manual' ? 'Selected area' : 'Your location'}</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-violet-600" />Nearby hospital</span>
                </div>
              </div>

              <MapContainer center={center} zoom={zoom} scrollWheelZoom={false} zoomControl={false} className="h-[420px] w-full" style={{ zIndex: 1 }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <ZoomControl position="topright" />
                <MapFocus center={center} zoom={zoom} />

                {currentLocation && (
                  <>
                    {currentLocation.source === 'device' && (currentLocation.accuracy ?? 0) > 0 && (
                      <Circle
                        center={[currentLocation.lat, currentLocation.lng]}
                        radius={currentLocation.accuracy ?? 0}
                        pathOptions={{ color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.12, weight: 1 }}
                      />
                    )}
                    <CircleMarker
                      center={[currentLocation.lat, currentLocation.lng]}
                      radius={11}
                      pathOptions={{ color: '#ffffff', fillColor: '#2563eb', fillOpacity: 1, weight: 4 }}
                    >
                      <Tooltip permanent direction="top" offset={[0, -10]}>
                        {currentLocation.source === 'manual' ? 'Selected Area (Approximate)' : 'Your Current Location'}
                      </Tooltip>
                      <Popup><strong>{currentLocation.source === 'manual' ? `Selected area: ${currentLocation.label}` : 'Your Current Location'}</strong></Popup>
                    </CircleMarker>
                  </>
                )}

                {filteredNearbyHospitals.map((facility) => (
                  <CircleMarker
                    key={`nearby-${facility.id}`}
                    center={[facility.lat, facility.lng]}
                    radius={selectedNearby?.id === facility.id ? 11 : 8}
                    pathOptions={{ color: '#ffffff', fillColor: '#7c3aed', fillOpacity: 0.95, weight: 3 }}
                    eventHandlers={{ click: () => setSelectedNearbyId(facility.id) }}
                  >
                    <Popup>
                      <div className="min-w-[200px] space-y-1 text-xs">
                        <strong className="text-slate-900">{facility.name}</strong>
                        <div>{facility.address || 'Address unavailable'}</div>
                        <div>{facility.distanceKm.toFixed(1)} km from {currentLocation.source === 'manual' ? 'the selected area' : 'your device'} · Availability unknown</div>
                        {facility.phone && <a href={`tel:${facility.phone}`}>{facility.phone}</a>}
                        <a className="block text-blue-700" href={facility.directionsUrl} target="_blank" rel="noreferrer">Get directions</a>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}

              </MapContainer>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Coverage list</div>
                  <div className="mt-1 text-lg font-bold text-slate-900">{filteredNearbyHospitals.length} live results</div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowList((prev) => !prev)}
                  className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  {showList ? 'Hide list' : 'Show list'}
                </button>
              </div>

              {showList && (
                <div className="space-y-3">
                  <div className="rounded-xl border border-violet-100 bg-violet-50/70 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-bold text-slate-900">Nearby hospitals</div>
                        <div className="text-[11px] text-slate-500">
                          {currentLocation
                            ? `Within ${radiusKm} km of ${currentLocation.source === 'manual' ? 'selected area' : 'device location'} · stock availability is unknown`
                            : 'Detect your location to search live nearby places'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => currentLocation ? setNearbyRefreshKey((key) => key + 1) : requestCurrentLocation()}
                        disabled={locationStatus === 'loading' || nearbyLoading}
                        className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-violet-800 disabled:opacity-50"
                      >
                        {nearbyLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        {currentLocation ? 'Refresh Nearby Hospitals' : 'Find Nearby Hospitals'}
                      </button>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                      <span>Search radius</span>
                      <select
                        aria-label="Nearby hospital search radius"
                        value={radiusKm}
                        onChange={(event) => setRadiusKm(Number(event.target.value))}
                        className="rounded-md border border-slate-200 bg-white px-2 py-1"
                      >
                        <option value={5}>5 km</option>
                        <option value={10}>10 km</option>
                      </select>
                    </div>
                    {locationStatus === 'loading' && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-blue-700" role="status">
                        <Loader2 className="h-4 w-4 animate-spin" /> Detecting your current location…
                      </div>
                    )}
                    {locationError && <p className="mt-2 text-xs text-rose-700" role="alert">{locationError}</p>}
                    {currentLocation && (
                      <button
                        type="button"
                        onClick={() => setManualLocationOpen((open) => !open)}
                        className="mt-2 text-xs font-semibold text-blue-800 underline"
                      >
                        {manualLocationOpen ? 'Hide manual place search' : 'Choose/change area manually'}
                      </button>
                    )}
                    {currentLocation && manualLocationOpen && renderManualPlaceSearch()}
                    {nearbyError && <p className="mt-2 text-xs text-rose-700" role="alert">{nearbyError}</p>}
                    {nearbyLoading && currentLocation && <p className="mt-2 text-xs text-violet-700" role="status">Searching OpenStreetMap for hospitals…</p>}
                    {!nearbyLoading && currentLocation && !nearbyError && nearbyHospitals.length === 0 && (
                      <p className="mt-2 text-xs text-slate-600">No hospitals were found in this radius. Try 10 km or refresh.</p>
                    )}
                  </div>
                  {filteredNearbyHospitals.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-5 text-sm text-slate-500">
                      {nearbyLoading
                        ? 'Loading live nearby places…'
                        : searchTerm
                          ? 'No live place results match this search.'
                          : 'No nearby hospitals were returned for this location and radius.'}
                    </div>
                  ) : (
                    filteredNearbyHospitals.map((facility) => {
                      const isActive = facility.id === selectedNearby?.id;
                      return (
                        <button
                          key={facility.id}
                          type="button"
                          onClick={() => setSelectedNearbyId(facility.id)}
                          className={`w-full rounded-2xl border p-3 text-left transition ${
                            isActive ? 'border-violet-200 bg-violet-50 shadow-sm' : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold text-slate-900">{facility.name}</div>
                              <div className="mt-1 text-[11px] text-slate-500">{facility.address || 'Address unavailable'}</div>
                            </div>
                            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-violet-600" />
                          </div>

                          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                            <span>{facility.distanceKm.toFixed(1)} km away</span>
                            <span className="font-semibold text-slate-800">Availability unknown</span>
                          </div>
                          {facility.phone && <div className="mt-2 text-[11px] text-slate-600">{facility.phone}</div>}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        );
      };
    },
    { ssr: false }
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Transportation coverage</div>
          <h3 className="mt-1 text-xl font-black text-slate-900">Live nearby hospitals</h3>
          <p className="mt-1 text-xs text-slate-500">Live OpenStreetMap results only; seeded demo hospitals are excluded. Device GPS is preferred; manual place selection is approximate.</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={requestCurrentLocation}
            disabled={locationStatus === 'loading'}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:opacity-60"
          >
            {locationStatus === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
            {locationStatus === 'loading' ? 'Finding location…' : 'Find Nearby Hospitals'}
          </button>
          <div className="relative min-w-[220px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search facility or location"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-rose-300 focus:bg-white"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowList((prev) => !prev)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            {showList ? 'Map + list' : 'Map only'}
          </button>
        </div>
      </div>

      {currentLocation && (
        <p className="px-1 text-xs text-slate-500" aria-live="polite">
          {currentLocation.source !== 'manual'
            ? <>Device GPS: {currentLocation.lat.toFixed(5)}, {currentLocation.lng.toFixed(5)}{currentLocation.accuracy != null ? ` (±${Math.round(currentLocation.accuracy)} m)` : ''}</>
            : <>Approximate selected area: {currentLocation.label} · {currentLocation.lat.toFixed(5)}, {currentLocation.lng.toFixed(5)}</>}
          {' '}· Search radius {radiusKm} km
        </p>
      )}

      <MapComponent />
    </div>
  );
};
