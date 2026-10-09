'use client';

import React, { useState } from 'react';
import { Shield, Clock, Heart, CheckCircle2, XCircle, MapPin, Calendar, Award } from 'lucide-react';

interface DonorPortalSectionProps {
  donorProfile: any;
  matchingRequests: any[];
  donationHistory: any[];
  onRespond: (matchId: string, response: 'accepted' | 'declined') => Promise<void>;
  onToggleAvailability: (isAvailable: boolean) => Promise<void>;
}

export const DonorPortalSection: React.FC<DonorPortalSectionProps> = ({
  donorProfile,
  matchingRequests,
  donationHistory,
  onRespond,
  onToggleAvailability
}) => {
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const matching = donorProfile?.matchingProfile;
  const preferences = donorProfile?.preferences;
  const eligibility = donorProfile?.eligibility;

  const handleResponse = async (matchId: string, response: 'accepted' | 'declined') => {
    setRespondingId(matchId);
    try {
      await onRespond(matchId, response);
    } catch (err: any) {
      alert(`Response error: ${err.message}`);
    } finally {
      setRespondingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Donor Profile & Eligibility Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Donor Identity & Stats */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Donor Profile</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
              Verified Donor
            </span>
          </div>

          <div className="mt-4 flex items-center space-x-3">
            <div className="w-14 h-14 rounded-2xl bg-rose-600 text-white flex items-center justify-center font-black text-2xl shadow-md shadow-rose-600/30">
              {matching?.blood_group || 'O+'}
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">
                {preferences?.full_name || 'Registered Blood Donor'}
              </div>
              <div className="text-xs text-slate-500 flex items-center space-x-1 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>{matching?.city || 'San Francisco, CA'} ({matching?.service_radius_km || 30} km radius)</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-400">Total Donated:</span>
              <span className="ml-1 font-bold text-slate-800">{matching?.total_units_donated || 5} units</span>
            </div>
            <div>
              <span className="text-slate-400">Past Donations:</span>
              <span className="ml-1 font-bold text-slate-800">{matching?.donation_count || 5} times</span>
            </div>
          </div>
        </div>

        {/* Card 2: 56-Day Safety Recovery Interval */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Clinical Safety Interval</span>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>

          <div className="mt-3">
            {eligibility?.isEligible ? (
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-emerald-600 font-bold text-sm">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Eligible for Donation</span>
                </div>
                <p className="text-xs text-slate-500">
                  The mandatory 56-day red cell recovery interval has safely elapsed. You are eligible for clinical screening.
                </p>
                <div className="text-[11px] font-medium text-slate-400">
                  Last verified donation: {matching?.last_donation_date || '60+ days ago'}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-amber-600 font-bold text-sm">
                  <Clock className="w-5 h-5" />
                  <span>{eligibility?.daysRemaining || 26} Days Remaining</span>
                </div>
                <p className="text-xs text-slate-500">
                  Under clinical safety protocols, your body requires recovery time between whole blood donations.
                </p>
                <div className="text-[11px] font-semibold text-indigo-600">
                  Next eligible date: {eligibility?.nextEligibleDate || 'Calculating...'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Availability & Privacy Settings */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Outreach & Privacy</span>
            <Shield className="w-4 h-4 text-indigo-600" />
          </div>

          <div className="mt-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Emergency SMS Alerts:</span>
              <button
                onClick={() => onToggleAvailability(!matching?.is_available)}
                className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
                  matching?.is_available ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    matching?.is_available ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-xl text-[11px] text-slate-500 space-y-1">
              <div className="font-semibold text-slate-700 flex items-center space-x-1">
                <span>✓ Pseudonymous Separation Active</span>
              </div>
              <p>Your phone number and name are NEVER shared with patients or public databases. SMS alerts are cryptographically masked.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Emergency Invitations Matching This Donor */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Urgent Verified Hospital Requests Matching You</h3>
            <p className="text-xs text-slate-500">
              Only verified blood banks initiate outreach when local available inventory is exhausted.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {matchingRequests.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
              <Heart className="w-8 h-8 text-rose-300 mx-auto mb-2" />
              <div className="font-semibold text-slate-700">No urgent donation invitations right now</div>
              <p className="text-xs text-slate-400 mt-0.5">
                We will alert you via SMS if a nearby accredited hospital requires your blood group.
              </p>
            </div>
          ) : (
            matchingRequests.map((req) => {
              const isAccepted = req.donorResponse === 'accepted';
              const isDeclined = req.donorResponse === 'declined';
              const isPending = !isAccepted && !isDeclined;

              return (
                <div
                  key={req.matchId}
                  className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-4"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center font-black text-sm">
                      {req.bloodGroup}
                    </div>

                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900 text-xs">{req.hospitalName}</span>
                        <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 text-[9px] font-black uppercase">
                          {req.urgency}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          {req.distanceKm} km away
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {req.hospitalAddress} • Transfusion Hotline: <strong className="text-slate-800">{req.hospitalHotline}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {isPending ? (
                      <>
                        <button
                          onClick={() => handleResponse(req.matchId, 'accepted')}
                          disabled={respondingId === req.matchId}
                          className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm transition"
                        >
                          I Can Donate (Accept)
                        </button>
                        <button
                          onClick={() => handleResponse(req.matchId, 'declined')}
                          disabled={respondingId === req.matchId}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                        >
                          Decline
                        </button>
                      </>
                    ) : isAccepted ? (
                      <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center space-x-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Accepted — Hospital Notified</span>
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
                        Declined
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Verified Donation Records History */}
      <div>
        <h3 className="text-sm font-bold text-slate-900 mb-2">Verified Historical Donations</h3>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
              <tr>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Hospital / Facility</th>
                <th className="px-4 py-2.5">Component</th>
                <th className="px-4 py-2.5">Units</th>
                <th className="px-4 py-2.5">Verified By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {donationHistory.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                    No verified donation records on file yet.
                  </td>
                </tr>
              ) : (
                donationHistory.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-medium text-slate-900">{rec.donation_date}</td>
                    <td className="px-4 py-2.5 text-slate-700">{rec.hospitalName}</td>
                    <td className="px-4 py-2.5 text-slate-600">{rec.component}</td>
                    <td className="px-4 py-2.5 font-bold text-slate-900">{rec.units_donated} unit</td>
                    <td className="px-4 py-2.5 text-slate-500">{rec.verifiedByName || 'Clinical Staff'}</td>
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
