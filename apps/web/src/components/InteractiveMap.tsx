'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

interface InteractiveMapProps {
  hospitals: any[];
  requests: any[];
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({ hospitals, requests }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-full h-80 bg-slate-100 rounded-2xl flex items-center justify-center text-xs text-slate-400">
        Loading interactive healthcare geographical grid...
      </div>
    );
  }

  // Dynamic Leaflet render
  const MapComponent = dynamic(
    () =>
      import('react-leaflet').then((mod) => {
        const { MapContainer, TileLayer, Marker, Popup, Circle } = mod;
        const L = require('leaflet');

        // Fix leaflet icon paths in Next.js
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });

        return function LeafletMap() {
          const defaultCenter: [number, number] = [37.7749, -122.4194];

          return (
            <MapContainer
              center={defaultCenter}
              zoom={12}
              scrollWheelZoom={false}
              className="w-full h-96 rounded-2xl z-10 border border-slate-200"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Hospital Markers */}
              {hospitals.map((h) => (
                <Marker key={h.id} position={[h.lat, h.lng]}>
                  <Popup>
                    <div className="p-1 space-y-1 text-xs">
                      <div className="font-bold text-slate-900">{h.name}</div>
                      <div className="text-slate-500">{h.address}</div>
                      <div className="text-rose-600 font-bold">Hotline: {h.emergency_hotline}</div>
                      <div className="text-emerald-700 font-semibold">Available Units: {h.totalAvailableUnits || 'Ready'}</div>
                    </div>
                  </Popup>
                  {/* Coverage radius circle */}
                  <Circle
                    center={[h.lat, h.lng]}
                    radius={3000}
                    pathOptions={{ color: '#e11d48', fillColor: '#e11d48', fillOpacity: 0.08 }}
                  />
                </Marker>
              ))}

              {/* Request Markers */}
              {requests.map((r) => {
                if (!r.hospitalLat) return null;
                return (
                  <Circle
                    key={r.id}
                    center={[r.hospitalLat, r.hospitalLng]}
                    radius={1500}
                    pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.15 }}
                  />
                );
              })}
            </MapContainer>
          );
        };
      }),
    { ssr: false }
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">Regional Blood Banks & Trauma Dispatch Map</h3>
        <span className="text-xs text-slate-500">Leaflet & OpenStreetMap Live Coverage</span>
      </div>
      <MapComponent />
    </div>
  );
};
