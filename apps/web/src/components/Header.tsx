'use client';

import React from 'react';
import { Activity, Bell, Shield, HeartPulse, UserCheck, Radio } from 'lucide-react';
import { UserSession } from '../lib/api';

interface HeaderProps {
  currentSession: UserSession | null;
  demoAccounts: any[];
  onSwitchUser: (userId: string) => void;
  onOpenNotifications: () => void;
  onOpenWeb3: () => void;
  isRealtimeConnected: boolean;
  notificationCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentSession,
  demoAccounts,
  onSwitchUser,
  onOpenNotifications,
  onOpenWeb3,
  isRealtimeConnected,
  notificationCount
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
      {/* Emergency Hotline Top Bar */}
      <div className="bg-slate-900 text-white text-xs py-1 px-4 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <span className="inline-block w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
          <span className="font-semibold text-rose-400">CRITICAL 24/7 TRAUMA TRANSFUSION DISPATCH:</span>
          <span className="font-mono text-slate-300">1-800-BLOOD-AI (1-800-256-6324)</span>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5">
            <Radio className={`w-3.5 h-3.5 ${isRealtimeConnected ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`} />
            <span className={isRealtimeConnected ? 'text-emerald-400' : 'text-slate-400'}>
              {isRealtimeConnected ? 'Realtime Mesh: Connected' : 'Sync: Polling'}
            </span>
          </div>
          <span className="text-slate-400">|</span>
          <span className="text-slate-300">HIPAA & Privacy Architecture Verified</span>
        </div>
      </div>

      {/* Main Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-rose-400 flex items-center justify-center text-white shadow-md shadow-rose-500/20">
            <HeartPulse className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl font-bold tracking-tight text-slate-900">BloodLink<span className="text-rose-600">.AI</span></span>
              <span className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
                Live Network
              </span>
            </div>
            <p className="text-xs text-slate-500 -mt-0.5">Real-Time Smart Blood Bank & Emergency Donor System</p>
          </div>
        </div>

        {/* Right Navigation & Role Switcher */}
        <div className="flex items-center space-x-3">
          {/* Demo Role Switcher */}
          <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-lg p-1">
            <span className="text-xs text-slate-500 pl-2 font-medium flex items-center">
              <UserCheck className="w-3.5 h-3.5 mr-1 text-slate-400" />
              Role:
            </span>
            <select
              className="text-xs bg-transparent font-medium text-slate-800 border-none focus:ring-0 cursor-pointer pr-6 py-1"
              value={currentSession?.user?.id || ''}
              onChange={(e) => onSwitchUser(e.target.value)}
            >
              {demoAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.fullName} ({acc.role.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          {/* Web3 Trust Layer Button */}
          <button
            onClick={onOpenWeb3}
            className="flex items-center space-x-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 transition"
            title="Inspect Polygon Amoy Smart Contract Registry"
          >
            <Shield className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline">Web3 Registry</span>
          </button>

          {/* Live Notification Simulator Button */}
          <button
            onClick={onOpenNotifications}
            className="relative flex items-center space-x-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 transition"
          >
            <Bell className="w-3.5 h-3.5 text-rose-600" />
            <span>SMS Feed</span>
            {notificationCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-bold">
                {notificationCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
