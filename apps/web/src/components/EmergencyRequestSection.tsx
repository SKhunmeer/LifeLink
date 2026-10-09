'use client';

import React, { useState } from 'react';
import { AlertCircle, Clock, CheckCircle2, Siren, UserPlus, Phone, Building2, ShieldCheck, MapPin } from 'lucide-react';
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

export const EmergencyRequestSection: React.FC<EmergencyRequestSectionProps> = ({
  requests,
  hospitals,
  userRole,
  onRefresh,
  onCreateRequest,
  onVerifyRequest,
  onTriggerOutreach,
  onFulfillRequest,
  onCancelRequest
}) => {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);

  // Form State
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
    wardOrBed: 'Trauma Bay 1'
  });

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onCreateRequest({
        ...formData,
        requiredByTime: new Date(formData.requiredByTime).toISOString()
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
    try {
      await actionFn();
      onRefresh();
    } catch (err: any) {
      alert(`Action error: ${err.message}`);
    } finally {
      setActionInProgressId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-slate-900">Emergency Patient Requests & Hospital Matching</h2>
            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[11px] font-bold">
              {requests.length} Active Cases
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Real-time multi-hospital matching engine & consent-based donor outreach queue
          </p>
        </div>

        <button
          onClick={() => setCreateModalOpen(true)}
          className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition"
        >
          <Siren className="w-4 h-4 animate-bounce" />
          <span>Submit Emergency Request</span>
        </button>
      </div>

      {/* Requests Stream / List */}
      <div className="grid grid-cols-1 gap-4">
        {requests.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-50" />
            <div className="font-semibold text-slate-700">No active emergency blood requests</div>
            <p className="text-xs text-slate-400 mt-1">All hospital blood requests have been fulfilled or closed.</p>
          </div>
        ) : (
          requests.map((req) => {
            const isCritical = req.urgency === 'critical';
            const isUrgent = req.urgency === 'urgent';
            const isFulfilled = req.status === 'fulfilled';
            const isReserved = req.status === 'reserved';
            const isOutreach = req.status === 'donor_outreach';
            const isVerified = req.status === 'verified';
            const isProcessing = actionInProgressId === req.id;

            return (
              <div
                key={req.id}
                className={`bg-white rounded-2xl border p-5 transition-all shadow-sm ${
                  isCritical
                    ? 'border-rose-300 ring-1 ring-rose-200'
                    : isUrgent
                    ? 'border-amber-300'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  {/* Left: Case Info */}
                  <div className="flex items-start space-x-3">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg border ${
                        isCritical
                          ? 'bg-rose-50 text-rose-700 border-rose-300'
                          : isUrgent
                          ? 'bg-amber-50 text-amber-700 border-amber-300'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      {req.blood_group}
                    </div>

                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-bold text-slate-900 text-sm">{req.patient_display_name}</h3>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            isCritical
                              ? 'bg-rose-100 text-rose-800'
                              : isUrgent
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {req.urgency}
                        </span>
                        <span className="text-[11px] font-medium text-slate-400">
                          ID: <span className="font-mono">{req.id.slice(0, 8)}</span>
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                        <span className="font-medium text-slate-800">
                          {BLOOD_COMPONENT_LABELS[req.component as keyof typeof BLOOD_COMPONENT_LABELS] || req.component}
                        </span>
                        <span>•</span>
                        <span>
                          Required: <strong className="text-slate-900">{req.units_required} units</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Reserved: <strong className="text-indigo-600">{req.units_reserved || 0} units</strong>
                        </span>
                        <span>•</span>
                        <span className="flex items-center space-x-1 text-slate-500">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{req.hospitalName || 'Metro General Hospital'}</span>
                        </span>
                      </div>

                      {req.clinical_notes && (
                        <p className="mt-2 text-xs text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
                          <strong>Clinical Context:</strong> {req.clinical_notes}
                          {req.treating_doctor && <span className="ml-2 font-medium text-slate-700">({req.treating_doctor})</span>}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: Status Tracker & Workflow Actions */}
                  <div className="flex flex-col items-end space-y-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] font-semibold text-slate-500">Status:</span>
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
                          isFulfilled
                            ? 'bg-emerald-100 text-emerald-800'
                            : isReserved
                            ? 'bg-indigo-100 text-indigo-800'
                            : isOutreach
                            ? 'bg-rose-100 text-rose-800 animate-pulse'
                            : isVerified
                            ? 'bg-sky-100 text-sky-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {req.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    {/* Operational Action Buttons (Role Based) */}
                    {(userRole === 'hospital_staff' || userRole === 'admin') && !isFulfilled && (
                      <div className="flex items-center space-x-1.5 pt-1">
                        {req.status === 'submitted' && (
                          <button
                            onClick={() => handleAction(() => onVerifyRequest(req.id), req.id)}
                            disabled={isProcessing}
                            className="px-2.5 py-1 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 text-xs font-semibold transition"
                          >
                            <ShieldCheck className="w-3 h-3 inline mr-1" />
                            Verify Case
                          </button>
                        )}

                        {req.status !== 'donor_outreach' && (
                          <button
                            onClick={() => handleAction(() => onTriggerOutreach(req.id), req.id)}
                            disabled={isProcessing}
                            className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm transition"
                          >
                            <UserPlus className="w-3 h-3 inline mr-1" />
                            Launch Donor Outreach (SMS)
                          </button>
                        )}

                        <button
                          onClick={() => handleAction(() => onFulfillRequest(req.id), req.id)}
                          disabled={isProcessing}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition"
                        >
                          <CheckCircle2 className="w-3 h-3 inline mr-1" />
                          Mark Fulfilled
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

      {/* New Request Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Siren className="w-5 h-5 text-rose-600" />
                <h3 className="font-bold text-slate-900">Initiate Urgent Blood Request</h3>
              </div>
              <button onClick={() => setCreateModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Patient Name or De-identified Case ID</label>
                <input
                  type="text"
                  required
                  value={formData.patientDisplayName}
                  onChange={(e) => setFormData({ ...formData, patientDisplayName: e.target.value })}
                  className="w-full text-xs rounded-lg border border-slate-200 p-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Requested Blood Group</label>
                  <select
                    value={formData.bloodGroup}
                    onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                    className="w-full text-xs rounded-lg border border-slate-200 p-2 bg-white font-bold"
                  >
                    {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Component</label>
                  <select
                    value={formData.component}
                    onChange={(e) => setFormData({ ...formData, component: e.target.value })}
                    className="w-full text-xs rounded-lg border border-slate-200 p-2 bg-white"
                  >
                    {BLOOD_COMPONENTS.map((c) => (
                      <option key={c} value={c}>{BLOOD_COMPONENT_LABELS[c]}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Units Required</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    required
                    value={formData.unitsRequired}
                    onChange={(e) => setFormData({ ...formData, unitsRequired: parseInt(e.target.value) || 1 })}
                    className="w-full text-xs rounded-lg border border-slate-200 p-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Urgency Priority</label>
                  <select
                    value={formData.urgency}
                    onChange={(e) => setFormData({ ...formData, urgency: e.target.value })}
                    className="w-full text-xs rounded-lg border border-slate-200 p-2 bg-white font-semibold"
                  >
                    <option value="critical">CRITICAL (Immediate Trauma/OR)</option>
                    <option value="urgent">URGENT (Within 4-8 hours)</option>
                    <option value="routine">ROUTINE (Elective / Scheduled)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Receiving Hospital Facility</label>
                <select
                  value={formData.hospitalId}
                  onChange={(e) => setFormData({ ...formData, hospitalId: e.target.value })}
                  className="w-full text-xs rounded-lg border border-slate-200 p-2 bg-white"
                >
                  {hospitals.map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Treating Doctor</label>
                  <input
                    type="text"
                    value={formData.treatingDoctor}
                    onChange={(e) => setFormData({ ...formData, treatingDoctor: e.target.value })}
                    className="w-full text-xs rounded-lg border border-slate-200 p-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Ward / Bay</label>
                  <input
                    type="text"
                    value={formData.wardOrBed}
                    onChange={(e) => setFormData({ ...formData, wardOrBed: e.target.value })}
                    className="w-full text-xs rounded-lg border border-slate-200 p-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Clinical Rationale & Crossmatch Notes</label>
                <textarea
                  rows={2}
                  value={formData.clinicalNotes}
                  onChange={(e) => setFormData({ ...formData, clinicalNotes: e.target.value })}
                  className="w-full text-xs rounded-lg border border-slate-200 p-2"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm"
                >
                  {isSubmitting ? 'Evaluating Compatibility...' : 'Broadcast Emergency Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
