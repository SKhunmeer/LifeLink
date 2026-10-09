'use client';

import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle2, Plus, RefreshCw, SlidersHorizontal, ArrowRightLeft } from 'lucide-react';
import { BLOOD_GROUPS, BLOOD_COMPONENTS, BLOOD_COMPONENT_LABELS } from '@bloodlink/shared';

interface LiveInventorySectionProps {
  inventory: any[];
  hospitals: any[];
  userRole: string;
  onRefresh: () => void;
  onAdjustInventory: (params: { inventoryId: string; action: string; units: number; reason: string }) => Promise<void>;
  onAddBatch: (batch: any) => Promise<void>;
}

export const LiveInventorySection: React.FC<LiveInventorySectionProps> = ({
  inventory,
  hospitals,
  userRole,
  onRefresh,
  onAdjustInventory,
  onAddBatch
}) => {
  const [selectedHospital, setSelectedHospital] = useState<string>('all');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedComponent, setSelectedComponent] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Modal State
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [adjustAction, setAdjustAction] = useState<string>('reserve');
  const [adjustUnits, setAdjustUnits] = useState<number>(1);
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Batch Modal State
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
    expiryDate: new Date(Date.now() + 35 * 86400 * 1000).toISOString().split('T')[0]
  });

  const filteredInventory = inventory.filter((item) => {
    if (selectedHospital !== 'all' && item.hospitalId !== selectedHospital) return false;
    if (selectedGroup !== 'all' && item.bloodGroup !== selectedGroup) return false;
    if (selectedComponent !== 'all' && item.component !== selectedComponent) return false;
    if (selectedStatus !== 'all' && item.status !== selectedStatus) return false;
    return true;
  });

  // Calculate stock levels per blood group for quick status indicator
  const groupStockMap: Record<string, number> = {};
  BLOOD_GROUPS.forEach((bg) => { groupStockMap[bg] = 0; });
  inventory.forEach((item) => {
    if (item.status === 'available') {
      groupStockMap[item.bloodGroup] = (groupStockMap[item.bloodGroup] || 0) + item.unitsCount;
    }
  });

  const handleOpenAdjust = (item: any, defaultAction = 'reserve') => {
    setSelectedItem(item);
    setAdjustAction(defaultAction);
    setAdjustUnits(1);
    setAdjustReason(defaultAction === 'reserve' ? 'Clinical reservation for surgery' : 'Emergency transfusion issue');
    setAdjustModalOpen(true);
  };

  const submitAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    setIsSubmitting(true);
    try {
      await onAdjustInventory({
        inventoryId: selectedItem.id,
        action: adjustAction,
        units: Number(adjustUnits),
        reason: adjustReason || 'Inventory adjustment'
      });
      setAdjustModalOpen(false);
    } catch (err: any) {
      alert(`Adjustment failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitNewBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onAddBatch(newBatch);
      setAddBatchModalOpen(false);
    } catch (err: any) {
      alert(`Failed to register batch: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Overview Cards: Blood Group Quick Stock Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Live Blood Group Availability Matrix</h2>
            <p className="text-xs text-slate-500">Real-time aggregate available units across verified regional blood banks</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onRefresh}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
              title="Refresh inventory"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            {(userRole === 'hospital_staff' || userRole === 'admin') && (
              <button
                onClick={() => setAddBatchModalOpen(true)}
                className="flex items-center space-x-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Intake New Batch</span>
              </button>
            )}
          </div>
        </div>

        {/* 8 Blood Groups Status Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {BLOOD_GROUPS.map((bg) => {
            const count = groupStockMap[bg] || 0;
            const isCritical = count <= 2;
            const isLow = count > 2 && count <= 5;

            return (
              <div
                key={bg}
                className={`p-3 rounded-xl border transition-all ${
                  isCritical
                    ? 'bg-rose-50/70 border-rose-300 shadow-sm shadow-rose-200'
                    : isLow
                    ? 'bg-amber-50/70 border-amber-300'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-base font-extrabold text-slate-900">{bg}</span>
                  {isCritical ? (
                    <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping"></span>
                  ) : isLow ? (
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  )}
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-black text-slate-900">{count}</span>
                  <span className="text-[10px] text-slate-500 font-medium">units</span>
                </div>
                <div className="mt-1">
                  <span
                    className={`inline-block text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                      isCritical
                        ? 'bg-rose-200/80 text-rose-800'
                        : isLow
                        ? 'bg-amber-200/80 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {isCritical ? 'CRITICAL' : isLow ? 'LOW STOCK' : 'ADEQUATE'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-1.5 text-xs font-medium text-slate-600">
            <SlidersHorizontal className="w-4 h-4 text-slate-400" />
            <span>Filters:</span>
          </div>

          {/* Facility Filter */}
          <select
            value={selectedHospital}
            onChange={(e) => setSelectedHospital(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700"
          >
            <option value="all">All Facilities ({hospitals.length})</option>
            {hospitals.map((h) => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>

          {/* Blood Group Filter */}
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700"
          >
            <option value="all">All Blood Groups</option>
            {BLOOD_GROUPS.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>

          {/* Component Filter */}
          <select
            value={selectedComponent}
            onChange={(e) => setSelectedComponent(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700"
          >
            <option value="all">All Components</option>
            {BLOOD_COMPONENTS.map((c) => (
              <option key={c} value={c}>{BLOOD_COMPONENT_LABELS[c]}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700"
          >
            <option value="all">All Statuses</option>
            <option value="available">Available</option>
            <option value="reserved">Reserved</option>
            <option value="quarantined">Quarantined</option>
            <option value="expired">Expired</option>
          </select>
        </div>

        <span className="text-xs text-slate-500 font-medium">
          Showing <span className="font-bold text-slate-800">{filteredInventory.length}</span> batch records
        </span>
      </div>

      {/* Main Inventory Batch Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Group</th>
                <th className="px-4 py-3">Component</th>
                <th className="px-4 py-3">Facility / Blood Bank</th>
                <th className="px-4 py-3">Units</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Batch & Vault Location</th>
                <th className="px-4 py-3">Expiry Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    No blood inventory batches match your active filter criteria.
                  </td>
                </tr>
              ) : (
                filteredInventory.map((item) => {
                  const isAvailable = item.status === 'available';
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3 font-bold text-slate-900">
                        <span className="inline-block px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 text-xs font-black">
                          {item.bloodGroup}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700 font-medium">
                        {BLOOD_COMPONENT_LABELS[item.component as keyof typeof BLOOD_COMPONENT_LABELS] || item.component}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {item.hospitalName || 'Verified Regional Center'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-bold text-slate-900">{item.unitsCount}</span> units
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            item.status === 'available'
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.status === 'reserved'
                              ? 'bg-indigo-100 text-indigo-800'
                              : item.status === 'quarantined'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                        <div>{item.batchNumber}</div>
                        <div className="text-[10px] text-slate-400 font-sans">{item.storageLocation || 'Bay 1'}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {item.expiryDate}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {(userRole === 'hospital_staff' || userRole === 'admin') ? (
                          <div className="flex items-center justify-end space-x-1.5">
                            {isAvailable && (
                              <button
                                onClick={() => handleOpenAdjust(item, 'reserve')}
                                className="px-2 py-1 text-[11px] font-semibold rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition"
                              >
                                Reserve
                              </button>
                            )}
                            <button
                              onClick={() => handleOpenAdjust(item, 'issue')}
                              className="px-2 py-1 text-[11px] font-semibold rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition"
                            >
                              Issue
                            </button>
                            <button
                              onClick={() => handleOpenAdjust(item, 'quarantine')}
                              className="px-2 py-1 text-[11px] font-semibold rounded bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition"
                            >
                              Quarantine
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Staff Auth Required</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjust Inventory Modal */}
      {adjustModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <ArrowRightLeft className="w-5 h-5 text-rose-600" />
                <h3 className="font-bold text-slate-900">Atomic Stock Adjustment</h3>
              </div>
              <button onClick={() => setAdjustModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={submitAdjust} className="mt-4 space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1">
                <div className="font-medium text-slate-700">Batch: <span className="font-mono text-slate-900">{selectedItem.batchNumber}</span></div>
                <div className="text-slate-600">Product: <span className="font-bold text-slate-900">{selectedItem.bloodGroup}</span> {selectedItem.component}</div>
                <div className="text-slate-600">Current Stock: <span className="font-bold text-slate-900">{selectedItem.unitsCount} units</span> ({selectedItem.status})</div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Action</label>
                <select
                  value={adjustAction}
                  onChange={(e) => setAdjustAction(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-200 p-2.5 bg-white font-medium"
                >
                  <option value="reserve">Reserve for Patient Request</option>
                  <option value="issue">Issue / Dispense to Operating Room</option>
                  <option value="quarantine">Quarantine for Safety Investigation</option>
                  <option value="expire">Mark Expired / Biohazard Disposal</option>
                  <option value="add">Add Units to Batch</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Quantity of Units</label>
                <input
                  type="number"
                  min="1"
                  max={adjustAction === 'add' ? 50 : selectedItem.unitsCount}
                  value={adjustUnits}
                  onChange={(e) => setAdjustUnits(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full text-xs rounded-lg border border-slate-200 p-2.5"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Clinical / Audit Justification</label>
                <textarea
                  rows={2}
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Required clinical rationale for regulatory audit trail..."
                  className="w-full text-xs rounded-lg border border-slate-200 p-2.5"
                  required
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? 'Processing Transaction...' : 'Commit Atomic Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Batch Modal */}
      {addBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Plus className="w-5 h-5 text-rose-600" />
                <h3 className="font-bold text-slate-900">Intake Verified Blood Batch</h3>
              </div>
              <button onClick={() => setAddBatchModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={submitNewBatch} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Receiving Blood Bank / Hospital</label>
                <select
                  value={newBatch.hospitalId}
                  onChange={(e) => setNewBatch({ ...newBatch, hospitalId: e.target.value })}
                  className="w-full text-xs rounded-lg border border-slate-200 p-2 bg-white"
                >
                  {hospitals.map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Blood Group</label>
                  <select
                    value={newBatch.bloodGroup}
                    onChange={(e) => setNewBatch({ ...newBatch, bloodGroup: e.target.value })}
                    className="w-full text-xs rounded-lg border border-slate-200 p-2 bg-white"
                  >
                    {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Units Count</label>
                  <input
                    type="number"
                    min="1"
                    value={newBatch.unitsCount}
                    onChange={(e) => setNewBatch({ ...newBatch, unitsCount: parseInt(e.target.value) || 1 })}
                    className="w-full text-xs rounded-lg border border-slate-200 p-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Component</label>
                <select
                  value={newBatch.component}
                  onChange={(e) => setNewBatch({ ...newBatch, component: e.target.value })}
                  className="w-full text-xs rounded-lg border border-slate-200 p-2 bg-white"
                >
                  {BLOOD_COMPONENTS.map((c) => (
                    <option key={c} value={c}>{BLOOD_COMPONENT_LABELS[c]}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Batch Number</label>
                  <input
                    type="text"
                    value={newBatch.batchNumber}
                    onChange={(e) => setNewBatch({ ...newBatch, batchNumber: e.target.value })}
                    className="w-full text-xs rounded-lg border border-slate-200 p-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Storage Location</label>
                  <input
                    type="text"
                    value={newBatch.storageLocation}
                    onChange={(e) => setNewBatch({ ...newBatch, storageLocation: e.target.value })}
                    className="w-full text-xs rounded-lg border border-slate-200 p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Collection Date</label>
                  <input
                    type="date"
                    value={newBatch.collectionDate}
                    onChange={(e) => setNewBatch({ ...newBatch, collectionDate: e.target.value })}
                    className="w-full text-xs rounded-lg border border-slate-200 p-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={newBatch.expiryDate}
                    onChange={(e) => setNewBatch({ ...newBatch, expiryDate: e.target.value })}
                    className="w-full text-xs rounded-lg border border-slate-200 p-2"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setAddBatchModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm"
                >
                  {isSubmitting ? 'Registering...' : 'Register Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
