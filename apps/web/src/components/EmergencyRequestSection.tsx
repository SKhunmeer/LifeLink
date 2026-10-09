'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Building2, CheckCircle2, Clock, Search, Shield, Siren, UserPlus, X } from 'lucide-react';
import { BLOOD_GROUPS, BLOOD_COMPONENTS, BLOOD_COMPONENT_LABELS } from '@bloodlink/shared';
import { api, type GeocodedPlace, type NearbyHospital } from '../lib/api';
import type { LocationSelection } from './InteractiveMap';

interface EmergencyRequestSectionProps {
  requests: any[];
  hospitals: any[];
  requesterPhone: string;
  currentLocation: LocationSelection | null;
  onLocationChange: (location: LocationSelection | null) => void;
  userRole: string;
  onRefresh: () => void | Promise<void>;
  onCreateRequest: (data: any) => Promise<any>;
  onVerifyRequest: (id: string) => Promise<void>;
  onTriggerOutreach: (id: string) => Promise<void>;
  onFulfillRequest: (id: string) => Promise<void>;
  onCancelRequest: (id: string) => Promise<void>;
}

const urgencyConfig: Record<string, { label: string; badgeClass: string; dotClass: string }> = {
  critical: { label: 'Critical', badgeClass: 'badge-critical', dotClass: 'status-dot-critical' },
  urgent: { label: 'Urgent', badgeClass: 'badge-low', dotClass: 'status-dot-low' },
  routine: { label: 'Routine', badgeClass: 'badge-neutral', dotClass: 'status-dot-neutral' },
};

const statusBadge: Record<string, { label: string; className: string }> = {
  submitted: { label: 'Submitted', className: 'badge-neutral' },
  pending: { label: 'Pending', className: 'badge-neutral' },
  verified: { label: 'Verified', className: 'badge-adequate' },
  reserved: { label: 'Reserved', className: 'badge-adequate' },
  assigned: { label: 'Assigned', className: 'badge-adequate' },
  donor_outreach: { label: 'Donor Outreach', className: 'badge-low' },
  in_transit: { label: 'In Transit', className: 'badge-low' },
  fulfilled: { label: 'Fulfilled', className: 'badge-adequate' },
  cancelled: { label: 'Cancelled', className: 'badge-neutral' },
};

const toLocalDateTimeInput = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

