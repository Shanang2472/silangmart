/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { 
  Lock, 
  Shield, 
  User, 
  Truck, 
  Store, 
  Eye, 
  EyeOff, 
  CheckCircle,
  Camera,
  Upload
} from 'lucide-react';
import DeliveryMap from './DeliveryMap';

interface LoginViewProps {
  onLoginSuccess: (user: { username: string; role: 'admin' | 'customer' | 'rider' | 'supplier'; name: string }) => void;
  customers: {
    name: string;
    phone: string;
    barangay: string;
    address: string;
    coordinates: [number, number];
    storeImage?: string | null;
    pin?: string;
  }[];
  onRegisterCustomer: (newCustomer: {
    name: string;
    phone: string;
    barangay: string;
    address: string;
    coordinates: [number, number];
    pin: string;
    storeImage: string | null;
  }) => Promise<any> | any;
  branchCoordinates: Record<string, [number, number]>;

  // Landing integration defaults
  defaultTab?: 'admin' | 'customer' | 'rider' | 'supplier';
  defaultMode?: 'login' | 'register'; // relevant for customer
  onClose?: () => void;
}

export default function LoginView({ 
  onLoginSuccess, 
  customers, 
  onRegisterCustomer,
  branchCoordinates,
  defaultTab = 'admin',
  defaultMode = 'login',
  onClose,
}: LoginViewProps) {
  const [activeTab, setActiveTab] = useState<'admin' | 'customer' | 'rider' | 'supplier'>(defaultTab);
  
  // Credentials input states
  const [selectedStaff, setSelectedStaff] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [customerPin, setCustomerPin] = useState('');

  // Register state
  const [isRegistering, setIsRegistering] = useState(defaultTab === 'customer' && defaultMode === 'register');
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regBarangay, setRegBarangay] = useState('Brgy. Sabutan');
  const [regAddress, setRegAddress] = useState('');
  const [regCoordinates, setRegCoordinates] = useState<[number, number]>([14.2238, 120.9747]);
  const [regPin, setRegPin] = useState('');
  const [regStoreImage, setRegStoreImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Riders should come from real DB/real users instead of hardcoded names.
  // The rider login uses user-provided input (`selectedRider`) to match DB records.
  const [selectedRider, setSelectedRider] = useState('');

  const [riderPin, setRiderPin] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [supplierPin, setSupplierPin] = useState('');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Customer name and PIN must be typed manually by the customer (no auto-fill for security)

  // Server-side authentication helper
  const performApiLogin = async (role: 'admin' | 'customer' | 'rider' | 'supplier', name: string, pin: string) => {
    setErrorMessage(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, name, password: pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Authentication failed.');
        return false;
      }
      localStorage.setItem('silang_auth_token', data.token);
      localStorage.setItem('silang_logged_in_user', JSON.stringify(data.user));
      onLoginSuccess(data.user);
      return true;
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error.');
      return false;
    }
  };

  // If defaults change (e.g., landing button switches modal defaults), sync them.
  React.useEffect(() => {
    setActiveTab(defaultTab);
    setIsRegistering(defaultTab === 'customer' && defaultMode === 'register');
    setErrorMessage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultTab, defaultMode]);

  // If opened from landing page, optionally close on successful login
  React.useEffect(() => {
    return () => {
      // noop (keeps component stable); onClose is handled inline after login
    };
  }, []);

  // Handle image upload during signup
  const handleStoreImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('storeImage', file);

    setIsUploading(true);
    try {
      const res = await fetch('/api/customers/upload-store-image', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        setRegStoreImage(data.imageUrl);
      } else {
        alert(data.error || 'Magka-error sa pag-upload ng litrato.');
      }
    } catch (err: any) {
      console.error(err);
      alert('Network error during image upload.');
    } finally {
      setIsUploading(false);
    }
  };

  // Validation & Login Action
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'admin') {
      await performApiLogin('admin', selectedStaff, adminPassword);
    } else if (activeTab === 'customer') {
      await performApiLogin('customer', selectedCustomer, customerPin);
    } else if (activeTab === 'rider') {
      await performApiLogin('rider', selectedRider, riderPin);
    } else if (activeTab === 'supplier') {
      await performApiLogin('supplier', selectedSupplier, supplierPin);
    }
  };

  // Register Submit handler
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regPhone.trim() || !regAddress.trim()) {
      alert('Mangyaring punan ang lahat ng impormasyon!');
      return;
    }

    if (customers.some(c => c.name.toLowerCase() === regName.trim().toLowerCase())) {
      alert('Ang pangalang ito ay mayroon nang account. Mangyaring gumamit ng iba o mag-login.');
      return;
    }

    const normalizedPin = regPin.trim();

    if (normalizedPin.length < 4) {
      setErrorMessage('Password/PIN ay dapat hindi bababa sa 4 na characters. Ikaw ay naglagay ng ' + normalizedPin.length + ' character(s) lamang.');
      return;
    }
    setErrorMessage(null);

    const newCust = {
      name: regName.trim(),
      phone: regPhone.trim(),
      barangay: regBarangay,
      address: regAddress.trim(),
      coordinates: regCoordinates,
      pin: normalizedPin,
      storeImage: regStoreImage,
    };

    const regResult = await (onRegisterCustomer(newCust) as Promise<any>);
    if (regResult && regResult.token) {
      localStorage.setItem('silang_auth_token', regResult.token);
      if (regResult.user) {
        localStorage.setItem('silang_logged_in_user', JSON.stringify(regResult.user));
      }
      alert(`Matagumpay ang pag-register! Welcome ${newCust.name}! 🎉`);
      setIsRegistering(false);
      onLoginSuccess(regResult.user);
    }
  };



  return (
    <div className="w-full bg-slate-950 flex flex-col items-center relative overflow-hidden">
      {/* Top-right close/back for modal */}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 z-[250] text-xs sm:text-sm text-slate-400 hover:text-white bg-slate-900/60 hover:bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 font-black"
        >
          Close
        </button>
      )}
      
      {/* Radiant Glowing Background Ambience */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-orange-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 left-10 w-[300px] h-[300px] bg-indigo-600/5 rounded-full blur-2xl pointer-events-none"></div>

      <div className={`w-full ${isRegistering && activeTab === 'customer' ? 'max-w-3xl' : 'max-w-md'} bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 space-y-6 transition-all duration-300 max-h-[78vh] overflow-y-auto`}> 
        
        {/* Portal Branding Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex w-14 h-14 bg-gradient-to-tr from-orange-500 to-amber-400 rounded-2xl items-center justify-center font-black text-2xl text-white shadow-lg shadow-orange-500/20">
            S
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white font-display tracking-tight uppercase">
            Silang Mini Mart Portal
          </h1>
          <p className="text-xs text-slate-400 font-medium">
            Mangyaring mag-log in gamit ang iyong tungkulin (user role) o magrehistro.
          </p>
        </div>

        {/* ROLE SELECTION TABS */}
        <div className="grid grid-cols-4 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => {
              setActiveTab('admin');
              setErrorMessage(null);
              setIsRegistering(false);
            }}
            className={`py-2 text-[10px] sm:text-xs font-black uppercase rounded-lg tracking-wide cursor-pointer transition-all flex flex-col items-center justify-center gap-1 ${
              activeTab === 'admin'
                ? 'bg-orange-500 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Store className="h-3.5 w-3.5" />
            <span>Staff</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('customer');
              setErrorMessage(null);
            }}
            className={`py-2 text-[10px] sm:text-xs font-black uppercase rounded-lg tracking-wide cursor-pointer transition-all flex flex-col items-center justify-center gap-1 ${
              activeTab === 'customer'
                ? 'bg-orange-500 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <User className="h-3.5 w-3.5" />
            <span>Customer</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('supplier');
              setErrorMessage(null);
              setIsRegistering(false);
            }}
            className={`py-2 text-[10px] sm:text-xs font-black uppercase rounded-lg tracking-wide cursor-pointer transition-all flex flex-col items-center justify-center gap-1 ${
              activeTab === 'supplier'
                ? 'bg-orange-500 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Truck className="h-3.5 w-3.5" />
            <span>Supplier</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('rider');
              setErrorMessage(null);
              setIsRegistering(false);
            }}
            className={`py-2 text-[10px] sm:text-xs font-black uppercase rounded-lg tracking-wide cursor-pointer transition-all flex flex-col items-center justify-center gap-1 ${
              activeTab === 'rider'
                ? 'bg-orange-500 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Truck className="h-3.5 w-3.5" />
            <span>Rider</span>
          </button>
        </div>

        {/* ERROR DISPLAY */}
        {errorMessage && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-3 text-xs font-medium text-center animate-pulse">
            ⚠️ {errorMessage}
          </div>
        )}

        {/* CREDENTIALS / REGISTRATION FORM */}
        {activeTab === 'customer' && isRegistering ? (
          <form onSubmit={handleRegisterSubmit} className="space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                <span>📝</span> Customer Sign-Up / Register
              </h3>
              <button
                type="button"
                onClick={() => setIsRegistering(false)}
                className="text-xs text-orange-400 hover:text-orange-350 underline font-extrabold cursor-pointer"
              >
                May account na? Login
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Profile Details Inputs */}
              <div className="space-y-3">
                <div>
                  <label className="block text-[9px] text-slate-400 font-extrabold uppercase tracking-widest mb-1">
                    Buong Pangalan:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Juan dela Cruz"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-bold outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-[9px] text-slate-400 font-extrabold uppercase tracking-widest mb-1">
                    Numero ng Telepono:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 09123456789"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-bold outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-[9px] text-slate-400 font-extrabold uppercase tracking-widest mb-1">
                    Barangay:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Brgy. Sabutan"
                    value={regBarangay}
                    onChange={(e) => setRegBarangay(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-bold outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-[9px] text-slate-400 font-extrabold uppercase tracking-widest mb-1">
                    Detalyadong Address (Tahanan/Kalye):
                  </label>
                  <textarea
                    required
                    rows={2}
                    placeholder="e.g. Block 4 Lot 10, Goldenville Subdivision, Silang..."
                    value={regAddress}
                    onChange={(e) => setRegAddress(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-bold outline-none focus:border-orange-500 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-[9px] text-slate-400 font-extrabold uppercase tracking-widest mb-1">
                    Password / PIN:
                  </label>
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    placeholder="e.g. 1234 o MyPassword123"
                    value={regPin}
                    onChange={(e) => setRegPin(e.target.value)}
                    className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2.5 text-xs text-white font-mono font-bold outline-none focus:border-orange-500 ${
                      regPin.length > 0 && regPin.trim().length < 4
                        ? 'border-red-500'
                        : 'border-slate-800'
                    }`}
                  />
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-[8px] text-slate-500">
                      💡 Pwede maging 4-digit PIN o buong password (letters + numbers).
                    </p>
                    {regPin.length > 0 && (
                      <span className={`text-[8px] font-black ${
                        regPin.trim().length >= 4 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {regPin.trim().length}/4+ chars
                      </span>
                    )}
                  </div>
                  {regPin.length > 0 && regPin.trim().length < 4 && (
                    <p className="text-[9px] text-red-400 font-bold mt-0.5">
                      ⚠️ Kailangan ng hindi bababa sa 4 na characters.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[9px] text-slate-400 font-extrabold uppercase tracking-widest mb-1">
                    Litrato ng Inyong Tindahan (Store Appearance):
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="flex-1 flex items-center justify-center gap-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 border-dashed rounded-xl px-3 py-2.5 text-xs text-slate-400 font-semibold cursor-pointer transition-all active:scale-[0.98]">
                      <Camera className="h-4 w-4 text-orange-500" />
                      <span>{isUploading ? 'Nag-a-upload...' : regStoreImage ? 'Palitan ang Larawan' : 'Mag-upload ng Litrato'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleStoreImageUpload}
                      />
                    </label>
                    {regStoreImage && (
                      <div className="w-10 h-10 rounded-xl border border-slate-800 overflow-hidden shrink-0">
                        <img src={regStoreImage} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[10px] text-slate-400 leading-none font-mono flex items-center justify-between">
                  <span>📍 GPS TARGET:</span>
                  <span className="text-orange-400 font-black">
                    [{regCoordinates[0].toFixed(5)}, {regCoordinates[1].toFixed(5)}]
                  </span>
                </div>
              </div>

              {/* Pin on Map Column */}
              <div className="flex flex-col space-y-2">
                <div>
                  <label className="block text-[9px] text-slate-400 font-extrabold uppercase tracking-widest leading-none">
                    I-click sa Mapa upang I-pin ang Lokasyon:
                  </label>
                  <p className="text-[8px] text-slate-500 mt-1">
                    I-zoom ang mapa at i-click ang tamang posisyon ng inyong tirahan para sa tamang delivery route tracking.
                  </p>
                </div>

                <div className="h-[200px] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 relative">
                  <DeliveryMap
                    activeDelivery={null}
                    branchCoordinates={branchCoordinates}
                    onMapClick={(lat, lng) => {
                      setRegCoordinates([lat, lng]);
                      // We can fall back to the text default here if needed, but onLocationSelected handles geocoding
                      if (!regAddress.trim()) {
                        setRegAddress(`Pinned Coordinate: [${lat.toFixed(5)}, ${lng.toFixed(5)}]`);
                      }
                    }}
                    height="100%"
                    showSearch={true}
                    onLocationSelected={(lat, lng, address, barangay) => {
                      setRegCoordinates([lat, lng]);
                      setRegAddress(address);
                      if (barangay) {
                        setRegBarangay(barangay);
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl text-xs sm:text-sm uppercase tracking-wider shadow-lg shadow-orange-500/10 hover:shadow-orange-500/20 transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-[0.98]"
            >
              <CheckCircle className="h-4 w-4" />
              <span>I-save Profile at Mag-login!</span>
            </button>
          </form>
        ) : (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {activeTab === 'admin' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mb-1.5">
                    Piliin ang Staff Account:
                  </label>
                  <input
                    type="text"
                    required
                    value={selectedStaff}
                    onChange={(e) => setSelectedStaff(e.target.value)}
                    placeholder="Ilagay ang Staff Username/Name"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-xs sm:text-sm text-white font-bold outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mb-1.5">
                    Password:
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Ilagay ang password..."
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3.5 pr-10 py-3 text-xs sm:text-sm text-white outline-none focus:border-orange-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'customer' && (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">
                      Customer Name:
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsRegistering(true)}
                      className="text-[10px] text-orange-400 hover:text-orange-350 font-black underline cursor-pointer"
                    >
                      Mag-Register New Profile 📝
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    autoComplete="off"
                    value={selectedCustomer}
                    onChange={(e) => setSelectedCustomer(e.target.value)}
                    placeholder="Ilagay ang iyong pangalan..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-xs sm:text-sm text-white font-bold outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mb-1.5">
                    PIN / Password:
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      placeholder="Ilagay ang iyong PIN o Password..."
                      value={customerPin}
                      onChange={(e) => setCustomerPin(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3.5 pr-10 py-3 text-xs sm:text-sm text-white outline-none focus:border-orange-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-[9px] text-slate-500 mt-1.5">
                    💡 Pwede ring PIN (4-digit) o ang password na ginamit sa pag-register.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'supplier' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mb-1.5">Supplier Username / Company Name:</label>
                  <input type="text" required value={selectedSupplier} onChange={(e) => setSelectedSupplier(e.target.value)} placeholder="Ilagay ang Supplier Username/Name" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-xs sm:text-sm text-white font-bold outline-none focus:border-orange-500" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mb-1.5">PIN / Password:</label>
                  <input type={showPassword ? 'text' : 'password'} required value={supplierPin} onChange={(e) => setSupplierPin(e.target.value)} placeholder="Ilagay ang Supplier Password/PIN" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-xs sm:text-sm text-white outline-none focus:border-orange-500" />
                </div>
              </div>
            )}

            {activeTab === 'rider' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mb-1.5">
                    Piliin ang Delivery Rider Profile:
                  </label>
                  <input
                    type="text"
                    required
                    value={selectedRider}
                    onChange={(e) => setSelectedRider(e.target.value)}
                    placeholder="Ilagay ang Rider Username/Name"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-xs sm:text-sm text-white font-bold outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mb-1.5">
                    PIN Code (4-Digits):
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    placeholder="Ilagay ang Rider Password/PIN"
                    value={riderPin}
                    onChange={(e) => setRiderPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-xs sm:text-sm text-center text-white outline-none focus:border-orange-500 font-mono tracking-[0.2em] text-sm font-black"
                  />
                </div>
              </div>
            )}

            {/* LOGIN SUBMIT BUTTON */}
            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl text-xs sm:text-sm uppercase tracking-wider shadow-lg shadow-orange-500/10 hover:shadow-orange-500/20 transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-[0.98]"
            >
              <Lock className="h-4 w-4" />
              <span>Mag-login sa System</span>
            </button>
          </form>
        )}



      </div>
    </div>
  );
}
