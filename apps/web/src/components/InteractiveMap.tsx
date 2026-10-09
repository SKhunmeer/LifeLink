'use client';

import React, { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { LocateFixed, MapPinned, Search, SlidersHorizontal } from 'lucide-react';

interface InteractiveMapProps {
  hospitals: any[];
  requests: any[];
}

const normalizeNumber = (value: any, fallback = 0) => {
  const num = Number(value ?? fallback);
  return Number.isFinite(num) ? num : fallback;
};

const getFacilityStatus = (facility: any) => {
  const verified = Boolean(facility?.isVerified ?? facility?.verified ?? facility?.verificationStatus === 'verified');
  const totalUnits = normalizeNumber(facility?.totalAvailableUnits ?? facility?.availableUnits ?? 0);

  if (!verified) return 'unknown';
  if (totalUnits <= 0) return 'critical';
  if (totalUnits < 5) return 'low';
  return 'healthy';
};

export const InteractiveMap: React.FC<InteractiveMapProps> = ({ hospitals, requests }) => {
  const [mounted, setMounted] = useState(false);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [bloodGroup, setBloodGroup] = useState('all');
  const [component, setComponent] = useState('all');
  const [showList, setShowList] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  const filteredHospitals = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return hospitals.filter((facility) => {
      const matchesSearch = !query
        || facility.name?.toLowerCase().includes(query)
        || facility.address?.toLowerCase().includes(query)
        || facility.location?.toLowerCase().includes(query)
        || facility.bloodGroups?.some((group: string) => group.toLowerCase().includes(query));

      const status = getFacilityStatus(facility);
      const relevantBloodGroup = bloodGroup === 'all' || facility.bloodGroups?.includes(bloodGroup);
      const relevantComponent = component === 'all' || facility.components?.includes(component);

      return matchesSearch && relevantBloodGroup && relevantComponent && status !== 'unknown';
    });
  }, [bloodGroup, component, hospitals, searchTerm]);

  const selectedFacility = filteredHospitals.find((facility) => facility.id === selectedFacilityId) ?? filteredHospitals[0] ?? null;

  useEffect(() => {
    if (!selectedFacilityId && filteredHospitals.length > 0) {
      setSelectedFacilityId(filteredHospitals[0].id);
    }
  }, [filteredHospitals, selectedFacilityId]);

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
      const { Circle, CircleMarker, MapContainer, Popup, TileLayer, ZoomControl, useMap } = mod;

      const createMarkerColor = (status: string) => {
        if (status === 'healthy') return '#16a34a';
        if (status === 'low') return '#f59e0b';
        if (status === 'critical') return '#dc2626';
        return '#64748b';
      };

      const MapFocus = ({ center }: { center: [number, number] }) => {
        const map = useMap();

        useEffect(() => {
          map.flyTo(center, 11, { duration: 1.1 });
        }, [center, map]);

        return null;
      };

      return function LeafletMap() {
        const defaultCenter: [number, number] = [39.5, -98.35];
        const center: [number, number] = selectedFacility && selectedFacility.lat && selectedFacility.lng
          ? [normalizeNumber(selectedFacility.lat), normalizeNumber(selectedFacility.lng)]
          : defaultCenter;

        return (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_320px]">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <MapPinned className="h-4 w-4 text-rose-600" />
                  Active coverage
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Verified</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" />Low stock</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" />Critical</span>
                </div>
              </div>

              <MapContainer center={center} zoom={11} scrollWheelZoom={false} zoomControl={false} className="h-[420px] w-full" style={{ zIndex: 1 }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <ZoomControl position="topright" />
                <MapFocus center={center} />

                {filteredHospitals.map((facility) => {
                  const lat = normalizeNumber(facility.lat);
                  const lng = normalizeNumber(facility.lng);
                  const status = getFacilityStatus(facility);
                  const color = createMarkerColor(status);

                  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

                  return (
                    <React.Fragment key={facility.id}>
                      <CircleMarker
                        center={[lat, lng]}
                        radius={selectedFacility?.id === facility.id ? 12 : 9}
                        pathOptions={{
                          color,
                          fillColor: color,
                          fillOpacity: selectedFacility?.id === facility.id ? 1 : 0.8,
                          weight: selectedFacility?.id === facility.id ? 3 : 2,
                        }}
                        eventHandlers={{
                          click: () => setSelectedFacilityId(facility.id),
                        }}
                      >
                        <Popup>
                          <div className="min-w-[220px] space-y-2 text-xs text-slate-600">
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-bold text-slate-900">{facility.name}</div>
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-600">
                                {status}
                              </span>
                            </div>
                            <div>{facility.address || 'Address unavailable'}</div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500">Verification</span>
                              <span className={facility.isVerified || facility.verified ? 'font-semibold text-emerald-600' : 'font-semibold text-slate-500'}>
                                {facility.isVerified || facility.verified ? 'Verified' : 'Unverified'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500">Inventory</span>
                              <span className="font-semibold text-slate-900">{facility.totalAvailableUnits ?? facility.availableUnits ?? 0} units</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500">Last update</span>
                              <span className="font-medium text-slate-700">{facility.lastInventoryUpdate || 'Within 2h'}</span>
                            </div>
                          </div>
                        </Popup>
                      </CircleMarker>

                      <Circle
                        center={[lat, lng]}
                        radius={3200}
                        pathOptions={{ color, fillColor: color, fillOpacity: 0.08, weight: 1 }}
                      />
                    </React.Fragment>
                  );
                })}

                {requests.map((request) => {
                  const lat = normalizeNumber(request.hospitalLat ?? request.lat ?? request.hospital?.lat);
                  const lng = normalizeNumber(request.hospitalLng ?? request.lng ?? request.hospital?.lng);
                  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

                  return (
                    <Circle
                      key={request.id}
                      center={[lat, lng]}
                      radius={1500}
                      pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.1, weight: 1 }}
                    />
                  );
                })}
              </MapContainer>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Coverage list</div>
                  <div className="mt-1 text-lg font-bold text-slate-900">{filteredHospitals.length} facilities</div>
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
                  {filteredHospitals.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-5 text-sm text-slate-500">
                      No facilities match the selected search or filters.
                    </div>
                  ) : (
                    filteredHospitals.map((facility) => {
                      const status = getFacilityStatus(facility);
                      const isActive = facility.id === selectedFacility?.id;

                      return (
                        <button
                          key={facility.id}
                          type="button"
                          onClick={() => setSelectedFacilityId(facility.id)}
                          className={`w-full rounded-2xl border p-3 text-left transition ${
                            isActive ? 'border-rose-200 bg-rose-50 shadow-sm' : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold text-slate-900">{facility.name}</div>
                              <div className="mt-1 text-[11px] text-slate-500">{facility.address || 'Location unavailable'}</div>
                            </div>
                            <span
                              className={`inline-flex h-2.5 w-2.5 rounded-full ${
                                status === 'healthy' ? 'bg-emerald-500' : status === 'low' ? 'bg-amber-400' : status === 'critical' ? 'bg-rose-500' : 'bg-slate-400'
                              }`}
                            />
                          </div>

                          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                            <span>Available</span>
                            <span className="font-semibold text-slate-800">{facility.totalAvailableUnits ?? facility.availableUnits ?? 0} units</span>
                          </div>
                          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                            <span>Updated</span>
                            <span className="font-medium text-slate-700">{facility.lastInventoryUpdate || 'Recently'}</span>
                          </div>
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
          <h3 className="mt-1 text-xl font-black text-slate-900">Regional blood bank network</h3>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-[220px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search facility or location"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-rose-300 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-medium text-slate-600">
            <SlidersHorizontal className="h-4 w-4 text-slate-500" />
            <select value={bloodGroup} onChange={(event) => setBloodGroup(event.target.value)} className="bg-transparent text-slate-700 focus:outline-none">
              <option value="all">All groups</option>
              <option value="O+">O+</option>
              <option value="O-">O-</option>
              <option value="A+">A+</option>
              <option value="A-">A-</option>
              <option value="B+">B+</option>
              <option value="B-">B-</option>
              <option value="AB+">AB+</option>
              <option value="AB-">AB-</option>
            </select>
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

      <MapComponent />
    </div>
  );
};