export const EmergencyRequestSection: React.FC<EmergencyRequestSectionProps> = ({
  requests,
  hospitals,
  requesterPhone,
  currentLocation,
  onLocationChange,
  userRole,
  onRefresh,
  onCreateRequest,
  onVerifyRequest,
  onTriggerOutreach,
  onFulfillRequest,
  onCancelRequest,
}) => {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);
  const [filterUrgency, setFilterUrgency] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmAction, setConfirmAction] = useState<{ id: string; type: string; label: string } | null>(null);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [submitWarning, setSubmitWarning] = useState('');
  const [nearbyRequestHospitals, setNearbyRequestHospitals] = useState<NearbyHospital[]>([]);
  const [nearbyPickerHospitals, setNearbyPickerHospitals] = useState<NearbyHospital[]>([]);
  const [nearbyPickerLoading, setNearbyPickerLoading] = useState(false);
  const [nearbyPickerError, setNearbyPickerError] = useState('');
  const [manualPlaceQuery, setManualPlaceQuery] = useState('Medchal, Telangana, India');
  const [manualPlaceResults, setManualPlaceResults] = useState<GeocodedPlace[]>([]);
  const [manualPlaceLoading, setManualPlaceLoading] = useState(false);
  const [manualPlaceError, setManualPlaceError] = useState('');
  const [nearbyLookupLoading, setNearbyLookupLoading] = useState(false);
  const [matchedBloodBanks, setMatchedBloodBanks] = useState<any[]>([]);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [locationError, setLocationError] = useState('');
  const submissionLock = useRef(false);
  const nearbyLookupId = useRef(0);
  const nearbyPickerRequestId = useRef(0);

  const [formData, setFormData] = useState({
    patientDisplayName: '',
    bloodGroup: '',
    component: '',
    unitsRequired: 1,
    urgency: '',
    hospitalId: '',
    requiredByTime: toLocalDateTimeInput(new Date(Date.now() + 3 * 3600 * 1000)),
    clinicalNotes: '',
    treatingDoctor: '',
    wardOrBed: '',
  });

  useEffect(() => {
    if (currentLocation) setLocationStatus('idle');
  }, [currentLocation]);

  useEffect(() => {
    if (formData.hospitalId.startsWith('live:')) {
      setFormData((form) => ({ ...form, hospitalId: '' }));
    }
  }, [currentLocation?.lat, currentLocation?.lng, currentLocation?.source]);

  useEffect(() => {
    if (!createModalOpen || !currentLocation) {
      setNearbyPickerHospitals([]);
      setNearbyPickerLoading(false);
      return;
    }

    const requestId = ++nearbyPickerRequestId.current;
    setNearbyPickerLoading(true);
    setNearbyPickerError('');
    api.getNearbyHospitals(currentLocation.lat, currentLocation.lng, 10000)
      .then(({ hospitals: nearby }) => {
        if (requestId === nearbyPickerRequestId.current) setNearbyPickerHospitals(nearby);
      })
      .catch((error: Error) => {
        if (requestId === nearbyPickerRequestId.current) {
          setNearbyPickerHospitals([]);
          setNearbyPickerError(error.message || 'Nearby hospitals could not be loaded. Please retry.');
        }
      })
      .finally(() => {
        if (requestId === nearbyPickerRequestId.current) setNearbyPickerLoading(false);
      });

    return () => {
      nearbyPickerRequestId.current += 1;
    };
  }, [createModalOpen, currentLocation]);

  // Filter requests
  const filteredRequests = requests.filter((req) => {
    if (filterUrgency !== 'all' && req.urgency !== filterUrgency) return false;
    if (filterStatus !== 'all' && req.status !== filterStatus) return false;
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      const haystack = [req.patient_display_name, req.blood_group, req.hospitalName, req.id].join(' ').toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  // Sort: critical first, then urgent, then routine. Within same urgency, newest first.
  const sortedRequests = [...filteredRequests].sort((a, b) => {
    const urgencyOrder: Record<string, number> = { critical: 0, urgent: 1, routine: 2 };
    const uA = urgencyOrder[a.urgency] ?? 2;
    const uB = urgencyOrder[b.urgency] ?? 2;
    if (uA !== uB) return uA - uB;
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  });

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submissionLock.current) return;
    submissionLock.current = true;
    setIsSubmitting(true);
    setSubmitError('');
    setSubmitSuccess('');
    setSubmitWarning('');
    try {
      const isExternalHospital = formData.hospitalId.startsWith('live:');
      const { hospitalId, ...requestFields } = formData;
      const requestHospitalSelection = isExternalHospital
        ? { externalHospitalId: hospitalId.slice('live:'.length) }
        : { hospitalId };
      const result = await onCreateRequest({
        ...requestFields,
        ...requestHospitalSelection,
        requiredByTime: new Date(formData.requiredByTime).toISOString(),
        requesterLat: currentLocation?.lat,
        requesterLng: currentLocation?.lng,
        requesterLocationSource: currentLocation?.source,
      });
      if (!result?.success || !result?.requestId) {
        throw new Error('The server did not confirm that the request was saved.');
      }
      setNearbyRequestHospitals([]);
      setMatchedBloodBanks(result.facilityMatches || []);
      setSubmitWarning([
        ...(result.warnings || []),
        ...(currentLocation ? [] : ['No location was shared; nearby facilities are ranked from the selected hospital.']),
        ...(currentLocation?.source === 'manual' ? ['The selected area is approximate and is not device GPS.'] : []),
      ].join(' '));
      const lookupId = ++nearbyLookupId.current;
      setNearbyLookupLoading(Boolean(currentLocation));
      if (currentLocation) {
        api.getNearbyHospitals(currentLocation.lat, currentLocation.lng, 5000)
          .then(({ hospitals: nearby }) => {
            if (lookupId === nearbyLookupId.current) setNearbyRequestHospitals(nearby);
          })
          .catch((error: Error) => {
            if (lookupId === nearbyLookupId.current) {
              setSubmitWarning((warning) => [warning, error.message || 'Nearby hospital search failed.'].filter(Boolean).join(' '));
            }
          })
          .finally(() => {
            if (lookupId === nearbyLookupId.current) setNearbyLookupLoading(false);
          });
      }
      setCreateModalOpen(false);
      setSubmitSuccess(`Request submitted successfully. Reference: ${result.requestId}`);
      await onRefresh();
    } catch (err: unknown) {
      setSubmitError(`Submission failed: ${err instanceof Error ? err.message : 'Unexpected server error.'}`);
    } finally {
      submissionLock.current = false;
      setIsSubmitting(false);
    }
  };

  const detectLocationForRequest = () => {
    if (!window.isSecureContext || !navigator.geolocation) {
      setLocationStatus('error');
      setLocationError('Location requires HTTPS (or localhost during development) and a browser with Geolocation support.');
      return;
    }
    onLocationChange(null);
    setLocationStatus('loading');
    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        onLocationChange({
          lat: coords.latitude,
          lng: coords.longitude,
          accuracy: coords.accuracy,
          source: 'device',
        });
        setLocationStatus('idle');
      },
      (error) => {
        setLocationStatus('error');
        setLocationError(error.code === error.PERMISSION_DENIED
          ? 'Location permission was denied. Enable it for this site in browser settings and retry.'
          : error.code === error.TIMEOUT
            ? 'Location detection timed out. Please retry.'
            : 'Your device could not determine a location. Check location services and retry.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const searchManualPlaceForRequest = async () => {
    setManualPlaceLoading(true);
    setManualPlaceError('');
    setManualPlaceResults([]);
    try {
      const { places } = await api.searchPlaces(manualPlaceQuery.trim());
      setManualPlaceResults(places);
      if (places.length === 0) setManualPlaceError('No matching place found. Try a more specific locality or PIN code.');
    } catch (error) {
      setManualPlaceError(error instanceof Error ? error.message : 'Live place search failed. Please retry.');
    } finally {
      setManualPlaceLoading(false);
    }
  };

  const selectManualPlaceForRequest = (place: GeocodedPlace) => {
    onLocationChange({
      lat: place.lat,
      lng: place.lng,
      accuracy: 0,
      source: 'manual',
      label: place.name,
    });
    setManualPlaceResults([]);
    setManualPlaceError('');
  };

  const selectedLiveHospital = nearbyPickerHospitals.find((facility) => `live:${facility.id}` === formData.hospitalId);
  const selectableRegisteredHospitals = hospitals.filter((hospital) => hospital.source !== 'openstreetmap');

  const handleAction = async (actionFn: () => Promise<void>, reqId: string) => {
    setActionInProgressId(reqId);
    setConfirmAction(null);
    try {
      await actionFn();
      onRefresh();
    } catch (err: any) {
      alert(`Action error: ${err.message}`);
    } finally {
      setActionInProgressId(null);
    }
  };

  const requestConfirmation = (id: string, type: string, label: string) => {
    setConfirmAction({ id, type, label });
  };

  const activeCount = requests.filter((r) => !['fulfilled', 'cancelled'].includes(r.status)).length;
  const criticalCount = requests.filter((r) => r.urgency === 'critical' && !['fulfilled', 'cancelled'].includes(r.status)).length;

  return (
    <div className="space-y-5">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="section-title">Emergency Blood Requests</h2>
          <p className="section-subtitle">
            {activeCount} active request{activeCount !== 1 ? 's' : ''}
            {criticalCount > 0 && (
              <span style={{ color: 'var(--status-critical)' }}> · {criticalCount} critical</span>
            )}
          </p>
        </div>
        {submitSuccess && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800" role="status">{submitSuccess}</div>}
        {submitWarning && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">{submitWarning}</div>}
        {submitSuccess && nearbyLookupLoading && (
          <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800" role="status">Searching OpenStreetMap for nearby hospitals…</div>
        )}
        {submitSuccess && (nearbyRequestHospitals.length > 0 || matchedBloodBanks.length > 0) && (
          <div className="grid gap-4 lg:grid-cols-2">
            {matchedBloodBanks.length > 0 && (
              <section className="rounded-xl border border-emerald-200 bg-white p-4">
                <h3 className="text-sm font-bold text-slate-900">Registered blood-bank matches</h3>
                <p className="mt-1 text-xs text-slate-500">Inventory counts come from this system’s verified hospital records.</p>
                <div className="mt-3 space-y-2">
                  {matchedBloodBanks.slice(0, 5).map((facility) => (
                    <div key={facility.hospitalId} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-3 text-xs">
                      <div>
                        <div className="font-semibold text-slate-900">{facility.hospitalName}</div>
                        <div className="text-slate-500">
                          {facility.distanceKm.toFixed(1)} km from {
                            currentLocation?.source === 'manual'
                              ? 'the selected area'
                              : currentLocation
                                ? 'your device'
                                : 'receiving hospital'
                          } · {facility.address}
                        </div>
                      </div>
                      <div className="whitespace-nowrap text-right font-semibold text-emerald-800">
                        {facility.availableCompatibleUnits} compatible units
                        <a
                          className="mt-1 block text-blue-700"
                          href={currentLocation
                            ? `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${encodeURIComponent(`${currentLocation.lat},${currentLocation.lng};${facility.lat},${facility.lng}`)}`
                            : `https://www.google.com/maps/dir/?api=1&destination=${facility.lat},${facility.lng}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Directions
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {nearbyRequestHospitals.length > 0 && (
              <section className="rounded-xl border border-violet-200 bg-white p-4">
                <h3 className="text-sm font-bold text-slate-900">Other nearby hospitals</h3>
                <p className="mt-1 text-xs text-slate-500">OpenStreetMap results; blood-bank services and stock are unknown unless confirmed by the facility.</p>
                <div className="mt-3 space-y-2">
                  {nearbyRequestHospitals.slice(0, 5).map((facility) => (
                    <div key={facility.id} className="rounded-lg bg-slate-50 p-3 text-xs">
                      <div className="font-semibold text-slate-900">{facility.name}</div>
                      <div className="mt-1 text-slate-500">{facility.distanceKm.toFixed(1)} km · {facility.address || 'Address unavailable'} · availability unknown</div>
                      <div className="mt-1 flex gap-3">
                        {facility.phone && <a className="text-blue-700" href={`tel:${facility.phone}`}>{facility.phone}</a>}
                        <a className="text-blue-700" href={facility.directionsUrl} target="_blank" rel="noreferrer">Directions</a>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={() => setCreateModalOpen(true)}
          className="btn btn-primary"
        >
          <Siren className="h-4 w-4" /> Submit Emergency Request
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1" style={{ minWidth: 200, maxWidth: 320 }}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search patient, blood group..."
            className="form-input pl-9"
          />
        </div>
        <select value={filterUrgency} onChange={(e) => setFilterUrgency(e.target.value)} className="form-select" style={{ width: 'auto', minWidth: 120 }}>
          <option value="all">All urgency</option>
          <option value="critical">Critical</option>
          <option value="urgent">Urgent</option>
          <option value="routine">Routine</option>
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="form-select" style={{ width: 'auto', minWidth: 130 }}>
          <option value="all">All statuses</option>
          <option value="submitted">Submitted</option>
          <option value="verified">Verified</option>
          <option value="reserved">Reserved</option>
          <option value="donor_outreach">Donor Outreach</option>
          <option value="fulfilled">Fulfilled</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Requests list */}
      <div className="space-y-3">
        {sortedRequests.length === 0 ? (
          <div className="card empty-state">
            <CheckCircle2 className="empty-state-icon" style={{ color: 'var(--status-adequate)' }} />
            <div className="empty-state-title">No matching requests</div>
            <div className="empty-state-description">
              {requests.length === 0
                ? 'All blood requests have been fulfilled or closed.'
                : 'Try adjusting your filters.'}
            </div>
          </div>
        ) : (
          sortedRequests.map((req) => {
            const isCritical = req.urgency === 'critical';
            const isUrgent = req.urgency === 'urgent';
            const isFulfilled = req.status === 'fulfilled';
            const isCancelled = req.status === 'cancelled';
            const isProcessing = actionInProgressId === req.id;
            const urg = urgencyConfig[req.urgency] || urgencyConfig.routine;
            const stBadge = statusBadge[req.status] || statusBadge.submitted;
            const componentLabel = BLOOD_COMPONENT_LABELS[req.component as keyof typeof BLOOD_COMPONENT_LABELS] || req.component;

            return (
              <div
                key={req.id}
                className="card p-4"
                style={{
                  borderLeftWidth: 3,
                  borderLeftColor: isCritical ? 'var(--status-critical)' : isUrgent ? 'var(--status-low)' : 'var(--border-default)',
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  {/* Left */}
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div
                      className="flex items-center justify-center flex-shrink-0 rounded-lg font-bold text-base"
                      style={{
                        width: 44,
                        height: 44,
                        background: isCritical ? 'var(--status-critical-bg)' : isUrgent ? 'var(--status-low-bg)' : 'var(--bg-surface-secondary)',
                        color: isCritical ? 'var(--status-critical)' : isUrgent ? 'var(--status-low)' : 'var(--text-primary)',
                        border: `1px solid ${isCritical ? 'var(--status-critical-border)' : isUrgent ? 'var(--status-low-border)' : 'var(--border-default)'}`,
                      }}
                    >
                      {req.blood_group}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-900">{req.patient_display_name}</h3>
                        <span className={`badge ${urg.badgeClass}`} style={{ fontSize: 10 }}>
                          <span className={`status-dot ${urg.dotClass} mr-1`} style={{ width: 5, height: 5 }} />
                          {urg.label}
                        </span>
                        <span className="text-[11px] text-gray-400 font-mono">
                          {req.id?.slice(0, 8)}
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
                        <span className="font-medium text-gray-700">{componentLabel}</span>
                        <span>Req: <strong className="text-gray-900">{req.units_required} units</strong></span>
                        <span>Reserved: <strong style={{ color: 'var(--accent-secondary)' }}>{req.units_reserved || 0}</strong></span>
                        {req.hospitalName && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3 text-gray-400" />
                            {req.hospitalName}
                            {req.hospitalSource === 'openstreetmap' && (
                              <span className="ml-1 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800">
                                OpenStreetMap · unverified
                              </span>
                            )}
                          </span>
                        )}
                      </div>

                      {req.clinical_notes && (
                        <div
                          className="mt-2 text-xs text-gray-600 px-2.5 py-1.5 rounded-md"
                          style={{ background: 'var(--bg-surface-secondary)', border: '1px solid var(--border-default)' }}
                        >
                          <strong>Clinical:</strong> {req.clinical_notes}
                          {req.treating_doctor && <span className="ml-1 text-gray-800">({req.treating_doctor})</span>}
                        </div>
                      )}

                      {req.required_by_time && (
                        <div className="mt-1.5 flex items-center gap-1 text-xs text-gray-400">
                          <Clock className="h-3 w-3" />
                          Required by: {new Date(req.required_by_time).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: status + actions */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <span className={`badge ${stBadge.className}`}>{stBadge.label}</span>

                    {(userRole === 'hospital_staff' || userRole === 'admin') && !isFulfilled && !isCancelled && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {req.status === 'submitted' && (
                          <button
                            type="button"
                            onClick={() => handleAction(() => onVerifyRequest(req.id), req.id)}
                            disabled={isProcessing}
                            className="btn btn-secondary btn-sm"
                          >
                            <Shield className="h-3 w-3" /> Verify
                          </button>
                        )}

                        {req.status !== 'donor_outreach' && (
                          <button
                            type="button"
                            onClick={() => requestConfirmation(req.id, 'outreach', 'Launch Donor Outreach')}
                            disabled={isProcessing}
                            className="btn btn-primary btn-sm"
                          >
                            <UserPlus className="h-3 w-3" /> Outreach
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => requestConfirmation(req.id, 'fulfill', 'Mark as Fulfilled')}
                          disabled={isProcessing}
                          className="btn btn-sm"
                          style={{ background: 'var(--status-adequate)', color: '#fff', borderColor: 'var(--status-adequate)' }}
                        >
                          <CheckCircle2 className="h-3 w-3" /> Fulfill
                        </button>

                        <button
                          type="button"
                          onClick={() => requestConfirmation(req.id, 'cancel', 'Cancel Request')}
                          disabled={isProcessing}
                          className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--text-tertiary)' }}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Confirmation Dialog */}
      {confirmAction && (
        <div className="modal-overlay" onClick={() => setConfirmAction(null)}>
          <div className="modal-content" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg" style={{ background: 'var(--status-low-bg)' }}>
                  <AlertTriangle className="h-5 w-5" style={{ color: 'var(--status-low)' }} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Confirm Action</h3>
                  <p className="text-xs text-gray-500">{confirmAction.label}</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Are you sure you want to proceed? This action will update the request status and notify relevant parties.
              </p>
              <div className="flex items-center justify-end gap-2">
                <button type="button" onClick={() => setConfirmAction(null)} className="btn btn-secondary">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const { id, type } = confirmAction;
                    if (type === 'outreach') handleAction(() => onTriggerOutreach(id), id);
                    else if (type === 'fulfill') handleAction(() => onFulfillRequest(id), id);
                    else if (type === 'cancel') handleAction(() => onCancelRequest(id), id);
                  }}
                  className={confirmAction.type === 'cancel' ? 'btn btn-danger' : 'btn btn-primary'}
                >
                  {confirmAction.label}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Request Modal */}
      {createModalOpen && (
        <div className="modal-overlay" onClick={() => setCreateModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-default)' }}>
              <div className="flex items-center gap-2">
                <Siren className="h-4 w-4" style={{ color: 'var(--accent-primary)' }} />
                <h3 className="text-sm font-bold text-gray-900">Submit Emergency Blood Request</h3>
              </div>
              <button type="button" onClick={() => setCreateModalOpen(false)} className="btn-ghost" style={{ width: 28, height: 28, padding: 0, borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X className="h-4 w-4 text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-5 space-y-4">
              <div>
                <label className="form-label">Patient Name or Case ID</label>
                <input type="text" required value={formData.patientDisplayName} onChange={(e) => setFormData({ ...formData, patientDisplayName: e.target.value })} className="form-input" />
              </div>

              <div>
                <label className="form-label">Contact phone</label>
                <input
                  type="tel"
                  required
                  minLength={10}
                  maxLength={20}
                  pattern="[+0-9() .-]{10,20}"
                  readOnly
                  value={requesterPhone}
                  placeholder="Add a valid phone number to your account"
                  className="form-input"
                />
                <p className="mt-1 text-xs text-slate-500">This verified account contact will be used for request follow-up.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Blood Group</label>
                  <select required value={formData.bloodGroup} onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })} className="form-select">
                    <option value="" disabled>Select blood group</option>
                    {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Component</label>
                  <select required value={formData.component} onChange={(e) => setFormData({ ...formData, component: e.target.value })} className="form-select">
                    <option value="" disabled>Select component</option>
                    {BLOOD_COMPONENTS.map((c) => <option key={c} value={c}>{BLOOD_COMPONENT_LABELS[c]}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Units Required</label>
                  <input type="number" min="1" max="10" required value={formData.unitsRequired} onChange={(e) => setFormData({ ...formData, unitsRequired: parseInt(e.target.value) || 1 })} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Urgency</label>
                  <select required value={formData.urgency} onChange={(e) => setFormData({ ...formData, urgency: e.target.value })} className="form-select">
                    <option value="" disabled>Select urgency</option>
                    <option value="critical">Critical (Immediate)</option>
                    <option value="urgent">Urgent (4–8 hours)</option>
                    <option value="routine">Routine (Scheduled)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">Receiving Hospital</label>
                <select
                  required
                  value={formData.hospitalId}
                  onChange={(event) => setFormData({ ...formData, hospitalId: event.target.value })}
                  className="form-select"
                >
                  <option value="">Select receiving hospital</option>
                  {nearbyPickerHospitals.length > 0 && (
                    <optgroup label="Live nearby hospitals - OpenStreetMap, unverified">
                      {nearbyPickerHospitals.map((facility) => (
                        <option key={facility.id} value={`live:${facility.id}`}>
                          {facility.name} — {facility.distanceKm.toFixed(1)} km (availability unknown)
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {selectableRegisteredHospitals.length > 0 && (
                    <optgroup label="Registered BloodLink hospitals">
                      {selectableRegisteredHospitals.map((hospital) => (
                        <option key={hospital.id} value={hospital.id}>{hospital.name}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
                {nearbyPickerLoading && (
                  <p className="mt-1 text-xs text-violet-700" role="status">Finding live hospitals near the selected location…</p>
                )}
                {nearbyPickerError && <p className="mt-1 text-xs text-rose-700" role="alert">{nearbyPickerError}</p>}
                {currentLocation && (
                  <p className="mt-1 text-xs text-slate-500">
                    {currentLocation.source === 'manual'
                      ? `Nearby results use the approximate selected area: ${currentLocation.label}.`
                      : 'Nearby results use your device location.'}
                    {' '}OpenStreetMap listings are not BloodLink-verified and do not confirm blood-stock availability.
                  </p>
                )}
                {selectedLiveHospital && (
                  <div className="mt-2 rounded-lg border border-violet-200 bg-violet-50 p-3 text-xs">
                    <div className="font-semibold text-slate-900">{selectedLiveHospital.name} · OpenStreetMap listing</div>
                    <div className="mt-1 text-slate-600">
                      {selectedLiveHospital.distanceKm.toFixed(1)} km away · {selectedLiveHospital.address || 'Address unavailable'} · Blood-bank service and stock unverified
                    </div>
                    <div className="mt-2 flex gap-3">
                      {selectedLiveHospital.phone && (
                        <a className="font-semibold text-blue-700" href={`tel:${selectedLiveHospital.phone}`}>{selectedLiveHospital.phone}</a>
                      )}
                      <a className="font-semibold text-blue-700" href={selectedLiveHospital.directionsUrl} target="_blank" rel="noreferrer">Directions</a>
                    </div>
                  </div>
                )}
                {!currentLocation && (
                  <div className="mt-2 space-y-2">
                    <p className="text-xs text-slate-600">Share your current location to list real nearby receiving hospitals.</p>
                    <div className="flex gap-2">
                      <input
                        aria-label="Search a place for nearby hospitals"
                        value={manualPlaceQuery}
                        onChange={(event) => setManualPlaceQuery(event.target.value)}
                        minLength={3}
                        maxLength={200}
                        required
                        className="form-input min-w-0 flex-1"
                      />
                      <button type="button" onClick={searchManualPlaceForRequest} disabled={manualPlaceLoading} className="btn btn-secondary whitespace-nowrap">
                        {manualPlaceLoading ? 'Searching…' : 'Search area'}
                      </button>
                    </div>
                    {manualPlaceError && <p className="text-xs text-rose-700" role="alert">{manualPlaceError}</p>}
                    {manualPlaceResults.map((place) => (
                      <button
                        key={place.id}
                        type="button"
                        onClick={() => selectManualPlaceForRequest(place)}
                        className="block w-full rounded-lg border border-slate-200 bg-white p-2 text-left text-xs hover:border-blue-300"
                      >
                        {place.name} <span className="text-slate-500">· approximate area, not GPS</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="form-label">Required by</label>
                <input
                  type="datetime-local"
                  required
                  value={formData.requiredByTime}
                  onChange={(e) => setFormData({ ...formData, requiredByTime: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-slate-600">
                    {currentLocation
                      ? currentLocation.source === 'manual'
                        ? `Approximate selected area (${currentLocation.label}) will be used to rank nearby results; this is not device GPS.`
                        : 'Your device location will rank registered blood-bank inventory and be shared with OpenStreetMap to find nearby hospitals.'
                      : 'Optional: share your location to rank registered blood-bank inventory and find nearby hospitals via OpenStreetMap.'}
                  </div>
                  <button type="button" onClick={detectLocationForRequest} disabled={locationStatus === 'loading'} className="btn btn-secondary whitespace-nowrap">
                    {locationStatus === 'loading' ? 'Locating…' : currentLocation ? 'Update location' : 'Use current location'}
                  </button>
                </div>
                {locationError && <p className="mt-2 text-xs text-rose-700" role="alert">{locationError}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Treating Doctor</label>
                  <input type="text" value={formData.treatingDoctor} onChange={(e) => setFormData({ ...formData, treatingDoctor: e.target.value })} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Ward / Bay</label>
                  <input type="text" value={formData.wardOrBed} onChange={(e) => setFormData({ ...formData, wardOrBed: e.target.value })} className="form-input" />
                </div>
              </div>

              <div>
                <label className="form-label">Clinical Notes</label>
                <textarea rows={2} value={formData.clinicalNotes} onChange={(e) => setFormData({ ...formData, clinicalNotes: e.target.value })} className="form-input" style={{ resize: 'vertical' }} />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--border-default)' }}>
                {submitError && <p className="mr-auto self-center text-xs text-rose-700" role="alert">{submitError}</p>}
                <button type="button" onClick={() => setCreateModalOpen(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" disabled={isSubmitting || !formData.hospitalId} className="btn btn-primary">
                  {isSubmitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
