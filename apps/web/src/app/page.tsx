'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Building2,
  ChevronLeft,
  ChevronRight,
  FileText,
  HeartPulse,
  Layers,
  MapPinned,
  Package,
  ShieldCheck,
  Siren,
  Users,
  X,
} from 'lucide-react';
import { Header } from '../components/Header';
import { LiveInventorySection } from '../components/LiveInventorySection';
import { EmergencyRequestSection } from '../components/EmergencyRequestSection';
import { DonorPortalSection } from '../components/DonorPortalSection';
import { AdminAuditSection } from '../components/AdminAuditSection';
import { InteractiveMap, type LocationSelection } from '../components/InteractiveMap';
import { NotificationSimulatorDrawer } from '../components/NotificationSimulatorDrawer';
import { Web3TrustDrawer } from '../components/Web3TrustDrawer';
import { api, UserSession } from '../lib/api';

type TabKey = 'dashboard' | 'inventory' | 'requests' | 'map' | 'donor' | 'admin';

const navGroups = [
  {
    title: 'Operations',
    items: [
      { key: 'dashboard' as TabKey, label: 'Dashboard', icon: Activity },
      { key: 'inventory' as TabKey, label: 'Blood Inventory', icon: HeartPulse },
      { key: 'requests' as TabKey, label: 'Emergency Requests', icon: Siren },
      { key: 'map' as TabKey, label: 'Facility Map', icon: MapPinned },
    ],
  },
  {
    title: 'Management',
    items: [
      { key: 'donor' as TabKey, label: 'Donor Portal', icon: Users },
      { key: 'admin' as TabKey, label: 'Governance & Audit', icon: ShieldCheck },
    ],
  },
];

const tabTitles: Record<string, string> = {
  dashboard: 'Operations Dashboard',
  inventory: 'Live Blood Inventory',
  requests: 'Emergency Requests',
  map: 'Facility Map',
  donor: 'Donor Portal',
  admin: 'Governance & Audit Logs',
};

const BLOOD_GROUPS_DISPLAY = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

