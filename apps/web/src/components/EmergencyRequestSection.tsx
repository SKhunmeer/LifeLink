'use client';

import React, { useState } from 'react';
import { AlertTriangle, Building2, CheckCircle2, Clock, Search, Shield, Siren, UserPlus, X } from 'lucide-react';
import { BLOOD_GROUPS, BLOOD_COMPONENTS, BLOOD_COMPONENT_LABELS } from '@bloodlink/shared';

interface EmergencyRequestSectionProps {
  requests: any[];
  hospitals: any[];
  userRole: string;
  onRefresh: () => void;
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

export const EmergencyRequestSection: React.FC<EmergencyRequestSectionProps> = ({
  requests,
  hospitals,
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

  const [formData, setFormData] = useState({
    patientDisplayName: 'Emergency Trauma Patient',
    bloodGroup: 'O-',
    component: 'packed_red_blood_cells',
    unitsRequired: 2,
    urgency: 'critical',
    hospitalId: hospitals[0]?.id || '',
    requiredByTime: new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 16),
    clinicalNotes: 'Acute hemorrhage; rapid transfusion protocol activated.',
    treatingDoctor: 'Dr. Vance (Chief of Surgery)',
    wardOrBed: 'Trauma Bay 1',
  });

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
    setIsSubmitting(true);
    try {
      await onCreateRequest({
        ...formData,
        requiredByTime: new Date(formData.requiredByTime).toISOString(),
      });
      setCreateModalOpen(false);
      onRefresh();
    } catch (err: any) {
      alert(`Submission failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

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
          <div className="modal-content" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Blood Group</label>
                  <select value={formData.bloodGroup} onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })} className="form-select">
                    {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Component</label>
                  <select value={formData.component} onChange={(e) => setFormData({ ...formData, component: e.target.value })} className="form-select">
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
                  <select value={formData.urgency} onChange={(e) => setFormData({ ...formData, urgency: e.target.value })} className="form-select">
                    <option value="critical">Critical (Immediate)</option>
                    <option value="urgent">Urgent (4–8 hours)</option>
                    <option value="routine">Routine (Scheduled)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">Receiving Hospital</label>
                <select value={formData.hospitalId} onChange={(e) => setFormData({ ...formData, hospitalId: e.target.value })} className="form-select">
                  {hospitals.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
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
                <button type="button" onClick={() => setCreateModalOpen(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="btn btn-primary">
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
