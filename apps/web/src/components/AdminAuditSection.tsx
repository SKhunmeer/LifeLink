'use client';

import React from 'react';
import { ShieldCheck, FileText, CheckCircle2, AlertOctagon, Activity, Server } from 'lucide-react';

interface AdminAuditSectionProps {
  auditLogs: any[];
  hospitals: any[];
  onVerifyHospital: (id: string) => Promise<void>;
  analytics: any;
}

export const AdminAuditSection: React.FC<AdminAuditSectionProps> = ({
  auditLogs,
  hospitals,
  onVerifyHospital,
  analytics
}) => {
  const summary = analytics?.summary || {};

  return (
    <div className="space-y-6">
      {/* Platform Executive KPI Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">Available Blood Stock</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{summary.totalUnitsAvailable || 0} units</div>
          <div className="text-[10px] text-emerald-600 font-medium mt-1">Across all verified facilities</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">Emergency Requests</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{summary.totalRequests || 0} cases</div>
          <div className="text-[10px] text-indigo-600 font-medium mt-1">{summary.activeUrgentRequests || 0} currently active</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">Fulfillment Rate</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">{summary.fulfillmentRate || 100}%</div>
          <div className="text-[10px] text-slate-400 font-medium mt-1">Zero preventable shortages</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">Donor Network</div>
          <div className="text-2xl font-black text-rose-600 mt-1">{summary.availableDonors || 0} / {summary.totalRegisteredDonors || 0}</div>
          <div className="text-[10px] text-slate-400 font-medium mt-1">Eligible active candidates</div>
        </div>
      </div>

      {/* Hospital Verification Management */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Hospital & Blood Bank Facility Credentials</h3>
            <p className="text-xs text-slate-500">Only authorized healthcare institutions can reserve units or initiate donor outreach</p>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {hospitals.map((h) => (
            <div key={h.id} className="py-3 flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-xs text-slate-900">{h.name}</span>
                  {h.is_verified ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      VERIFIED
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                      PENDING VERIFICATION
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  License: <span className="font-mono">{h.license_number}</span> • Emergency Hotline: {h.emergency_hotline}
                </div>
              </div>

              {!h.is_verified && (
                <button
                  onClick={() => onVerifyHospital(h.id)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition"
                >
                  Confirm Verification
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Tamper-Evident Security Audit Logs */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4 text-slate-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Tamper-Evident Healthcare Audit Logs</h3>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">Immutable Relational Trail</span>
        </div>

        <div className="max-h-80 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-600 font-semibold uppercase text-[10px]">
              <tr>
                <th className="px-4 py-2">Timestamp</th>
                <th className="px-4 py-2">Actor Role</th>
                <th className="px-4 py-2">Action</th>
                <th className="px-4 py-2">Resource</th>
                <th className="px-4 py-2">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400 font-sans">
                    No audit logs recorded yet.
                  </td>
                </tr>
              ) : (
                auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-500">{log.timestamp}</td>
                    <td className="px-4 py-2">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold uppercase text-[9px]">
                        {log.actor_role}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-bold text-slate-900">{log.action}</td>
                    <td className="px-4 py-2 text-slate-600">{log.resource_type} ({log.resource_id.slice(0, 8)})</td>
                    <td className="px-4 py-2 text-slate-400">{log.ip_address}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