export default function Home() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [demoAccounts, setDemoAccounts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');

  const [inventory, setInventory] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [currentLocation, setCurrentLocation] = useState<LocationSelection | null>(null);
  const [donorProfile, setDonorProfile] = useState<any>(null);
  const [matchingRequests, setMatchingRequests] = useState<any[]>([]);
  const [donationHistory, setDonationHistory] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);

  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const [web3DrawerOpen, setWeb3DrawerOpen] = useState(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Sidebar state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

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

      setLastSyncTime(new Date());

      const meRes = await api.getMe().catch(() => null);
      if (meRes?.user) {
        setSession(meRes);
        if (meRes.user.role === 'donor') {
          loadDonorData();
        }
      } else if (demoRes.accounts && demoRes.accounts.length > 0) {
        const defaultStaff = demoRes.accounts.find((account: any) => account.role === 'hospital_staff') || demoRes.accounts[0];
        handleSwitchUser(defaultStaff.id);
      }
    } catch (error) {
      console.error('[App] Load error:', error);
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
    } catch (error) {
      console.error('[App] Donor load error:', error);
    }
  };

  useEffect(() => {
    loadData();

    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket('ws://localhost:4000/ws');
      ws.onopen = () => setIsRealtimeConnected(true);
      ws.onclose = () => setIsRealtimeConnected(false);
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'INVENTORY_UPDATED') {
            api.getInventory().then((res) => setInventory(res.inventory || []));
            api.getAnalyticsSummary().then((res) => setAnalytics(res));
            setLastSyncTime(new Date());
          } else if (message.type === 'REQUEST_CREATED' || message.type === 'REQUEST_STATUS_UPDATED') {
            api.getRequests().then((res) => setRequests(res.requests || []));
            api.getAnalyticsSummary().then((res) => setAnalytics(res));
          } else if (message.type === 'NOTIFICATION_DISPATCHED') {
            setNotifications((previous) => [message.payload, ...previous]);
            setUnreadNotifCount((previous) => previous + 1);
          } else if (message.type === 'AUDIT_LOG_CREATED') {
            setAuditLogs((previous) => [message.payload, ...previous]);
          }
        } catch (error) {
          console.error('[WS] Parse error:', error);
        }
      };
    } catch (error) {
      console.warn('[WS] Could not initialize websocket:', error);
    }

    return () => {
      if (ws) ws.close();
    };
  }, [loadData]);

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
        setActiveTab('dashboard');
      }
    } catch (error: any) {
      alert(`Role switch error: ${error.message}`);
    }
  };

  const handleSidebarItemSelect = (tab: TabKey) => {
    setActiveTab(tab);
    setMobileSidebarOpen(false);
    if (tab === 'donor') {
      loadDonorData();
    }
  };

  // Computed metrics from real data
  const summaryMetrics = useMemo(() => {
    const totalAvailable = inventory
      .filter((item) => item.status === 'available')
      .reduce((sum, item) => sum + Number(item.unitsCount || 0), 0);

    const pendingRequests = requests.filter((req) =>
      ['pending', 'submitted', 'verified', 'assigned', 'donor_outreach'].includes(req.status)
    ).length;

    const verifiedFacilities = hospitals.filter(
      (f) => f.isVerified || f.verified || f.is_verified
    ).length;

    const criticalGroups = new Set(
      inventory
        .filter((item) => item.status === 'available' && Number(item.unitsCount || 0) <= 2)
        .map((item) => item.bloodGroup)
    ).size;

    return { totalAvailable, pendingRequests, verifiedFacilities, criticalGroups };
  }, [hospitals, inventory, requests]);

  // Blood group stock map
  const groupStockMap = useMemo(() => {
    const map: Record<string, number> = {};
    BLOOD_GROUPS_DISPLAY.forEach((g) => (map[g] = 0));
    inventory.forEach((item) => {
      if (item.status === 'available' || item.status === 'reserved') {
        map[item.bloodGroup] = (map[item.bloodGroup] || 0) + Number(item.unitsCount || 0);
      }
    });
    return map;
  }, [inventory]);

  const getStockStatus = (count: number) => {
    if (count <= 2) return { label: 'Critical', tone: 'critical' };
    if (count <= 5) return { label: 'Low Stock', tone: 'low' };
    return { label: 'Adequate', tone: 'adequate' };
  };

  // Sidebar component (reused for desktop + mobile drawer)
  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="flex flex-col h-full">
      {/* Sidebar header */}
      <div
        className="flex items-center justify-between px-4 border-b"
        style={{
          height: 'var(--header-height)',
          borderColor: 'var(--border-default)',
        }}
      >
        {(!sidebarCollapsed || mobile) && (
          <div className="flex items-center gap-2 min-w-0">
            <Layers className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider truncate">
              Navigation
            </span>
          </div>
        )}
        {mobile ? (
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(false)}
            className="btn-ghost flex items-center justify-center"
            style={{ width: 32, height: 32, padding: 0, borderRadius: 'var(--radius-md)' }}
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="btn-ghost hidden lg:flex items-center justify-center"
            style={{ width: 28, height: 28, padding: 0, borderRadius: 'var(--radius-sm)' }}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-3 px-3">
        {navGroups.map((group) => (
          <div key={group.title} className="mb-4">
            {(!sidebarCollapsed || mobile) && (
              <div
                className="px-2 mb-1 text-[10px] font-bold uppercase tracking-widest"
                style={{ color: 'var(--text-muted)' }}
              >
                {group.title}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.key;

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleSidebarItemSelect(item.key)}
                    title={sidebarCollapsed && !mobile ? item.label : undefined}
                    className="w-full flex items-center gap-2.5 rounded-md text-left text-[13px] font-medium transition-colors"
                    style={{
                      padding: sidebarCollapsed && !mobile ? '8px' : '8px 10px',
                      justifyContent: sidebarCollapsed && !mobile ? 'center' : 'flex-start',
                      background: isActive ? 'var(--accent-primary-bg)' : 'transparent',
                      color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      fontWeight: isActive ? 600 : 500,
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-surface-secondary)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                      }
                    }}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    {(!sidebarCollapsed || mobile) && <span className="truncate">{item.label}</span>}
                    {isActive && item.key === 'requests' && summaryMetrics.pendingRequests > 0 && (!sidebarCollapsed || mobile) && (
                      <span
                        className="ml-auto text-[10px] font-bold rounded-full px-1.5 py-0.5"
                        style={{
                          background: 'var(--status-critical-bg)',
                          color: 'var(--status-critical)',
                        }}
                      >
                        {summaryMetrics.pendingRequests}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Sidebar footer: current role */}
      {(!sidebarCollapsed || mobile) && (
        <div
          className="px-4 py-3 border-t"
          style={{ borderColor: 'var(--border-default)' }}
        >
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
            Current Role
          </div>
          <div className="text-sm font-semibold text-gray-800 capitalize">
            {session?.user?.role?.replace('_', ' ') || 'Guest'}
          </div>
          {lastSyncTime && (
            <div className="text-[11px] text-gray-400 mt-1">
              Last sync: {lastSyncTime.toLocaleTimeString()}
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-page)' }}>
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex flex-col flex-shrink-0 bg-white border-r transition-all duration-200 overflow-hidden"
        style={{
          width: sidebarCollapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)',
          borderColor: 'var(--border-default)',
        }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-gray-900/40"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[260px] bg-white shadow-xl">
            <SidebarContent mobile />
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
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
          activeTab={activeTab}
          tabTitles={tabTitles}
          onToggleSidebar={() => setMobileSidebarOpen(true)}
        />

        {/* Mobile bottom nav */}
        <div className="lg:hidden border-b bg-white overflow-x-auto" style={{ borderColor: 'var(--border-default)' }}>
          <div className="flex gap-1 px-3 py-2">
            {navGroups.flatMap((g) => g.items).map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleSidebarItemSelect(item.key)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors"
                  style={{
                    background: isActive ? 'var(--accent-primary-bg)' : 'transparent',
                    color: isActive ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                    fontWeight: isActive ? 600 : 500,
                  }}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable main */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1400px] mx-auto p-4 md:p-6 space-y-6">

            {/* Dashboard Overview Tab */}
            {activeTab === 'dashboard' && (
              <>
                {/* Summary metric cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <MetricCard
                    label="Total Available Units"
                    value={summaryMetrics.totalAvailable}
                    detail="Across all facilities"
                    tone="adequate"
                    icon={<Package className="h-4 w-4" />}
                  />
                  <MetricCard
                    label="Critical Blood Groups"
                    value={summaryMetrics.criticalGroups}
                    detail="Need urgent restocking"
                    tone="critical"
                    icon={<AlertTriangle className="h-4 w-4" />}
                  />
                  <MetricCard
                    label="Active Requests"
                    value={summaryMetrics.pendingRequests}
                    detail="Awaiting processing"
                    tone="low"
                    icon={<Siren className="h-4 w-4" />}
                  />
                  <MetricCard
                    label="Verified Facilities"
                    value={summaryMetrics.verifiedFacilities}
                    detail="Regional coverage"
                    tone="neutral"
                    icon={<Building2 className="h-4 w-4" />}
                  />
                </div>

                {/* Blood group availability grid */}
                <div className="card p-5">
                  <div className="section-header">
                    <div>
                      <h2 className="section-title">Blood Group Availability</h2>
                      <p className="section-subtitle">Real-time stock levels across all connected facilities</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
                    {BLOOD_GROUPS_DISPLAY.map((group) => {
                      const count = groupStockMap[group] || 0;
                      const status = getStockStatus(count);
                      return (
                        <BloodGroupCard
                          key={group}
                          group={group}
                          count={count}
                          status={status}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Quick links */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    type="button"
                    onClick={() => setActiveTab('inventory')}
                    className="card p-4 text-left hover:shadow-md transition-shadow group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-9 h-9 rounded-lg" style={{ background: 'var(--accent-primary-bg)' }}>
                        <HeartPulse className="h-4 w-4" style={{ color: 'var(--accent-primary)' }} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900 group-hover:text-red-700 transition-colors">
                          Manage Inventory
                        </div>
                        <div className="text-xs text-gray-500">View, filter, and adjust blood stock</div>
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('requests')}
                    className="card p-4 text-left hover:shadow-md transition-shadow group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-9 h-9 rounded-lg" style={{ background: 'var(--status-critical-bg)' }}>
                        <Siren className="h-4 w-4" style={{ color: 'var(--status-critical)' }} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900 group-hover:text-red-700 transition-colors">
                          Emergency Requests
                        </div>
                        <div className="text-xs text-gray-500">{summaryMetrics.pendingRequests} active requests</div>
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('map')}
                    className="card p-4 text-left hover:shadow-md transition-shadow group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-9 h-9 rounded-lg" style={{ background: 'var(--accent-secondary-bg)' }}>
                        <MapPinned className="h-4 w-4" style={{ color: 'var(--accent-secondary)' }} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900 group-hover:text-red-700 transition-colors">
                          Facility Map
                        </div>
                        <div className="text-xs text-gray-500">Locate nearby blood banks</div>
                      </div>
                    </div>
                  </button>
                </div>
              </>
            )}

            {/* Inventory Tab */}
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

            {/* Requests Tab */}
            {activeTab === 'requests' && (
              <EmergencyRequestSection
                requests={requests}
                hospitals={hospitals}
                requesterPhone={session?.user?.phone || ''}
                currentLocation={currentLocation}
                onLocationChange={setCurrentLocation}
                userRole={session?.user?.role || 'patient'}
                onRefresh={loadData}
                onCreateRequest={async (data) => api.createRequest({
                  ...data,
                  requesterLat: data.requesterLat ?? currentLocation?.lat,
                  requesterLng: data.requesterLng ?? currentLocation?.lng,
                  requesterLocationSource: data.requesterLocationSource ?? currentLocation?.source,
                })}
                onVerifyRequest={async (id) => { await api.verifyRequest(id); }}
                onTriggerOutreach={async (id) => { await api.triggerDonorOutreach(id); }}
                onFulfillRequest={async (id) => { await api.fulfillRequest(id); }}
                onCancelRequest={async (id) => { await api.cancelRequest(id); }}
              />
            )}

            {/* Donor Tab */}
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

            {/* Admin Tab */}
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

            {/* Map Tab */}
            {activeTab === 'map' && (
              <InteractiveMap onLocationChange={setCurrentLocation} />
            )}
          </div>
        </main>
      </div>

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

      <Web3TrustDrawer isOpen={web3DrawerOpen} onClose={() => setWeb3DrawerOpen(false)} />
    </div>
  );
}

// ===================================
// Sub-components
// ===================================

function MetricCard({
  label,
  value,
  detail,
  tone,
  icon,
}: {
  label: string;
  value: number;
  detail: string;
  tone: 'adequate' | 'critical' | 'low' | 'neutral';
  icon: React.ReactNode;
}) {
  const toneMap = {
    adequate: { bg: 'var(--status-adequate-bg)', color: 'var(--status-adequate)', border: 'var(--status-adequate-border)' },
    critical: { bg: 'var(--status-critical-bg)', color: 'var(--status-critical)', border: 'var(--status-critical-border)' },
    low: { bg: 'var(--status-low-bg)', color: 'var(--status-low)', border: 'var(--status-low-border)' },
    neutral: { bg: 'var(--status-neutral-bg)', color: 'var(--text-secondary)', border: 'var(--status-neutral-border)' },
  };
  const t = toneMap[tone];

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        <div
          className="flex items-center justify-center w-7 h-7 rounded-md"
          style={{ background: t.bg, color: t.color }}
        >
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{detail}</div>
    </div>
  );
}

function BloodGroupCard({
  group,
  count,
  status,
}: {
  group: string;
  count: number;
  status: { label: string; tone: string };
}) {
  const borderColor =
    status.tone === 'critical'
      ? 'var(--status-critical-border)'
      : status.tone === 'low'
      ? 'var(--status-low-border)'
      : 'var(--border-default)';

  const bgColor =
    status.tone === 'critical'
      ? 'var(--status-critical-bg)'
      : status.tone === 'low'
      ? 'var(--status-low-bg)'
      : 'var(--bg-surface)';

  return (
    <div
      className="rounded-lg p-3 text-center transition-colors"
      style={{ border: `1px solid ${borderColor}`, background: bgColor }}
    >
      <div className="text-lg font-bold text-gray-900">{group}</div>
      <div className="text-2xl font-bold text-gray-900 mt-1">{count}</div>
      <div className="text-[11px] text-gray-500 mb-2">units</div>
      <span
        className={`badge badge-${status.tone}`}
        style={{ fontSize: 10 }}
      >
        {status.tone === 'critical' && (
          <span className="status-dot status-dot-critical mr-1" style={{ width: 5, height: 5 }} />
        )}
        {status.label}
      </span>
    </div>
  );
}
