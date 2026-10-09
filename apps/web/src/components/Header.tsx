'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Bell, ChevronDown, HeartPulse, Menu, Shield, X } from 'lucide-react';

interface HeaderProps {
  currentSession: any;
  demoAccounts: any[];
  onSwitchUser: (userId: string) => void;
  onOpenNotifications: () => void;
  onOpenWeb3: () => void;
  isRealtimeConnected: boolean;
  notificationCount: number;
  activeTab: string;
  tabTitles: Record<string, string>;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentSession,
  demoAccounts,
  onSwitchUser,
  onOpenNotifications,
  onOpenWeb3,
  isRealtimeConnected,
  notificationCount,
  activeTab,
  tabTitles,
  onToggleSidebar,
}) => {
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentUser = currentSession?.user;
  const roleLabel = currentUser?.role?.replace('_', ' ') || 'Guest';

  return (
    <header
      className="sticky top-0 z-40 flex items-center justify-between gap-4 border-b bg-white px-4 lg:px-6"
      style={{ height: 'var(--header-height)', borderColor: 'var(--border-default)' }}
    >
      {/* Left: Logo + Mobile menu + Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="btn-ghost flex items-center justify-center lg:hidden"
          style={{ width: 36, height: 36, padding: 0, borderRadius: 'var(--radius-md)' }}
          aria-label="Toggle navigation"
        >
          <Menu className="h-[18px] w-[18px]" />
        </button>

        <div className="flex items-center gap-2.5">
          <div
            className="flex items-center justify-center rounded-lg text-white"
            style={{ width: 32, height: 32, background: 'var(--accent-primary)' }}
          >
            <HeartPulse className="h-[16px] w-[16px]" />
          </div>

          <div className="hidden sm:block min-w-0">
            <div className="text-sm font-bold text-gray-900 truncate">
              BloodLink<span style={{ color: 'var(--accent-primary)' }}>.AI</span>
            </div>
          </div>
        </div>

        {/* Breadcrumb separator */}
        <span className="hidden md:block text-gray-300 select-none">/</span>
        <span className="hidden md:block text-sm font-medium text-gray-500 truncate">
          {tabTitles[activeTab] || 'Dashboard'}
        </span>
      </div>

      {/* Right: Status + Notifications + Profile */}
      <div className="flex items-center gap-2">
        {/* Sync status */}
        <div
          className="hidden sm:flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md"
          style={{ 
            color: isRealtimeConnected ? 'var(--status-adequate)' : 'var(--text-muted)',
            background: isRealtimeConnected ? 'var(--status-adequate-bg)' : 'var(--bg-surface-secondary)',
          }}
        >
          <span
            className="status-dot"
            style={{
              width: 6,
              height: 6,
              background: isRealtimeConnected ? 'var(--status-adequate)' : 'var(--text-muted)',
            }}
          />
          {isRealtimeConnected ? 'Connected' : 'Syncing'}
        </div>

        {/* Web3 (desktop only) */}
        <button
          type="button"
          onClick={onOpenWeb3}
          className="btn-ghost btn-sm hidden lg:inline-flex"
          title="Web3 Trust Layer"
        >
          <Shield className="h-4 w-4 text-indigo-600" />
        </button>

        {/* Notifications */}
        <button
          type="button"
          onClick={onOpenNotifications}
          className="btn-ghost relative flex items-center justify-center"
          style={{ width: 36, height: 36, padding: 0, borderRadius: 'var(--radius-md)' }}
          aria-label="Notifications"
        >
          <Bell className="h-[16px] w-[16px]" />
          {notificationCount > 0 && (
            <span
              className="absolute flex items-center justify-center text-white font-bold"
              style={{
                top: 4,
                right: 4,
                minWidth: 16,
                height: 16,
                fontSize: 10,
                borderRadius: 9999,
                background: 'var(--accent-primary)',
                padding: '0 4px',
              }}
            >
              {notificationCount > 9 ? '9+' : notificationCount}
            </span>
          )}
        </button>

        {/* Profile dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-gray-50 transition-colors"
          >
            <div
              className="flex items-center justify-center rounded-md text-white font-bold text-xs"
              style={{ width: 28, height: 28, background: '#374151' }}
            >
              {(currentUser?.fullName || 'G').charAt(0).toUpperCase()}
            </div>
            <div className="hidden lg:block text-left min-w-0">
              <div className="text-sm font-semibold text-gray-900 truncate leading-tight" style={{ maxWidth: 120 }}>
                {currentUser?.fullName || 'Guest'}
              </div>
              <div className="text-[11px] text-gray-500 capitalize leading-tight">
                {roleLabel}
              </div>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-gray-400 hidden lg:block" />
          </button>

          {profileOpen && (
            <div
              className="absolute right-0 top-full mt-1 w-64 bg-white border rounded-lg shadow-lg overflow-hidden"
              style={{ borderColor: 'var(--border-default)', zIndex: 60 }}
            >
              <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border-default)' }}>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Switch Role</div>
              </div>
              <div className="py-1 max-h-64 overflow-y-auto">
                {demoAccounts.map((account) => (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => {
                      onSwitchUser(account.id);
                      setProfileOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 transition-colors"
                    style={{
                      background: currentSession?.user?.id === account.id ? 'var(--bg-surface-secondary)' : undefined,
                    }}
                  >
                    <div
                      className="flex items-center justify-center rounded-md text-white font-bold text-xs flex-shrink-0"
                      style={{ width: 28, height: 28, background: currentSession?.user?.id === account.id ? 'var(--accent-primary)' : '#6b7280' }}
                    >
                      {account.fullName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{account.fullName}</div>
                      <div className="text-[11px] text-gray-500 capitalize">{account.role.replace('_', ' ')}</div>
                    </div>
                    {currentSession?.user?.id === account.id && (
                      <span className="ml-auto text-xs font-medium" style={{ color: 'var(--accent-primary)' }}>Active</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
