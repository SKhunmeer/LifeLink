'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Header } from '../components/Header';
import { LiveInventorySection } from '../components/LiveInventorySection';
import { EmergencyRequestSection } from '../components/EmergencyRequestSection';
import { DonorPortalSection } from '../components/DonorPortalSection';
import { AdminAuditSection } from '../components/AdminAuditSection';
import { InteractiveMap } from '../components/InteractiveMap';
import { NotificationSimulatorDrawer } from '../components/NotificationSimulatorDrawer';
import { Web3TrustDrawer } from '../components/Web3TrustDrawer';
import { api, UserSession } from '../lib/api';
import { Activity, ShieldCheck, HeartPulse, Building2, User, Siren, Layers } from 'lucide-react';

export default function Home() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [demoAccounts, setDemoAccounts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'inventory' | 'requests' | 'donor' | 'admin' | 'map'>('inventory');

  // Domain data
  const [inventory, setInventory] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [donorProfile, setDonorProfile] = useState<any>(null);
  const [matchingRequests, setMatchingRequests] = useState<any[]>([]);
  const [donationHistory, setDonationHistory] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);

  // Drawers & status
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const [web3DrawerOpen, setWeb3DrawerOpen] = useState(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  // Load Initial Session & Data
  const loadData = useCallback(async () => {
    try {
      const demoRes = await api.getDemoAccounts().catch(() => ({ accounts: [] }));
      setDemoAccounts(demoRes.accounts || []);

      const invRes = await api.getInventory().catch(() => ({ inventory: [] }));
      setInventory(invRes.inventory || []);

      const reqRes = await api.getRequests().catch(() => ({ requests: [] }));
      setRequests(reqRes.requests || []);

      const hospRes = await api.getHospitals().catch(() => ({ hospitals: [] }));
      setHospitals(hospRes.hospitals || []);

      const notifRes = await api.getNotifications().catch(() => ({ logs: [] }));
      setNotifications(notifRes.logs || []);

      const auditRes = await api.getAuditLogs().catch(() => ({ logs: [] }));
      setAuditLogs(auditRes.logs || []);

      const analRes = await api.getAnalyticsSummary().catch(() => null);
      setAnalytics(analRes);

      // Check current user
      const meRes = await api.getMe().catch(() => null);
      if (meRes?.user) {
        setSession(meRes);
        if (meRes.user.role === 'donor') {
          loadDonorData();
        }
      } else if (demoRes.accounts && demoRes.accounts.length > 0) {
        // Default to Hospital Staff demo account
        const defaultStaff = demoRes.accounts.find((a: any) => a.role === 'hospital_staff') || demoRes.accounts[0];
        handleSwitchUser(defaultStaff.id);
      }
    } catch (err) {
      console.error('[App] Load error:', err);
    }
  }, []);

  const loadDonorData = async () => {
    try {
      const profile = await api.getDonorProfile().catch(() => null);
      setDonorProfile(profile);

      const matches = await api.getDonorMatchingRequests().catch(() => ({ matches: [] }));
      setMatchingRequests(matches.matches || []);

      const history = await api.getDonorHistory().catch(() => ({ history: [] }));
      setDonationHistory(history.history || []);
    } catch (err) {
      console.error('[App] Donor load error:', err);
    }
  };

  useEffect(() => {
    loadData();

    // Setup WebSocket connection to API
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket('ws://localhost:4000/ws');
      ws.onopen = () => {
        setIsRealtimeConnected(true);
      };
      ws.onclose = () => {
        setIsRealtimeConnected(false);
      };
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'INVENTORY_UPDATED') {
            api.getInventory().then((res) => setInventory(res.inventory || []));
            api.getAnalyticsSummary().then((res) => setAnalytics(res));
          } else if (msg.type === 'REQUEST_CREATED' || msg.type === 'REQUEST_STATUS_UPDATED') {
            api.getRequests().then((res) => setRequests(res.requests || []));
            api.getAnalyticsSummary().then((res) => setAnalytics(res));
          } else if (msg.type === 'NOTIFICATION_DISPATCHED') {
            setNotifications((prev) => [msg.payload, ...prev]);
            setUnreadNotifCount((prev) => prev + 1);
          } else if (msg.type === 'AUDIT_LOG_CREATED') {
            setAuditLogs((prev) => [msg.payload, ...prev]);
          }
        } catch (e) {
          console.error('[WS] Parse error:', e);
        }
      };
    } catch (e) {
      console.warn('[WS] Could not initialize websocket:', e);
    }

    return () => {
      if (ws) ws.close();
    };
  }, [loadData]);

  // Handle Switch Role
  const handleSwitchUser = async (userId: string) => {
    try {
      const switched = await api.switchDemo(userId);
      setSession(switched);
      if (switched.user.role === 'donor') {
        setActiveTab('donor');
        loadDonorData();
      } else if (switched.user.role === 'patient') {
        setActiveTab('requests');
      } else if (switched.user.role === 'admin') {
        setActiveTab('admin');
      } else {
        setActiveTab('inventory');
      }
    } catch (err: any) {
      alert(`Role switch error: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/70">
      {/* Top Header */}
      <Header
        currentSession={session}
        demoAccounts={demoAccounts}
        onSwitchUser={handleSwitchUser}
        onOpenNotifications={() => {
          setNotificationDrawerOpen(true);
          setUnreadNotifCount(0);
        }}
        onOpenWeb3={() => setWeb3DrawerOpen(true)}
        isRealtimeConnected={isRealtimeConnected}
        notificationCount={unreadNotifCount}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Navigation Tabs Bar */}
        <div className="bg-white p-1.5 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-2 shadow-sm">
          <div className="flex flex-wrap items-center gap-1">
            <button
              onClick={() => setActiveTab('inventory')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'inventory'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <HeartPulse className="w-4 h-4" />
              <span>Live Inventory Matrix</span>
            </button>

            <button
              onClick={() => setActiveTab('requests')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'requests'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Siren className="w-4 h-4" />
              <span>Emergency Requests ({requests.length})</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('donor');
                loadDonorData();
              }}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'donor'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Donor Portal</span>
            </button>

            {(session?.user?.role === 'admin' || session?.user?.role === 'hospital_staff') && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                  activeTab === 'admin'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Governance & Audit Logs</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('map')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'map'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Facility Map</span>
            </button>
          </div>

          <div className="flex items-center space-x-2 px-3 py-1 bg-slate-50 rounded-xl text-xs text-slate-500 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Active Role: <strong className="text-slate-800 uppercase">{session?.user?.role || 'Guest'}</strong></span>
          </div>
        </div>

        {/* Tab Content Panels */}
        {activeTab === 'inventory' && (
          <LiveInventorySection
            inventory={inventory}
            hospitals={hospitals}
            userRole={session?.user?.role || 'hospital_staff'}
            onRefresh={loadData}
            onAdjustInventory={async (params) => {
              await api.adjustInventory(params);
              loadData();
            }}
            onAddBatch={async (batch) => {
              await api.addInventoryBatch(batch);
              loadData();
            }}
          />
        )}

        {activeTab === 'requests' && (
          <EmergencyRequestSection
            requests={requests}
            hospitals={hospitals}
            userRole={session?.user?.role || 'patient'}
            onRefresh={loadData}
            onCreateRequest={async (data) => {
              return api.createRequest(data);
            }}
            onVerifyRequest={async (id) => {
              await api.verifyRequest(id);
            }}
            onTriggerOutreach={async (id) => {
              await api.triggerDonorOutreach(id);
            }}
            onFulfillRequest={async (id) => {
              await api.fulfillRequest(id);
            }}
            onCancelRequest={async (id) => {
              await api.cancelRequest(id);
            }}
          />
        )}

        {activeTab === 'donor' && (
          <DonorPortalSection
            donorProfile={donorProfile}
            matchingRequests={matchingRequests}
            donationHistory={donationHistory}
            onRespond={async (matchId, response) => {
              await api.respondToDonorMatch(matchId, response);
              loadDonorData();
            }}
            onToggleAvailability={async (isAvailable) => {
              await api.updateDonorPreferences({ isAvailable });
              loadDonorData();
            }}
          />
        )}

        {activeTab === 'admin' && (
          <AdminAuditSection
            auditLogs={auditLogs}
            hospitals={hospitals}
            onVerifyHospital={async (id) => {
              await api.verifyHospital(id);
              loadData();
            }}
            analytics={analytics}
          />
        )}

        {activeTab === 'map' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <InteractiveMap hospitals={hospitals} requests={requests} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-800">BloodLink AI System</span>
            <span>•</span>
            <span>HIPAA-Compliant Relational Separation Architecture</span>
          </div>
          <div>
            Built with Next.js, Express, Supabase PostgreSQL, Leaflet, Twilio Sandbox & Polygon Amoy
          </div>
        </div>
      </footer>

      {/* Drawers */}
      <NotificationSimulatorDrawer
        isOpen={notificationDrawerOpen}
        onClose={() => setNotificationDrawerOpen(false)}
        notifications={notifications}
        onSendTestSms={async (phone, message) => {
          await api.sendTestNotification(phone, message);
          loadData();
        }}
      />

      <Web3TrustDrawer
        isOpen={web3DrawerOpen}
        onClose={() => setWeb3DrawerOpen(false)}
      />
    </div>
  );
}
