/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Trash2,
  Lock,
  User,
  Shield,
  Truck,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';

interface UserRecord {
  id: number;
  name: string;
  username: string;
  role: 'admin' | 'cashier' | 'rider';
  status: 'active' | 'inactive';
  created_at: string;
}

interface StaffManagerPanelProps {
  onStaffListChanged?: () => void; // Notify App.tsx to refresh staff list in dropdowns
}

export default function StaffManagerPanel({ onStaffListChanged }: StaffManagerPanelProps) {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'cashier' | 'rider'>('cashier');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('silang_auth_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };
  };

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/users', {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to fetch users.');
      } else {
        setUsers(data.users || []);
      }
    } catch (err: any) {
      setError(err.message || 'Network error.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRegisterUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!name.trim() || !username.trim() || !password.trim()) {
      setFormError('Please fill in all fields.');
      return;
    }

    if (name.trim().length < 2) {
      setFormError('Name must be at least 2 characters.');
      return;
    }

    if (username.trim().length < 3) {
      setFormError('Username must be at least 3 characters.');
      return;
    }

    if (password.trim().length < 4) {
      setFormError('Password/PIN must be at least 4 characters.');
      return;
    }

    setFormLoading(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: name.trim(),
          username: username.trim().toLowerCase(),
          password: password.trim(),
          role
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Failed to register user.');
      } else {
        setFormSuccess('User registered successfully! 🎉');
        setName('');
        setUsername('');
        setPassword('');
        setRole('cashier');
        fetchUsers();
        if (onStaffListChanged) {
          onStaffListChanged();
        }
      }
    } catch (err: any) {
      setFormError(err.message || 'Network error.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteUser = async (id: number, uName: string) => {
    const activeUser = JSON.parse(localStorage.getItem('silang_logged_in_user') || '{}');
    
    if (uName === 'admin') {
      alert('Cannot delete the default admin account.');
      return;
    }

    if (uName === activeUser.username) {
      alert('You cannot delete your own logged-in admin account.');
      return;
    }

    if (!confirm(`Are you sure you want to delete user "${uName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to delete user.');
      } else {
        alert('User deleted successfully!');
        fetchUsers();
        if (onStaffListChanged) {
          onStaffListChanged();
        }
      }
    } catch (err: any) {
      alert(err.message || 'Network error.');
    }
  };

  const getRoleIcon = (userRole: string) => {
    switch (userRole) {
      case 'admin':
        return <Shield className="h-4 w-4 text-red-500" />;
      case 'rider':
        return <Truck className="h-4 w-4 text-blue-500" />;
      default:
        return <User className="h-4 w-4 text-green-500" />;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <div className="border-b border-slate-100 pb-4 mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
            <Users className="h-5 w-5 text-orange-500" />
            <span>Staff & Rider User Configurator</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Magrehistro at mamahala ng mga accounts para sa inyong Staff, Cashiers, at Delivery Riders.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Form (5 columns) */}
        <form onSubmit={handleRegisterUser} className="lg:col-span-5 space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-200">
          <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-2">
            <Plus className="h-4 w-4 text-orange-500" />
            <span>Mag-Register ng Bagong Account</span>
          </h3>

          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs font-bold flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {formSuccess && (
            <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-xs font-bold flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span>{formSuccess}</span>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-[9px] text-slate-400 font-extrabold uppercase tracking-widest mb-1">
                Buong Pangalan (Display Name):
              </label>
              <input
                type="text"
                required
                placeholder="Hal. Ate Lorna (Cashier)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 font-bold outline-none focus:border-orange-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-[9px] text-slate-400 font-extrabold uppercase tracking-widest mb-1">
                Username (Pang-Login):
              </label>
              <input
                type="text"
                required
                placeholder="Hal. lorna"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 font-bold outline-none focus:border-orange-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-[9px] text-slate-400 font-extrabold uppercase tracking-widest mb-1">
                Password / PIN:
              </label>
              <input
                type="text"
                required
                placeholder="Hal. 1234 o MyPassword123"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 font-mono font-bold outline-none focus:border-orange-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-[9px] text-slate-400 font-extrabold uppercase tracking-widest mb-1">
                Tungkulin (Role):
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 font-bold outline-none focus:border-orange-500 transition-colors"
              >
                <option value="cashier">Cashier / Staff</option>
                <option value="rider">Delivery Rider</option>
                <option value="admin">System Admin</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={formLoading}
            className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {formLoading ? 'Nagsesave...' : 'I-Register Account'}
          </button>
        </form>

        {/* Right Directory Table (7 columns) */}
        <div className="lg:col-span-7 space-y-3">
          <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Lock className="h-4 w-4 text-orange-500" />
            <span>Aktibong User Accounts Directory ({users.length})</span>
          </h3>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs font-bold">
              {error}
            </div>
          )}

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Naglo-load ng mga accounts...
              </div>
            ) : users.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Walang nahanap na staff or rider accounts.
              </div>
            ) : (
              <table className="w-full text-xs text-left text-slate-500 bg-white">
                <thead className="text-[9px] uppercase font-black tracking-widest text-slate-400 bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Pangalan</th>
                    <th className="px-4 py-3">Username</th>
                    <th className="px-4 py-3">Tungkulin</th>
                    <th className="px-4 py-3 text-center">Aksyon</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => {
                    const isProtected = u.username === 'admin';
                    
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 font-extrabold text-slate-800">
                          {u.name}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold">
                          {u.username}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 font-bold text-[10px] uppercase">
                            {getRoleIcon(u.role)}
                            <span>{u.role === 'admin' ? 'Admin' : u.role === 'rider' ? 'Rider' : 'Cashier'}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(u.id, u.username)}
                            disabled={isProtected}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              isProtected
                                ? 'bg-slate-50 border-slate-100 text-slate-350 cursor-not-allowed'
                                : 'bg-red-50 border-red-100 hover:bg-red-100 text-red-500 hover:text-red-700 cursor-pointer'
                            }`}
                            title={isProtected ? 'Protected System Account' : 'Delete Account'}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
