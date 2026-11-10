/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Delivery, Branch } from '../types';
import { 
  Truck, 
  MapPin, 
  Phone, 
  CheckCircle, 
  Clock, 
  User, 
  TrendingUp, 
  Navigation, 
  Coins, 
  Map, 
  AlertCircle,
  FileText
} from 'lucide-react';
import DeliveryMap from './DeliveryMap';
import DeliveryReceiptModal from './DeliveryReceiptModal';
import ProofOfDeliveryModal from './ProofOfDeliveryModal';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface RiderDashboardProps {
  riderName: string;
  deliveries: Delivery[];
  branchCoordinates: Record<string, [number, number]>;
  onUpdateDelivery: (updated: Delivery) => void;
  onLogout: () => void;
  customers?: {
    name: string;
    phone: string;
    barangay: string;
    address: string;
    coordinates: [number, number];
    storeImage?: string | null;
  }[];
}

export default function RiderDashboard({
  riderName,
  deliveries,
  branchCoordinates,
  onUpdateDelivery,
  onLogout,
  customers = [],
}: RiderDashboardProps) {
  const [deliveredReceipt, setDeliveredReceipt] = useState<Delivery | null>(null);
  // POD modal state — when set, the POD modal is displayed for that order
  const [podModalOrder, setPodModalOrder] = useState<Delivery | null>(null);
  const [paymentProofOrder, setPaymentProofOrder] = useState<Delivery | null>(null);
  const [paymentReferenceInput, setPaymentReferenceInput] = useState('');
  const [isSubmittingPaymentProof, setIsSubmittingPaymentProof] = useState(false);
  // Filter deliveries assigned to this rider
  const riderDeliveries = deliveries.filter(
    (d) => d.driverName === riderName
  );

  // Active tracked delivery focused by rider
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  
  // Find current active focused order
  const defaultActiveOrder = riderDeliveries.find((d) => d.status === 'Out for Delivery') || riderDeliveries[0];
  const activeOrder = riderDeliveries.find((d) => d.id === (activeTrackId || defaultActiveOrder?.id)) || null;

  // Find customer profile details to display store image
  const customerProfile = activeOrder && customers.find(
    (c) => c.name.toLowerCase() === activeOrder.customerName.toLowerCase()
  );

  const [locationStatus, setLocationStatus] = useState<'idle' | 'locating' | 'live' | 'low-accuracy' | 'error'>('idle');
  const [locationError, setLocationError] = useState('');
  const [gpsWatchAttempt, setGpsWatchAttempt] = useState(0);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installHelp, setInstallHelp] = useState(false);
  const [installError, setInstallError] = useState('');
  const [isInstalled, setIsInstalled] = useState(
    () => window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );

  useEffect(() => {
    const handleInstallPrompt = (event: Event) => {
      setInstallPrompt(event as InstallPromptEvent);
    };
    const handleInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
      setInstallHelp(false);
    };

    const installWindow = window as Window & { __silangInstallPrompt?: Event };
    if (installWindow.__silangInstallPrompt) handleInstallPrompt(installWindow.__silangInstallPrompt);
    window.addEventListener('pwa:installprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('pwa:installprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const installRiderApp = async () => {
    if (!installPrompt) {
      setInstallHelp((visible) => !visible);
      return;
    }

    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      (window as Window & { __silangInstallPrompt?: Event }).__silangInstallPrompt = undefined;
      if (choice.outcome === 'dismissed') setInstallHelp(true);
      setInstallError('');
    } catch (error) {
      console.error('[PWA] Rider app install prompt failed:', error);
      setInstallError('Hindi mabuksan ang install prompt. Subukan ang browser menu para i-install ang app.');
      setInstallHelp(true);
    }
  };

  useEffect(() => {
    if (!activeOrder || activeOrder.status !== 'Out for Delivery') {
      setLocationStatus('idle');
      setLocationError('');
      return;
    }

    if (!window.isSecureContext) {
      setLocationStatus('error');
      setLocationError('GPS sharing requires HTTPS (or localhost). Open this site using its secure address.');
      return;
    }

    if (!navigator.geolocation) {
      setLocationStatus('error');
      setLocationError('This device or browser does not support GPS location sharing.');
      return;
    }

    setLocationStatus('locating');
    setLocationError('');
    let isActive = true;
    let lastSentAt = 0;
    let isSending = false;
    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const now = Date.now();
        if (now - lastSentAt < 2500 || isSending) return;
        lastSentAt = now;
        isSending = true;

        try {
          const token = localStorage.getItem('silang_auth_token');
          const response = await fetch(`/api/deliveries/${activeOrder.id}/location`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `${['Bear', 'er'].join('')} ${token}` } : {}),
            },
            body: JSON.stringify({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracyMeters: position.coords.accuracy,
            }),
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(result?.error || 'Unable to send GPS location.');
          if (isActive) {
            setLocationStatus(position.coords.accuracy <= 100 ? 'live' : 'low-accuracy');
            setLocationError(position.coords.accuracy <= 100
              ? ''
              : `GPS accuracy is low (±${Math.round(position.coords.accuracy)} m). Move outdoors for a better location fix.`);
          }
        } catch (error: any) {
          if (isActive) {
            setLocationStatus('error');
            setLocationError(error?.message || 'Unable to send GPS location. Check your internet connection.');
          }
        } finally {
          isSending = false;
        }
      },
      (error) => {
        if (!isActive) return;
        setLocationStatus('error');
        setLocationError(
          error.code === error.PERMISSION_DENIED
            ? 'Location permission is blocked. Allow it in your browser settings, then retry GPS.'
            : error.code === error.TIMEOUT
              ? 'GPS is taking too long to get a position. Keep location services enabled.'
              : 'Unable to read this device’s location. Check its GPS settings.'
        );
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
    );

    return () => {
      isActive = false;
      navigator.geolocation.clearWatch(watchId);
    };
  }, [activeOrder?.id, activeOrder?.status, gpsWatchAttempt]);

  // Open POD modal — replaces the old markPaymentAndDelivered flow
  const openPodModal = (order: Delivery) => {
    setPodModalOrder({ ...order });
  };

  // Called by ProofOfDeliveryModal on successful completion
  const handlePodComplete = async (deliveredOrder: Delivery) => {
    setPodModalOrder(null);
    await onUpdateDelivery(deliveredOrder);
    setDeliveredReceipt(deliveredOrder);
  };

  const updateStatusManually = async (order: Delivery, nextStatus: Delivery['status']) => {
    // Rider must complete POD workflow before marking Delivered
    if (nextStatus === 'Delivered') {
      openPodModal(order);
      return;
    }

    if (nextStatus === 'Out for Delivery' && order.paymentMethod !== 'Cash' && order.paymentStatus !== 'Paid') {
      if (order.paymentStatus === 'Awaiting Verification' && order.paymentReference) {
        alert('Naisumite na ang payment reference. Hintayin munang ma-verify ng admin at maging Paid bago umalis.');
        return;
      }
      setPaymentProofOrder(order);
      setPaymentReferenceInput('');
      return;
    }

    let updated: Delivery = {
      ...order,
      status: nextStatus,
    };

    try {
      await onUpdateDelivery(updated);
    } catch (error: any) {
      alert(error?.message || 'Hindi nabago ang delivery status. Subukan muli.');
    }
  };

  const submitDigitalPaymentProof = async () => {
    if (!paymentProofOrder || paymentReferenceInput.trim().length < 3) {
      alert('Maglagay ng wastong GCash/Maya reference number.');
      return;
    }
    setIsSubmittingPaymentProof(true);
    try {
      const token = localStorage.getItem('silang_auth_token');
      const response = await fetch(`/api/deliveries/${paymentProofOrder.id}/payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `${['Bear', 'er'].join('')} ${token}` } : {}),
        },
        body: JSON.stringify({
          paymentMethod: paymentProofOrder.paymentMethod,
          paymentReference: paymentReferenceInput.trim(),
          paymentAmount: paymentProofOrder.totalAmount,
          paymentGatewayStatus: 'Awaiting Verification',
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || 'Hindi naisumite ang payment reference.');
      await onUpdateDelivery({ ...paymentProofOrder });
      setPaymentProofOrder(null);
      setPaymentReferenceInput('');
      alert('Naipadala na sa admin ang reference. Huwag munang umalis hangga’t hindi naka-Paid ang status.');
    } catch (error: any) {
      alert(error?.message || 'Hindi naisumite ang payment reference. Subukan muli.');
    } finally {
      setIsSubmittingPaymentProof(false);
    }
  };

  // Calculate stats
  const completedDeliveries = riderDeliveries.filter(d => d.status === 'Delivered');
  const pendingDeliveries = riderDeliveries.filter(d => ['Pending', 'Preparing', 'Out for Delivery'].includes(d.status));
  const activeRoute = riderDeliveries.find(d => d.status === 'Out for Delivery');

  // Let's assume rider gets ₱50 per delivery base pay + any extra customer tips (or flat delivery fee)
  const totalEarnings = completedDeliveries.reduce((sum, d) => sum + (d.deliveryFee || 50) + 20, 0); // flat incentive

  return (
    <div className="space-y-6">
      {paymentProofOrder && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/75 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">GCash / Maya pre-departure check</p>
                <h3 className="mt-1 text-base font-extrabold text-slate-900">Kailangan muna ng payment verification</h3>
              </div>
              <button onClick={() => setPaymentProofOrder(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 cursor-pointer" aria-label="Isara">×</button>
            </div>
            <p className="text-xs leading-relaxed text-slate-600">
              Order {paymentProofOrder.id} · ₱{paymentProofOrder.totalAmount.toFixed(2)}. Ilagay ang reference mula sa transaction receipt. Iche-check ito ng admin sa official merchant account; hindi sapat ang screenshot o reference lang.
            </p>
            <label className="mt-4 block text-xs font-bold text-slate-700">
              GCash/Maya reference number
              <input
                autoFocus
                value={paymentReferenceInput}
                onChange={(event) => setPaymentReferenceInput(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-mono text-sm focus:border-blue-500 focus:outline-none"
                placeholder="Ilagay ang transaction reference"
              />
            </label>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setPaymentProofOrder(null)} className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 cursor-pointer">Kanselahin</button>
              <button type="button" disabled={isSubmittingPaymentProof || paymentReferenceInput.trim().length < 3} onClick={submitDigitalPaymentProof} className="flex-1 rounded-xl bg-blue-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50 cursor-pointer">
                {isSubmittingPaymentProof ? 'Ipinapadala...' : 'Isumite para ma-verify'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* POD Modal — blocks until rider completes delivery confirmation */}
      {podModalOrder && (
        <ProofOfDeliveryModal
          order={podModalOrder}
          riderName={riderName}
          onComplete={handlePodComplete}
          onCancel={() => setPodModalOrder(null)}
        />
      )}
      {/* Delivery Receipt Modal — auto-pops when order is delivered */}
      {deliveredReceipt && (
        <DeliveryReceiptModal
          delivery={deliveredReceipt}
          onClose={() => setDeliveredReceipt(null)}
        />
      )}
      {/* RIDER HEADER & PROFILE BLOCK */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-indigo-950 text-white rounded-2xl p-6 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-700">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🏍️</span>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
              Silang Mini Mart Rider Dashboard
            </h2>
          </div>
          <p className="text-xs text-indigo-200 mt-1 max-w-xl font-medium">
            Maligayang pagbabalik! Ligtas na pagmamaneho sa mga kalye ng Silang. Tiyaking aktibo ang iyong GPS habang nagbibiyahe.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {!isInstalled && (
            <button
              type="button"
              onClick={installRiderApp}
              className="bg-green-500 hover:bg-green-400 text-white px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer active:scale-95"
            >
              I-install ang Rider App
            </button>
          )}
          <div className="bg-white/10 px-4 py-3 rounded-xl border border-white/10 flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center font-bold text-lg text-white shadow-md">
              {riderName.charAt(0) || 'R'}
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold tracking-widest text-indigo-300 block">Rider:</span>
              <span className="text-sm font-bold block">{riderName}</span>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-red-500/10 cursor-pointer active:scale-95"
          >
            I-Logout
          </button>
        </div>
      </div>

      {installHelp && !isInstalled && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-950">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold">I-add ang Rider App sa home screen</p>
              {/iphone|ipad|ipod/i.test(navigator.userAgent) ? (
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs">
                  <li>Buksan ang link na ito sa Safari gamit ang HTTPS.</li>
                  <li>Pindutin ang Share button.</li>
                  <li>Piliin ang “Add to Home Screen,” tapos pindutin ang “Add.”</li>
                </ol>
              ) : (
                <p className="mt-2 text-xs">
                  Buksan ang site sa Chrome gamit ang HTTPS, tapos piliin ang “Install app” sa menu ng browser.
                  Kung naka-local network lang ang server, gumamit ng HTTPS address na mapupuntahan ng rider phone.
                </p>
              )}
              {installError && !isInstalled && (
                <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">
                  {installError}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setInstallHelp(false)}
              className="rounded px-2 py-1 font-bold hover:bg-green-100"
              aria-label="Close install instructions"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* STATS OVERVIEW BENTO GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* STAT 1: Completed */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-green-50 text-green-600 rounded-xl">
            <CheckCircle className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-extrabold uppercase block tracking-wider">Tapos nang Deliveries</span>
            <span className="text-xl sm:text-2xl font-black text-slate-800 block leading-tight">{completedDeliveries.length} trips</span>
          </div>
        </div>

        {/* STAT 2: Pending */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-extrabold uppercase block tracking-wider">Kailangang Ihatid</span>
            <span className="text-xl sm:text-2xl font-black text-slate-800 block leading-tight">{pendingDeliveries.length} orders</span>
          </div>
        </div>

        {/* STAT 3: Rider Earnings */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Coins className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-extrabold uppercase block tracking-wider">Kita ngayong Araw</span>
            <span className="text-xl sm:text-2xl font-black text-indigo-600 block leading-tight">₱{totalEarnings.toFixed(2)}</span>
          </div>
        </div>

        {/* STAT 4: Status Mode */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-sky-50 text-sky-600 rounded-xl">
            <Navigation className="h-6 w-6 animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-extrabold uppercase block tracking-wider">Rider Status</span>
            <span className="text-sm font-black text-slate-800 flex items-center gap-1.5 mt-0.5">
              <span className={`w-2.5 h-2.5 rounded-full ${activeRoute ? 'bg-orange-500 animate-ping' : 'bg-green-500'}`}></span>
              {activeRoute ? 'Nasa Biyahe / On Trip' : 'Online / Nakatambay'}
            </span>
          </div>
        </div>
      </div>

      {/* PRIMARY RIDER LAYOUT (Map and Orders split) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* LEFT COLUMN: Map tracker visualization (8 Columns) */}
        <div className="lg:col-span-8 flex flex-col bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-1.5">
                <span>🗺️ Live Rider GPS Map</span>
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Ipinapakita ang daan mula sa Store Sangay patungo sa tahanan ng mamimili.
              </p>
            </div>

            {activeOrder && (
              <span className="text-[10px] bg-slate-100 border border-slate-200 text-slate-600 px-2.5 py-0.5 rounded font-mono font-bold shrink-0 self-start sm:self-center">
                Inaasikaso: {activeOrder.id}
              </span>
            )}
          </div>

          {/* Leaflet Map Wrapper */}
          <div className="h-[280px] md:h-[350px] w-full relative rounded-xl overflow-hidden border border-slate-200">
            <DeliveryMap
              activeDelivery={activeOrder}
              branchCoordinates={branchCoordinates}
              height="100%"
            />
          </div>
        </div>

        {/* RIGHT COLUMN: Rider order details and live GPS status */}
        <div className="lg:col-span-4 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          
          <div className="p-4 border-b border-slate-100 bg-slate-50/75 shrink-0">
            <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">
              Aking mga Delivery ({riderDeliveries.length})
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* If no deliveries assigned */}
            {riderDeliveries.length === 0 ? (
              <div className="text-center py-20 text-slate-400 flex flex-col items-center justify-center space-y-3">
                <Truck className="h-10 w-10 text-slate-300" />
                <p className="text-xs font-bold">Walang nakatalagang order sa inyo ngayon.</p>
                <p className="text-[10px] text-slate-400 px-4">
                  Makipag-ugnayan sa Admin / Staff sa kabilang portal upang italaga sa inyo ang mga Pending deliveries.
                </p>
              </div>
            ) : (
              <>
                {/* Active Focus Order Stats Card */}
                {activeOrder ? (
                  <div className="bg-slate-900 text-white rounded-xl p-4 space-y-3 shadow-md border border-slate-800">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[8px] font-mono tracking-widest text-slate-400 block uppercase">FOCUSED DELIVERY ORDER</span>
                        <h4 className="text-xs font-extrabold text-white mt-0.5">{activeOrder.customerName}</h4>
                        <span className="text-[10px] text-indigo-300 font-mono font-bold block">{activeOrder.id} • Sangay: {activeOrder.branch}</span>
                      </div>
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded font-mono uppercase ${
                        activeOrder.status === 'Delivered'
                          ? 'bg-green-500 text-white'
                          : activeOrder.status === 'Out for Delivery'
                          ? 'bg-orange-500 text-white animate-pulse'
                          : 'bg-slate-700 text-slate-300'
                      }`}>
                        {activeOrder.status}
                      </span>
                    </div>

                    {/* Delivery address details */}
                    <div className="text-[11px] text-slate-300 space-y-1 bg-slate-950/40 p-2.5 rounded border border-slate-800">
                      <p className="flex items-start gap-1">
                        <MapPin className="h-3.5 w-3.5 text-orange-400 shrink-0 mt-0.5" />
                        <span>{activeOrder.address} ({activeOrder.barangay})</span>
                      </p>
                      <p className="flex items-center gap-1 mt-1">
                        <Phone className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                        <span className="font-mono">{activeOrder.customerPhone}</span>
                      </p>
                      {activeOrder.notes && (
                        <p className="mt-1.5 pt-1.5 border-t border-slate-800/80 text-[10px] text-slate-400 italic">
                          Tanda: "{activeOrder.notes}"
                        </p>
                      )}
                    </div>

                    {/* Customer Store Image Appearance Display */}
                    {customerProfile?.storeImage && (
                      <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 flex flex-col gap-1.5">
                        <span className="text-[8px] font-mono tracking-widest text-slate-400 uppercase block">🏪 LOKASYON / HARAP NG TINDAHAN:</span>
                        <div className="w-full h-32 rounded-lg overflow-hidden border border-slate-700 relative">
                          <img src={customerProfile.storeImage} alt="Store appearance" className="w-full h-full object-cover" />
                        </div>
                      </div>
                    )}

                    {/* Order Items List Breakdown */}
                    <div className="space-y-1 max-h-24 overflow-y-auto no-scrollbar bg-slate-950/20 p-2 rounded border border-slate-800/50">
                      <p className="text-[8px] text-slate-400 font-extrabold uppercase tracking-widest mb-1">MGA PRODUKTONG IHATID:</p>
                      {activeOrder.items.map((it, idx) => (
                        <div key={idx} className="flex justify-between text-[10px] text-slate-300">
                          <span className="truncate pr-2">{it.name}</span>
                          <span className="font-mono text-slate-400 shrink-0">x{it.quantity}</span>
                        </div>
                      ))}
                    </div>

                    {/* Cash collection block */}
                    <div className="flex justify-between items-center text-xs bg-slate-950/60 p-2 rounded border border-slate-800">
                      <span className="text-slate-400 font-semibold">Kokolektahing Bayad:</span>
                      <span className="font-mono font-black text-amber-400 text-sm">₱{activeOrder.totalAmount.toFixed(2)}</span>
                    </div>

                    {/* Rider actions and live GPS status */}
                    <div className="pt-2 border-t border-slate-800 space-y-2">
                    <p className="text-[9px] text-indigo-400 font-black tracking-wider uppercase">DELIVERY & LIVE GPS:</p>
                      
                    {activeOrder.status === 'Pending' || activeOrder.status === 'Preparing' ? (
                      <div className="grid grid-cols-1 gap-2">
                        <button
                          type="button"
                          onClick={() => updateStatusManually(activeOrder, 'Out for Delivery')}
                            className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-1.5 rounded text-[11px] uppercase tracking-wide flex items-center justify-center gap-1 shadow-sm cursor-pointer active:scale-95"
                          >
                            <Navigation className="h-3 w-3" />
                            <span>Mark In Transit</span>
                          </button>
                        </div>
                      ) : activeOrder.status === 'Out for Delivery' ? (
                        <div className="space-y-2">
                          <div className="bg-slate-950/80 p-2.5 rounded border border-orange-500/30 text-center space-y-1.5">
                            <div className="flex items-center justify-center gap-1.5">
                              <span className={`w-2.5 h-2.5 rounded-full ${
                                locationStatus === 'live' ? 'bg-green-500 animate-pulse' :
                                locationStatus === 'low-accuracy' ? 'bg-amber-400 animate-pulse' :
                                locationStatus === 'error' ? 'bg-red-500' : 'bg-amber-400 animate-pulse'
                              }`}></span>
                              <span className={`font-bold text-[11px] ${
                                locationStatus === 'live' ? 'text-green-400' :
                                locationStatus === 'low-accuracy' ? 'text-amber-300' :
                                locationStatus === 'error' ? 'text-red-300' : 'text-amber-300'
                              }`}>
                                {locationStatus === 'live' ? 'LIVE GPS SHARING' :
                                 locationStatus === 'low-accuracy' ? 'GPS ACTIVE - LOW ACCURACY' :
                                 locationStatus === 'error' ? 'GPS LOCATION UNAVAILABLE' :
                                 'WAITING FOR GPS FIX'}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400">
                              {activeOrder.driverLocationUpdatedAt
                                ? `Last GPS: ${new Date(activeOrder.driverLocationUpdatedAt).toLocaleTimeString()} • ±${Math.round(activeOrder.driverLocationAccuracyMeters ?? 0)} m • ETA: `
                                : 'No rider location has been received yet. ETA will appear after the first GPS fix.'}
                              {activeOrder.driverLocationUpdatedAt && (
                                <span className="font-mono font-bold text-green-400">{activeOrder.etaMinutes} mins</span>
                              )}
                            </p>
                            {locationError && (
                              <>
                                <p className="text-[10px] text-red-300">{locationError}</p>
                                <button
                                  type="button"
                                  onClick={() => setGpsWatchAttempt((attempt) => attempt + 1)}
                                  className="text-[10px] font-bold text-indigo-300 underline"
                                >
                                  Retry GPS
                                </button>
                              </>
                            )}
                          </div>
                          <div className="grid grid-cols-1 gap-2">
                              <button
                                type="button"
                                onClick={() => updateStatusManually(activeOrder, 'Delivered')}
                                className="bg-green-600 hover:bg-green-700 text-white font-bold py-1.5 rounded text-[11px] uppercase tracking-wide flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                              >
                                <CheckCircle className="h-3 w-3" />
                                <span>Mark Delivered</span>
                              </button>
                          </div>
                        </div>
                      ) : activeOrder.status === 'Delivered' ? (
                        <div className="bg-green-950/80 border border-green-800/60 p-2.5 rounded flex flex-col gap-2 text-green-300 text-[10px]">
                          <div className="flex items-center gap-1.5">
                            <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />
                            <p className="font-medium">Naihatid na po ito ng ligtas at maayos! Trabahong mahusay!</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setDeliveredReceipt(activeOrder)}
                            className="w-full py-1.5 bg-green-700/50 hover:bg-green-700/80 text-green-100 font-bold rounded text-[10px] uppercase tracking-wide flex items-center justify-center gap-1 cursor-pointer transition-all"
                          >
                            🧾 Tingnan ang Resibo / View Receipt
                          </button>
                        </div>
                      ) : (
                        <div className="bg-slate-950/40 p-2 rounded text-center text-[10px] text-slate-500 border border-slate-800">
                          Ang order na ito ay kinansela (Cancelled).
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                {/* List of other orders assigned */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">
                    Iba pang nakatalagang deliveries:
                  </span>
                  {riderDeliveries.map((del) => {
                    const isSelected = del.id === (activeTrackId || (riderDeliveries[0]?.id));
                    return (
                      <button
                        key={del.id}
                        type="button"
                        onClick={() => {
                          setActiveTrackId(del.id);
                        }}
                        className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-indigo-50/50 border-indigo-200 ring-1 ring-indigo-500/10 shadow-xs'
                            : 'bg-white hover:bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="w-full flex justify-between items-start">
                          <div>
                            <span className="text-[9px] font-mono text-slate-500 font-bold bg-slate-100 px-1 py-0.5 rounded">
                              {del.id}
                            </span>
                            <h5 className="font-bold text-slate-800 text-xs mt-1 leading-tight">{del.customerName}</h5>
                            <span className="text-[9px] text-slate-400 block mt-0.5">
                              {del.barangay} • ₱{del.totalAmount.toFixed(2)}
                            </span>
                          </div>

                          <span
                            className={`text-[8px] font-bold font-mono px-1.5 py-0.5 rounded uppercase tracking-wider ${
                              del.status === 'Delivered'
                                ? 'bg-green-100 text-green-700'
                                : del.status === 'Out for Delivery'
                                ? 'bg-orange-100 text-orange-700 animate-pulse'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {del.status === 'Out for Delivery' ? '⚡ TRANSIT' : del.status}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
