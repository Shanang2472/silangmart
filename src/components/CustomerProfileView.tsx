/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Camera, Eye, EyeOff } from 'lucide-react';
import { Branch } from '../types';
import DeliveryMap from './DeliveryMap';

interface ActiveCustomer {
  name: string;
  phone: string;
  barangay: string;
  address: string;
  coordinates: [number, number];
  pin?: string;
  storeImage?: string | null;
}

interface CustomerProfileViewProps {
  activeCustomer: ActiveCustomer;
  selectedBranch: Branch;
  branchCoordinates: Record<string, [number, number]>;
  onRefreshData?: () => void;
}

export default function CustomerProfileView({
  activeCustomer,
  selectedBranch,
  branchCoordinates,
  onRefreshData,
}: CustomerProfileViewProps) {
  // Local state for all profile fields (matches original CustomerPortal state)
  const [profilePhone, setProfilePhone] = useState(activeCustomer.phone || '');
  const [profileBarangay, setProfileBarangay] = useState(activeCustomer.barangay || '');
  const [profileAddress, setProfileAddress] = useState(activeCustomer.address || '');
  const [profileCoords, setProfileCoords] = useState<[number, number]>(
    activeCustomer.coordinates || [14.2244, 120.9752]
  );
  const [profilePin, setProfilePin] = useState('');
  const [profileStoreImage, setProfileStoreImage] = useState<string | null>(
    activeCustomer.storeImage || null
  );
  const [isUploadingProfileImage, setIsUploadingProfileImage] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [showProfilePassword, setShowProfilePassword] = useState(false);

  // Sync from parent whenever activeCustomer changes (same deps as original)
  React.useEffect(() => {
    if (activeCustomer) {
      setProfilePhone(activeCustomer.phone || '');
      setProfileBarangay(activeCustomer.barangay || '');
      setProfileAddress(activeCustomer.address || '');
      setProfileCoords(activeCustomer.coordinates || [14.2244, 120.9752]);
      setProfilePin(''); // Never pre-fill password for security
      setProfileStoreImage(activeCustomer.storeImage || null);
    }
  }, [
    activeCustomer.name,
    activeCustomer.phone,
    activeCustomer.barangay,
    activeCustomer.address,
    activeCustomer.coordinates,
    activeCustomer.pin,
    activeCustomer.storeImage,
  ]);

  // Handle store image upload (POST /api/customers/upload-store-image)
  const handleProfileImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('storeImage', file);

    setIsUploadingProfileImage(true);
    try {
      const res = await fetch('/api/customers/upload-store-image', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('silang_auth_token')}`,
        },
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        setProfileStoreImage(data.imageUrl);
        alert(
          'Matagumpay na na-upload ang litrato ng tindahan! Mangyaring i-click ang "Save Settings Changes" button sa ibaba upang mai-save ang inyong profile.'
        );
      } else {
        alert(data.error || 'Magka-error sa pag-upload ng litrato.');
      }
    } catch (err: unknown) {
      console.error(err);
      alert('Network error during store image upload.');
    } finally {
      setIsUploadingProfileImage(false);
    }
  };

  // Save profile (PUT /api/customers/profile)
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profilePin.trim().length > 0 && profilePin.trim().length < 4) {
      alert('Ang Password/PIN ay dapat hindi bababa sa 4 na characters!');
      return;
    }

    setIsSavingProfile(true);
    try {
      const res = await fetch('/api/customers/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('silang_auth_token')}`,
        },
        body: JSON.stringify({
          phone: profilePhone,
          barangay: profileBarangay,
          address: profileAddress,
          lat: profileCoords[0],
          lng: profileCoords[1],
          storeImage: profileStoreImage,
          pin: profilePin,
        }),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        alert('Matagumpay na na-save ang inyong Profile Settings! 🎉');
        if (onRefreshData) {
          onRefreshData();
        }
      } else {
        alert(data.error || 'Magka-error sa pag-save ng profile.');
      }
    } catch (err: unknown) {
      console.error(err);
      alert('Network error during profile update.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
      <div className="border-b border-slate-100 pb-3">
        <h3 className="text-lg font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <span>⚙️</span> Aking Profile at Settings ng Tindahan
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Pamahalaan ang mga detalye ng inyong store profile, lokasyon sa mapa, security PIN, at
          store picture para sa delivery rider.
        </p>
      </div>

      <form onSubmit={handleSaveProfile} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Inputs (7 columns) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Customer name (read-only) */}
              <div>
                <label className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mb-1.5">
                  Pangalan ng Tindahan / Customer Name:
                </label>
                <input
                  type="text"
                  disabled
                  value={activeCustomer.name}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-500 rounded-xl px-3.5 py-2.5 text-xs font-bold outline-none cursor-not-allowed"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mb-1.5">
                  Numero ng Telepono:
                </label>
                <input
                  type="text"
                  required
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 font-bold outline-none focus:border-[--color-silang-orange] focus:bg-white transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Barangay */}
              <div>
                <label className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mb-1.5">
                  Barangay:
                </label>
                <input
                  type="text"
                  required
                  value={profileBarangay}
                  onChange={(e) => setProfileBarangay(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 font-bold outline-none focus:border-[--color-silang-orange] focus:bg-white transition-all"
                />
              </div>

              {/* Password / PIN */}
              <div>
                <label className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mb-1.5">
                  Baguhin ang Password / PIN:
                </label>
                <div className="relative">
                  <input
                    type={showProfilePassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={profilePin}
                    onChange={(e) => setProfilePin(e.target.value)}
                    placeholder="Mag-type kung gusto mong palitan..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-slate-700 font-mono font-bold outline-none focus:border-[--color-silang-orange] focus:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowProfilePassword(!showProfilePassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showProfilePassword ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
                <p className="text-[9px] text-slate-400 mt-1">
                  💡 Pwede maging 4-digit PIN (e.g. 1234) o buong password (e.g. MyPass123).
                </p>
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mb-1.5">
                Detalyadong Address ng Tindahan:
              </label>
              <textarea
                required
                rows={2}
                value={profileAddress}
                onChange={(e) => setProfileAddress(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-700 font-bold outline-none focus:border-[--color-silang-orange] focus:bg-white transition-all resize-none"
              />
            </div>

            {/* Store image upload */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-left space-y-1">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">
                  Litrato ng Tindahan (Store Picture)
                </span>
                <p className="text-[10px] text-slate-500 leading-tight">
                  I-upload ang harap ng inyong tindahan para sa paggabay sa delivery driver kapag
                  ihahatid na ang inyong orders.
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <label className="bg-white hover:bg-slate-100 border border-slate-200 shadow-sm rounded-xl px-4 py-2 text-xs text-slate-700 font-extrabold cursor-pointer transition-all active:scale-[0.98] flex items-center gap-2">
                  <Camera className="h-4 w-4 text-[--color-silang-orange]" />
                  <span>{isUploadingProfileImage ? 'Uploading...' : 'Pumili ng Larawan'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleProfileImageUpload}
                    disabled={isUploadingProfileImage}
                  />
                </label>

                {profileStoreImage && (
                  <div className="w-12 h-12 rounded-xl border border-slate-200 overflow-hidden relative group">
                    <img
                      src={profileStoreImage}
                      alt="Store Preview"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setProfileStoreImage(null)}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[9px] font-bold transition-all cursor-pointer"
                    >
                      Tanggalin
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Location tip */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[10px] text-amber-700 flex items-start gap-2">
              <span className="text-xs">💡</span>
              <span>
                <strong>Tips sa Lokasyon:</strong> Siguraduhing tama ang pagkakalagay ng inyong
                delivery coordinate pin sa mapa sa kanan. Ito ang gagamiting destinasyon sa
                aktwal na GPS tracking ng rider habang nasa biyahe.
              </span>
            </div>
          </div>

          {/* Right: Map + store preview card (5 columns) */}
          <div className="lg:col-span-5 space-y-4">
            <div>
              <label className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-widest leading-none mb-1.5">
                I-pin ang Lokasyon sa Mapa:
              </label>
              <p className="text-[9px] text-slate-400 mb-2">
                I-click sa mapa upang baguhin ang GPS target coordinates ng inyong tindahan.
              </p>

              <div className="h-[250px] rounded-2xl overflow-hidden border border-slate-200 relative bg-slate-100">
                <DeliveryMap
                  activeDelivery={null}
                  branchCoordinates={branchCoordinates}
                  onMapClick={(lat, lng) => {
                    setProfileCoords([lat, lng]);
                  }}
                  height="100%"
                  showSearch={true}
                  onLocationSelected={(lat, lng, address, barangay) => {
                    setProfileCoords([lat, lng]);
                    setProfileAddress(address);
                    if (barangay) {
                      setProfileBarangay(barangay);
                    }
                  }}
                />
              </div>

              <div className="mt-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] text-slate-500 font-mono flex items-center justify-between">
                <span>GPS Target Coordinates:</span>
                <span className="font-bold text-[--color-silang-orange]">
                  [{profileCoords[0].toFixed(6)}, {profileCoords[1].toFixed(6)}]
                </span>
              </div>
            </div>

            {/* Store preview card */}
            <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-3 shadow-md border border-slate-800">
              <span className="text-[8px] font-mono tracking-widest text-slate-400 block uppercase">
                STORE CARD PREVIEW FOR RIDER
              </span>
              <div className="flex gap-3 items-center">
                <div className="w-14 h-14 bg-slate-800 rounded-xl overflow-hidden shrink-0 border border-slate-700 flex items-center justify-center text-slate-400 text-xs font-bold font-sans">
                  {profileStoreImage ? (
                    <img
                      src={profileStoreImage}
                      alt="Store Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>🛒 No Image</span>
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-black text-white">{activeCustomer.name}</h4>
                  <p className="text-[10px] text-slate-400">{selectedBranch} Branch</p>
                  <p className="text-[9px] text-indigo-300 font-mono">
                    Barangay: {profileBarangay}
                  </p>
                </div>
              </div>
              <div className="text-[10px] text-slate-300 bg-slate-950/40 p-2.5 rounded border border-slate-800 font-sans">
                <span className="font-extrabold text-slate-400 block uppercase text-[8px]">
                  Delivery Address:
                </span>
                <p className="mt-0.5">{profileAddress || 'Ilagay ang detailed address...'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="submit"
            disabled={isSavingProfile || isUploadingProfileImage}
            className="bg-[--color-silang-orange] hover:opacity-90 text-white font-extrabold px-6 py-3 rounded-xl text-xs uppercase tracking-widest transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSavingProfile ? 'Isinesave...' : 'Save Settings Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
