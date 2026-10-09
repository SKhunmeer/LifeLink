'use client';

import React, { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Plus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { BLOOD_GROUPS, BLOOD_COMPONENTS, BLOOD_COMPONENT_LABELS } from '@bloodlink/shared';

interface LiveInventorySectionProps {
  inventory: any[];
  hospitals: any[];
  userRole: string;
  onRefresh: () => void;
  onAdjustInventory: (params: { inventoryId: string; action: string; units: number; reason: string }) => Promise<void>;
  onAddBatch: (batch: any) => Promise<void>;
}

const ITEMS_PER_PAGE = 15;

const statusConfig: Record<string, { label: string; badgeClass: string }> = {
  available: { label: 'Available', badgeClass: 'badge-adequate' },
  reserved: { label: 'Reserved', badgeClass: 'badge-neutral' },
  low: { label: 'Low', badgeClass: 'badge-low' },
  expired: { label: 'Expired', badgeClass: 'badge-critical' },
  quarantined: { label: 'Quarantined', badgeClass: 'badge-critical' },
  unavailable: { label: 'Unavailable', badgeClass: 'badge-neutral' },
};

export const LiveInventorySection: React.FC<LiveInventorySectionProps> = ({
  inventory,
  hospitals,
  userRole,
  onRefresh,
  onAdjustInventory,
  onAddBatch,
}) => {
  // Filters
  const [selectedHospital, setSelectedHospital] = useState<string>('all');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedComponent, setSelectedComponent] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<string>('bloodGroup');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Modals
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [adjustAction, setAdjustAction] = useState<string>('reserve');
  const [adjustUnits, setAdjustUnits] = useState<number>(1);
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmIssue, setConfirmIssue] = useState(false);

  const [addBatchModalOpen, setAddBatchModalOpen] = useState(false);
  const [newBatch, setNewBatch] = useState({
    hospitalId: hospitals[0]?.id || '',
    bloodGroup: 'O+',
    component: 'packed_red_blood_cells',
    unitsCount: 5,
    status: 'available',
    batchNumber: `B-BATCH-${Math.floor(1000 + Math.random() * 9000)}`,
    storageLocation: 'Central Cold Vault A',
    collectionDate: new Date().toISOString().split('T')[0],
    expiryDate: new Date(Date.now() + 35 * 86400 * 1000).toISOString().split('T')[0],
  });

  // Summary stats
  const stats = useMemo(() => {
    const groupMap: Record<string, number> = {};
    BLOOD_GROUPS.forEach((g) => (groupMap[g] = 0));
    inventory.forEach((item) => {
      if (item.status === 'available' || item.status === 'reserved') {
        groupMap[item.bloodGroup] = (groupMap[item.bloodGroup] || 0) + Number(item.unitsCount || 0);
      }
    });

    const totalAvailable = inventory
      .filter((i) => i.status === 'available')
      .reduce((s, i) => s + Number(i.unitsCount || 0), 0);

    const criticalGroups = BLOOD_GROUPS.filter((g) => (groupMap[g] || 0) <= 2).length;
    const verifiedFacilities = hospitals.filter((f) => f.isVerified || f.verified || f.is_verified).length;
    const alerts = inventory.filter((i) => ['low', 'expired', 'quarantined'].includes(i.status)).length;

    return { groupMap, totalAvailable, criticalGroups, verifiedFacilities, alerts };
  }, [inventory, hospitals]);

  const getStockStatus = (count: number) => {
    if (count <= 2) return { label: 'Critical', tone: 'critical' };
    if (count <= 5) return { label: 'Low Stock', tone: 'low' };
    return { label: 'Adequate', tone: 'adequate' };
  };

  // Filter inventory
  const filteredInventory = useMemo(() => {
    let items = inventory.filter((item) => {
      if (selectedHospital !== 'all' && item.hospitalId !== selectedHospital) return false;
      if (selectedGroup !== 'all' && item.bloodGroup !== selectedGroup) return false;
      if (selectedComponent !== 'all' && item.component !== selectedComponent) return false;
      if (selectedStatus !== 'all' && item.status !== selectedStatus) return false;

      const search = searchTerm.trim().toLowerCase();
      if (search) {
        const hospitalName = hospitals.find((h) => h.id === item.hospitalId)?.name || '';
        const haystack = [hospitalName, item.bloodGroup, item.batchNumber, item.storageLocation, item.component, item.status].join(' ').toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });

    // Sort
    items.sort((a, b) => {
      const aVal = a[sortField] || '';
      const bVal = b[sortField] || '';
      const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return items;
  }, [inventory, selectedHospital, selectedGroup, selectedComponent, selectedStatus, searchTerm, sortField, sortDirection, hospitals]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredInventory.length / ITEMS_PER_PAGE));
  const paginatedItems = filteredInventory.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const hasActiveFilters = selectedHospital !== 'all' || selectedGroup !== 'all' || selectedComponent !== 'all' || selectedStatus !== 'all' || searchTerm.trim().length > 0;

  const clearFilters = () => {
    setSelectedHospital('all');
    setSelectedGroup('all');
    setSelectedComponent('all');
    setSelectedStatus('all');
    setSearchTerm('');
    setCurrentPage(1);
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleOpenAdjust = (item: any, defaultAction = 'reserve') => {
    // Prevent issuing expired or quarantined blood
    if (['expired', 'quarantined'].includes(item.status) && defaultAction === 'issue') {
      alert(`Cannot issue ${item.status} blood. This batch must be reviewed first.`);
      return;
    }
    setSelectedItem(item);
    setAdjustAction(defaultAction);
    setAdjustUnits(1);
    setAdjustReason(defaultAction === 'reserve' ? 'Clinical reservation for surgery' : 'Emergency transfusion issue');
    setConfirmIssue(false);
    setAdjustModalOpen(true);
  };

  const submitAdjust = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedItem) return;

    // Confirmation for issue action
    if (adjustAction === 'issue' && !confirmIssue) {
      setConfirmIssue(true);
      return;
    }

    setIsSubmitting(true);
    try {
      await onAdjustInventory({
        inventoryId: selectedItem.id,
        action: adjustAction,
        units: Number(adjustUnits),
        reason: adjustReason || 'Inventory adjustment',
      });
      setAdjustModalOpen(false);
    } catch (error: any) {
      alert(`Adjustment failed: ${error.message}`);
    } finally {
      setIsSubmitting(false);
      setConfirmIssue(false);
    }
  };

  const submitNewBatch = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await onAddBatch(newBatch);
      setAddBatchModalOpen(false);
    } catch (error: any) {
      alert(`Failed to register batch: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const SortHeader = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <th
      className="px-4 py-2.5 cursor-pointer select-none hover:bg-gray-100 transition-colors"
      onClick={() => handleSort(field)}
      style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)', background: 'var(--bg-surface-secondary)', borderBottom: '1px solid var(--border-default)', whiteSpace: 'nowrap' }}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sortField === field && (
          <span className="text-gray-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>
        )}
      </span>
    </th>
  );

  return (
    <div className="space-y-5">
      {/* Summary stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-3.5">
          <div className="text-xs font-medium text-gray-500 mb-1">Total Available</div>
          <div className="text-xl font-bold text-gray-900">{stats.totalAvailable} <span className="text-xs font-normal text-gray-500">units</span></div>
        </div>
        <div className="card p-3.5">
          <div className="text-xs font-medium text-gray-500 mb-1">Critical Groups</div>
          <div className="text-xl font-bold" style={{ color: stats.criticalGroups > 0 ? 'var(--status-critical)' : 'var(--text-primary)' }}>
            {stats.criticalGroups} <span className="text-xs font-normal text-gray-500">need action</span>
          </div>
        </div>
        <div className="card p-3.5">
          <div className="text-xs font-medium text-gray-500 mb-1">Active Facilities</div>
          <div className="text-xl font-bold text-gray-900">{stats.verifiedFacilities} <span className="text-xs font-normal text-gray-500">verified</span></div>
        </div>
        <div className="card p-3.5">
          <div className="text-xs font-medium text-gray-500 mb-1">Inventory Alerts</div>
          <div className="text-xl font-bold" style={{ color: stats.alerts > 0 ? 'var(--status-low)' : 'var(--text-primary)' }}>
            {stats.alerts} <span className="text-xs font-normal text-gray-500">to review</span>
          </div>
        </div>
      </div>

      {/* Blood group grid */}
      <div className="card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="section-title">Blood Group Availability</h2>
            <p className="section-subtitle">Aggregate stock across all regional facilities</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onRefresh} className="btn btn-secondary btn-sm">
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
            {(userRole === 'hospital_staff' || userRole === 'admin') && (
              <button type="button" onClick={() => setAddBatchModalOpen(true)} className="btn btn-primary btn-sm">
                <Plus className="h-3.5 w-3.5" /> New Batch
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
          {BLOOD_GROUPS.map((group) => {
            const count = stats.groupMap[group] || 0;
            const st = getStockStatus(count);
            const borderColor = st.tone === 'critical' ? 'var(--status-critical-border)' : st.tone === 'low' ? 'var(--status-low-border)' : 'var(--border-default)';
            const bgColor = st.tone === 'critical' ? 'var(--status-critical-bg)' : st.tone === 'low' ? 'var(--status-low-bg)' : 'var(--bg-surface-secondary)';

            return (
              <div key={group} className="rounded-lg p-3 text-center" style={{ border: `1px solid ${borderColor}`, background: bgColor }}>
                <div className="text-base font-bold text-gray-900">{group}</div>
                <div className="text-xl font-bold text-gray-900 mt-1">{count}</div>
                <div className="text-[11px] text-gray-500 mb-1.5">units</div>
                <span className={`badge badge-${st.tone}`} style={{ fontSize: 10 }}>
                  {st.tone === 'critical' && <span className="status-dot status-dot-critical mr-1" style={{ width: 5, height: 5 }} />}
                  {st.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Inventory table */}
      <div className="card overflow-hidden">
        {/* Filters bar */}
        <div className="p-4 border-b flex flex-col xl:flex-row xl:items-center gap-3" style={{ borderColor: 'var(--border-default)' }}>
          <div className="relative flex-1 xl:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              placeholder="Search facility, batch, or blood group..."
              className="form-input pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select value={selectedHospital} onChange={(e) => { setSelectedHospital(e.target.value); setCurrentPage(1); }} className="form-select" style={{ width: 'auto', minWidth: 140 }}>
              <option value="all">All facilities ({hospitals.length})</option>
              {hospitals.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>

            <select value={selectedGroup} onChange={(e) => { setSelectedGroup(e.target.value); setCurrentPage(1); }} className="form-select" style={{ width: 'auto', minWidth: 120 }}>
              <option value="all">All groups</option>
              {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>

            <select value={selectedComponent} onChange={(e) => { setSelectedComponent(e.target.value); setCurrentPage(1); }} className="form-select" style={{ width: 'auto', minWidth: 150 }}>
              <option value="all">All components</option>
              {BLOOD_COMPONENTS.map((c) => <option key={c} value={c}>{BLOOD_COMPONENT_LABELS[c] || c}</option>)}
            </select>

            <select value={selectedStatus} onChange={(e) => { setSelectedStatus(e.target.value); setCurrentPage(1); }} className="form-select" style={{ width: 'auto', minWidth: 120 }}>
              <option value="all">All statuses</option>
              <option value="available">Available</option>
              <option value="reserved">Reserved</option>
              <option value="low">Low</option>
              <option value="expired">Expired</option>
              <option value="quarantined">Quarantined</option>
              <option value="unavailable">Unavailable</option>
            </select>

            {hasActiveFilters && (
              <button type="button" onClick={clearFilters} className="btn btn-ghost btn-sm" style={{ color: 'var(--accent-primary)' }}>
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            )}
          </div>
        </div>

        {/* Active filter pills */}
        {hasActiveFilters && (
          <div className="px-4 py-2 flex flex-wrap items-center gap-2 text-xs border-b" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-surface-secondary)' }}>
            <Filter className="h-3 w-3 text-gray-400" />
            <span className="text-gray-500">Filtered:</span>
            {selectedHospital !== 'all' && (
              <span className="badge badge-neutral">{hospitals.find((h) => h.id === selectedHospital)?.name || 'Facility'}</span>
            )}
            {selectedGroup !== 'all' && <span className="badge badge-neutral">{selectedGroup}</span>}
            {selectedComponent !== 'all' && <span className="badge badge-neutral">{BLOOD_COMPONENT_LABELS[selectedComponent as keyof typeof BLOOD_COMPONENT_LABELS] || selectedComponent}</span>}
            {selectedStatus !== 'all' && <span className="badge badge-neutral">{selectedStatus}</span>}
            {searchTerm.trim() && <span className="badge badge-neutral">"{searchTerm}"</span>}
            <span className="text-gray-400 ml-1">{filteredInventory.length} results</span>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <SortHeader field="bloodGroup">Blood Group</SortHeader>
                <SortHeader field="component">Component</SortHeader>
                <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)', background: 'var(--bg-surface-secondary)', borderBottom: '1px solid var(--border-default)', whiteSpace: 'nowrap' }}>Facility</th>
                <SortHeader field="unitsCount">Units</SortHeader>
                <SortHeader field="status">Status</SortHeader>
                <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)', background: 'var(--bg-surface-secondary)', borderBottom: '1px solid var(--border-default)', whiteSpace: 'nowrap' }}>Batch</th>
                <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)', background: 'var(--bg-surface-secondary)', borderBottom: '1px solid var(--border-default)', whiteSpace: 'nowrap' }}>Storage</th>
                <SortHeader field="expiryDate">Expiry</SortHeader>
                <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)', background: 'var(--bg-surface-secondary)', borderBottom: '1px solid var(--border-default)', whiteSpace: 'nowrap' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="empty-state">
                    <div className="empty-state-title">No inventory items found</div>
                    <div className="empty-state-description">
                      {hasActiveFilters ? 'Try adjusting your filters.' : 'No inventory data available.'}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => {
                  const facility = hospitals.find((h) => h.id === item.hospitalId);
                  const componentLabel = (BLOOD_COMPONENT_LABELS as Record<string, string>)[item.component] || item.component;
                  const st = statusConfig[item.status] || statusConfig.available;
                  const isBlocked = ['expired', 'quarantined'].includes(item.status);

                  return (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{item.bloodGroup}</td>
                      <td>{componentLabel}</td>
                      <td>
                        <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{facility?.name || item.hospitalId}</div>
                        <div className="text-xs text-gray-400">{facility?.address || ''}</div>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.unitsCount || 0}</td>
                      <td>
                        <span className={`badge ${st.badgeClass}`}>{st.label}</span>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{item.batchNumber || '—'}</td>
                      <td className="text-xs text-gray-500">{item.storageLocation || '—'}</td>
                      <td className="text-xs text-gray-500">{item.expiryDate || '—'}</td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenAdjust(item, 'reserve')}
                            disabled={isBlocked}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: 11 }}
                          >
                            Reserve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenAdjust(item, 'issue')}
                            disabled={isBlocked}
                            className="btn btn-sm"
                            style={{
                              fontSize: 11,
                              background: isBlocked ? undefined : 'var(--accent-primary-bg)',
                              color: isBlocked ? undefined : 'var(--accent-primary)',
                              borderColor: isBlocked ? undefined : 'var(--status-critical-border)',
                            }}
                            title={isBlocked ? `Cannot issue ${item.status} blood` : 'Issue blood units'}
                          >
                            Issue
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 flex items-center justify-between border-t" style={{ borderColor: 'var(--border-default)' }}>
            <div className="text-xs text-gray-500">
              Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredInventory.length)} of {filteredInventory.length}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="btn btn-ghost btn-sm"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const page = currentPage <= 3 ? i + 1 : currentPage + i - 2;
                if (page < 1 || page > totalPages) return null;
                return (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className="btn btn-sm"
                    style={{
                      minWidth: 32,
                      background: page === currentPage ? 'var(--accent-primary)' : 'transparent',
                      color: page === currentPage ? '#fff' : 'var(--text-secondary)',
                      borderColor: page === currentPage ? 'var(--accent-primary)' : 'transparent',
                    }}
                  >
                    {page}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="btn btn-ghost btn-sm"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Adjust Inventory Modal */}
      {adjustModalOpen && selectedItem && (
        <div className="modal-overlay" onClick={() => setAdjustModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border-default)' }}>
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Inventory Adjustment</div>
              <h3 className="text-base font-bold text-gray-900 mt-1">{selectedItem.bloodGroup} · {selectedItem.batchNumber}</h3>
            </div>

            <form onSubmit={submitAdjust} className="p-5 space-y-4">
              {confirmIssue && (
                <div className="p-3 rounded-md" style={{ background: 'var(--status-critical-bg)', border: '1px solid var(--status-critical-border)' }}>
                  <div className="text-sm font-semibold" style={{ color: 'var(--status-critical)' }}>⚠ Confirm Blood Issue</div>
                  <p className="text-xs text-gray-600 mt-1">
                    You are about to issue {adjustUnits} unit(s) of {selectedItem.bloodGroup}. This action will deduct from available stock and cannot be undone.
                  </p>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="form-label">Action</label>
                  <select value={adjustAction} onChange={(e) => { setAdjustAction(e.target.value); setConfirmIssue(false); }} className="form-select">
                    <option value="reserve">Reserve</option>
                    <option value="issue">Issue</option>
                    <option value="quarantine">Quarantine</option>
                    <option value="release">Release</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Units</label>
                  <input type="number" min="1" value={adjustUnits} onChange={(e) => setAdjustUnits(Number(e.target.value))} className="form-input" />
                </div>
              </div>

              <div>
                <label className="form-label">Reason</label>
                <textarea value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} rows={2} className="form-input" style={{ resize: 'vertical' }} />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--border-default)' }}>
                <button type="button" onClick={() => setAdjustModalOpen(false)} className="btn btn-secondary">Cancel</button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={confirmIssue ? 'btn btn-danger' : 'btn btn-primary'}
                >
                  {isSubmitting ? 'Updating...' : confirmIssue ? 'Confirm Issue' : 'Apply Change'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Batch Modal */}
      {addBatchModalOpen && (
        <div className="modal-overlay" onClick={() => setAddBatchModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border-default)' }}>
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">New Inventory Intake</div>
              <h3 className="text-base font-bold text-gray-900 mt-1">Register Blood Batch</h3>
            </div>

            <form onSubmit={submitNewBatch} className="p-5 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="form-label">Facility</label>
                  <select value={newBatch.hospitalId} onChange={(e) => setNewBatch((p) => ({ ...p, hospitalId: e.target.value }))} className="form-select">
                    {hospitals.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Blood Group</label>
                  <select value={newBatch.bloodGroup} onChange={(e) => setNewBatch((p) => ({ ...p, bloodGroup: e.target.value }))} className="form-select">
                    {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Component</label>
                  <select value={newBatch.component} onChange={(e) => setNewBatch((p) => ({ ...p, component: e.target.value }))} className="form-select">
                    {BLOOD_COMPONENTS.map((c) => <option key={c} value={c}>{BLOOD_COMPONENT_LABELS[c] || c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Units</label>
                  <input type="number" min="1" value={newBatch.unitsCount} onChange={(e) => setNewBatch((p) => ({ ...p, unitsCount: Number(e.target.value) }))} className="form-input" />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="form-label">Batch Number</label>
                  <input value={newBatch.batchNumber} onChange={(e) => setNewBatch((p) => ({ ...p, batchNumber: e.target.value }))} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Status</label>
                  <select value={newBatch.status} onChange={(e) => setNewBatch((p) => ({ ...p, status: e.target.value }))} className="form-select">
                    <option value="available">Available</option>
                    <option value="reserved">Reserved</option>
                    <option value="quarantined">Quarantined</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="form-label">Storage Location</label>
                  <input value={newBatch.storageLocation} onChange={(e) => setNewBatch((p) => ({ ...p, storageLocation: e.target.value }))} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Expiry Date</label>
                  <input type="date" value={newBatch.expiryDate} onChange={(e) => setNewBatch((p) => ({ ...p, expiryDate: e.target.value }))} className="form-input" />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--border-default)' }}>
                <button type="button" onClick={() => setAddBatchModalOpen(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="btn btn-primary">
                  {isSubmitting ? 'Saving...' : 'Save Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
