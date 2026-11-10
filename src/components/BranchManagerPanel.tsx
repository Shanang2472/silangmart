/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { BranchRecord } from '../types';
import {
  GitBranch,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  MapPin,
  AlertTriangle,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface BranchManagerPanelProps {
  branches: BranchRecord[];
  onBranchesChanged: () => void; // triggers parent to refresh branches from API
}

interface FormState {
  name: string;
  address: string;
  lat: string;
  lng: string;
}

const defaultForm: FormState = { name: '', address: '', lat: '', lng: '' };

export default function BranchManagerPanel({ branches, onBranchesChanged }: BranchManagerPanelProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<FormState>(defaultForm);
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<FormState>(defaultForm);
  const [editError, setEditError] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  const [deleteError, setDeleteError] = useState<Record<number, string>>({});
  const [deleteLoading, setDeleteLoading] = useState<Record<number, boolean>>({});
  const [expandedBreakdown, setExpandedBreakdown] = useState<Record<number, boolean>>({});

  // ── Add Branch ──────────────────────────────────────────────────────────
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    if (!addForm.name.trim()) {
      setAddError('Branch name is required.');
      return;
    }
    setAddLoading(true);
    try {
      const res = await fetch('/api/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addForm.name.trim(),
          address: addForm.address.trim(),
          lat: parseFloat(addForm.lat) || 0,
          lng: parseFloat(addForm.lng) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error || 'Failed to add branch.');
      } else {
        setAddForm(defaultForm);
        setShowAddForm(false);
        onBranchesChanged();
      }
    } catch (err: any) {
      setAddError(err.message || 'Network error.');
    } finally {
      setAddLoading(false);
    }
  };

  // ── Edit Branch ──────────────────────────────────────────────────────────
  const startEdit = (b: BranchRecord) => {
    setEditingId(b.id);
    setEditForm({ name: b.name, address: b.address, lat: String(b.lat), lng: String(b.lng) });
    setEditError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditError('');
  };

  const handleEditSubmit = async (id: number) => {
    setEditError('');
    if (!editForm.name.trim()) {
      setEditError('Branch name is required.');
      return;
    }
    setEditLoading(true);
    try {
      const res = await fetch(`/api/branches/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name.trim(),
          address: editForm.address.trim(),
          lat: parseFloat(editForm.lat) || 0,
          lng: parseFloat(editForm.lng) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error || 'Failed to update branch.');
      } else {
        setEditingId(null);
        onBranchesChanged();
      }
    } catch (err: any) {
      setEditError(err.message || 'Network error.');
    } finally {
      setEditLoading(false);
    }
  };

  // ── Toggle Active ─────────────────────────────────────────────────────────
  const handleToggleActive = async (b: BranchRecord) => {
    try {
      await fetch(`/api/branches/${b.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !b.is_active }),
      });
      onBranchesChanged();
    } catch {/* ignore */}
  };

  // ── Delete Branch ─────────────────────────────────────────────────────────
  const handleDelete = async (b: BranchRecord) => {
    setDeleteError(prev => ({ ...prev, [b.id]: '' }));
    if (!window.confirm(`Delete branch "${b.name}"? This cannot be undone.`)) return;
    setDeleteLoading(prev => ({ ...prev, [b.id]: true }));
    try {
      const res = await fetch(`/api/branches/${b.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        const blockDetail = data.blockers ? `\n• ${data.blockers.join('\n• ')}` : '';
        setDeleteError(prev => ({
          ...prev,
          [b.id]: `${data.error || 'Cannot delete.'}${blockDetail ? '\n\nLinked records:' + blockDetail : ''}`,
        }));
      } else {
        onBranchesChanged();
      }
    } catch (err: any) {
      setDeleteError(prev => ({ ...prev, [b.id]: err.message || 'Network error.' }));
    } finally {
      setDeleteLoading(prev => ({ ...prev, [b.id]: false }));
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 to-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/30">
            <GitBranch className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-black text-white uppercase tracking-tight">
              Branch Management
            </h2>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Add, rename, and remove store branches
            </p>
          </div>
        </div>
        <button
          onClick={() => { setShowAddForm(v => !v); setAddError(''); setAddForm(defaultForm); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
            showAddForm
              ? 'bg-slate-700 text-slate-300'
              : 'bg-orange-500 text-white hover:bg-orange-600 shadow-md shadow-orange-500/30'
          }`}
        >
          {showAddForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showAddForm ? 'Cancel' : 'Add Branch'}
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <form
          onSubmit={handleAddSubmit}
          className="px-6 py-5 border-b border-slate-100 bg-orange-50/40 space-y-4"
        >
          <p className="text-[10px] text-orange-700 font-black uppercase tracking-widest">
            🏪 New Branch Details
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[9px] text-slate-400 font-extrabold uppercase tracking-widest mb-1">
                Branch Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Sabutan Branch"
                value={addForm.name}
                onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
              />
            </div>
            <div>
              <label className="block text-[9px] text-slate-400 font-extrabold uppercase tracking-widest mb-1">
                Address
              </label>
              <input
                type="text"
                placeholder="e.g. Brgy. Sabutan, Your City"
                value={addForm.address}
                onChange={e => setAddForm(p => ({ ...p, address: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
              />
            </div>
            <div>
              <label className="block text-[9px] text-slate-400 font-extrabold uppercase tracking-widest mb-1">
                Latitude
              </label>
              <input
                type="number"
                step="0.00001"
                placeholder="14.2235"
                value={addForm.lat}
                onChange={e => setAddForm(p => ({ ...p, lat: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
              />
            </div>
            <div>
              <label className="block text-[9px] text-slate-400 font-extrabold uppercase tracking-widest mb-1">
                Longitude
              </label>
              <input
                type="number"
                step="0.00001"
                placeholder="120.9739"
                value={addForm.lng}
                onChange={e => setAddForm(p => ({ ...p, lng: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
              />
            </div>
          </div>
          {addError && (
            <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg border border-red-100 text-xs text-red-700 font-medium whitespace-pre-line">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              {addError}
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={addLoading}
              className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white font-black uppercase text-xs px-4 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-60 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              {addLoading ? 'Adding...' : 'Add Branch'}
            </button>
            <button
              type="button"
              onClick={() => { setShowAddForm(false); setAddError(''); }}
              className="text-xs font-black uppercase text-slate-500 hover:text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Branch Table */}
      <div className="overflow-x-auto">
        {branches.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <GitBranch className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-black uppercase tracking-wider text-slate-400">No branches found</p>
            <p className="text-xs text-slate-400 mt-1">Add your first branch using the button above.</p>
          </div>
        ) : (
          <table className="w-full text-left text-xs text-slate-600 min-w-[640px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-400 font-black uppercase tracking-widest">
              <tr>
                <th className="px-5 py-3">Branch Name</th>
                <th className="px-5 py-3">Address</th>
                <th className="px-5 py-3">GPS Coordinates</th>
                <th className="px-5 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-center">Records</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {branches.map(branch => {
                const isEditing = editingId === branch.id;
                const delErr = deleteError[branch.id];
                const delLoading = deleteLoading[branch.id];
                const showBreakdown = expandedBreakdown[branch.id];
                const totalRec = (branch as any).totalRecords ?? 0;
                const breakdown = (branch as any).breakdown ?? {};

                return (
                  <React.Fragment key={branch.id}>
                    <tr className={`transition-colors ${isEditing ? 'bg-orange-50/50' : 'hover:bg-slate-50/70'}`}>
                      {/* Name */}
                      <td className="px-5 py-3.5">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                            className="w-full border border-orange-300 rounded-lg px-2 py-1.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${branch.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                            <span className="font-extrabold text-slate-800">{branch.name}</span>
                          </div>
                        )}
                      </td>

                      {/* Address */}
                      <td className="px-5 py-3.5 text-slate-500 max-w-[180px]">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.address}
                            onChange={e => setEditForm(p => ({ ...p, address: e.target.value }))}
                            className="w-full border border-orange-300 rounded-lg px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                          />
                        ) : (
                          <span className="truncate block" title={branch.address}>
                            {branch.address || <span className="italic text-slate-300">—</span>}
                          </span>
                        )}
                      </td>

                      {/* Coordinates */}
                      <td className="px-5 py-3.5">
                        {isEditing ? (
                          <div className="flex gap-1.5">
                            <input
                              type="number"
                              step="0.00001"
                              placeholder="Lat"
                              value={editForm.lat}
                              onChange={e => setEditForm(p => ({ ...p, lat: e.target.value }))}
                              className="w-24 border border-orange-300 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white"
                            />
                            <input
                              type="number"
                              step="0.00001"
                              placeholder="Lng"
                              value={editForm.lng}
                              onChange={e => setEditForm(p => ({ ...p, lng: e.target.value }))}
                              className="w-24 border border-orange-300 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-orange-600 font-mono font-bold text-[10px]">
                            <MapPin className="w-3 h-3 shrink-0" />
                            {branch.lat.toFixed(4)}, {branch.lng.toFixed(4)}
                          </div>
                        )}
                      </td>

                      {/* Status toggle */}
                      <td className="px-5 py-3.5 text-center">
                        <button
                          onClick={() => handleToggleActive(branch)}
                          className="inline-flex items-center gap-1 cursor-pointer"
                          title={branch.is_active ? 'Click to deactivate' : 'Click to activate'}
                        >
                          {branch.is_active ? (
                            <>
                              <ToggleRight className="w-5 h-5 text-emerald-500" />
                              <span className="text-[9px] font-black uppercase text-emerald-600">Active</span>
                            </>
                          ) : (
                            <>
                              <ToggleLeft className="w-5 h-5 text-slate-300" />
                              <span className="text-[9px] font-black uppercase text-slate-400">Inactive</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Record count */}
                      <td className="px-5 py-3.5 text-center">
                        <button
                          onClick={() => setExpandedBreakdown(p => ({ ...p, [branch.id]: !p[branch.id] }))}
                          className="inline-flex items-center gap-1 cursor-pointer group"
                        >
                          <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
                            totalRec > 0 ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-400'
                          }`}>
                            {totalRec}
                          </span>
                          {totalRec > 0 && (
                            showBreakdown
                              ? <ChevronUp className="w-3 h-3 text-slate-400" />
                              : <ChevronDown className="w-3 h-3 text-slate-400" />
                          )}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => handleEditSubmit(branch.id)}
                                disabled={editLoading}
                                className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black uppercase px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors disabled:opacity-60"
                              >
                                <Check className="w-3 h-3" />
                                {editLoading ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-black uppercase px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors"
                              >
                                <X className="w-3 h-3" />
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEdit(branch)}
                                className="flex items-center gap-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 text-[10px] font-black uppercase px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-blue-100"
                                title="Edit branch"
                              >
                                <Pencil className="w-3 h-3" />
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(branch)}
                                disabled={delLoading}
                                className="flex items-center gap-1 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-400 text-[10px] font-black uppercase px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-red-100 disabled:opacity-60"
                                title={totalRec > 0 ? `Cannot delete — ${totalRec} linked records` : 'Delete branch'}
                              >
                                <Trash2 className="w-3 h-3" />
                                {delLoading ? '...' : 'Delete'}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Inline edit error row */}
                    {isEditing && editError && (
                      <tr>
                        <td colSpan={6} className="px-5 pb-3">
                          <div className="flex items-center gap-2 p-2.5 bg-red-50 rounded-lg border border-red-100 text-xs text-red-700 font-medium">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                            {editError}
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* Delete error row */}
                    {delErr && (
                      <tr>
                        <td colSpan={6} className="px-5 pb-3">
                          <div className="flex items-start gap-2 p-2.5 bg-red-50 rounded-lg border border-red-100 text-xs text-red-700 font-medium whitespace-pre-line">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                            <div>
                              {delErr}
                              <button
                                className="ml-2 text-red-400 hover:text-red-600 underline cursor-pointer"
                                onClick={() => setDeleteError(p => ({ ...p, [branch.id]: '' }))}
                              >
                                Dismiss
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* Breakdown row */}
                    {showBreakdown && totalRec > 0 && (
                      <tr className="bg-slate-50/80">
                        <td colSpan={6} className="px-8 pb-3 pt-1">
                          <p className="text-[9px] text-slate-400 font-extrabold uppercase tracking-widest mb-1.5">
                            Linked Records Breakdown:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(breakdown).map(([label, count]) => (
                              <span
                                key={label}
                                className={`text-[10px] font-bold px-2 py-1 rounded-md ${
                                  (count as number) > 0
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-slate-100 text-slate-400'
                                }`}
                              >
                                {label}: {count as number}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2 text-[10px] text-slate-400 font-medium">
        <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
        <span>
          Branches with linked records cannot be deleted. Rename is safe — all references are automatically updated.
        </span>
      </div>
    </div>
  );
}
