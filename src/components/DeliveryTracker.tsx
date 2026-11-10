/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Delivery, Branch, Product } from '../types';
// import { MOCK_CUSTOMERS } from '../initialData';

import DeliveryMap from './DeliveryMap';
import DeliveryReceiptModal from './DeliveryReceiptModal';
import { MapPin, Plus, Navigation, Phone, CheckCircle, CheckSquare, ClipboardList, ChefHat, Package, ChevronDown, ChevronUp } from 'lucide-react';
import { getDistance } from '../utils/routeUtils';

interface DeliveryTrackerProps {
  deliveries: Delivery[];
  products: Product[];
  branchCoordinates: Record<string, [number, number]>;
  onUpdateDelivery: (updated: Delivery) => void;
  onVerifyPayment: (delivery: Delivery, verification: 'Successful' | 'Failed') => Promise<void>;
  onAddNewDelivery: (newDelivery: Delivery) => void;
  staffList?: { id: number; name: string; role: string }[];
}

// distance helper moved to routeUtils

export default function DeliveryTracker({
  deliveries,
  products,
  branchCoordinates,
  onUpdateDelivery,
  onVerifyPayment,
  onAddNewDelivery,
  staffList = [],
}: DeliveryTrackerProps) {
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deliveredReceipt, setDeliveredReceipt] = useState<Delivery | null>(null);
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(new Set());
  const [activeQueueTab, setActiveQueueTab] = useState<'queue' | 'tracker'>('queue');
  const [verifyingPaymentId, setVerifyingPaymentId] = useState<string | null>(null);

  // Form states
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custBarangay, setCustBarangay] = useState('');
  const [custBranch, setCustBranch] = useState<Branch>(() => (Object.keys(branchCoordinates)[0] as Branch) || '');

  // Default coordinates: start at first registered branch (overwritten by map click / location selected).
  const [custCoordinates, setCustCoordinates] = useState<[number, number]>(() => {
    const firstBranch = Object.keys(branchCoordinates || {})[0] as Branch | undefined;
    if (firstBranch && branchCoordinates[firstBranch]) return branchCoordinates[firstBranch];
    return [0, 0];
  });

  const [deliveryItems, setDeliveryItems] = useState<{ productId: string; quantity: number }[]>([]);
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('50');

  const activeDelivery = deliveries.find((d) => d.id === activeTrackId) || null;

  const getBranchCoord = (branch: Branch): [number, number] => {
    return branchCoordinates[branch as keyof typeof branchCoordinates];
  };

  // Handle map click to set custom coordinates
  const handleMapClick = (lat: number, lng: number) => {
    setCustCoordinates([lat, lng]);
    if (!custAddress.trim()) {
      const branchName = custBranch || '';
      setCustAddress(`Custom Pin Coordinate: [${lat.toFixed(5)}, ${lng.toFixed(5)}]${branchName ? `, ${branchName}` : ''}`);
    }

  };

  // Quick select customer from dropdown
  const handleCustomerQuickSelect = (_name: string) => {
    // Demo customer presets removed.
    // Customer details should be entered manually or selected from backend-provided data.
  };

  // Add Item to delivery cart
  const addDeliveryItem = (productId: string) => {
    if (!productId) return;
    const exists = deliveryItems.some((item) => item.productId === productId);
    if (exists) return;
    setDeliveryItems([...deliveryItems, { productId, quantity: 1 }]);
  };

  // Submit delivery form
  const handleAddDeliverySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName || !custPhone || !custAddress || deliveryItems.length === 0) {
      alert('Punan ang customer details at magdagdag ng kahit isang produkto.');
      return;
    }

    const itemsCalculated = deliveryItems.map((item) => {
      const prod = products.find((p) => p.id === item.productId)!;
      return {
        productId: item.productId,
        name: prod.name,
        quantity: item.quantity,
        price: prod.price,
      };
    });

    const subtotal = itemsCalculated.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const feeNum = parseFloat(deliveryFee) || 0;
    const totalAmount = subtotal + feeNum;

    const newDelivery: Delivery = {
      id: `DEL-${Date.now().toString().slice(-4)}`,
      branch: custBranch,
      customerName: custName,
      customerPhone: custPhone,
      address: custAddress,
      barangay: custBarangay,
      coordinates: custCoordinates,
      status: 'Pending',
      items: itemsCalculated,
      deliveryFee: feeNum,
      totalAmount,
      driverName: 'Hindi pa nakatalaga / Unassigned',
      driverCoordinates: getBranchCoord(custBranch), // starts at branch
      etaMinutes: Math.ceil(getDistance(getBranchCoord(custBranch), custCoordinates) * 4),

      notes: deliveryNotes || undefined,
      timestamp: new Date().toISOString(),
    };

    onAddNewDelivery(newDelivery);
    alert('Matagumpay na nailista ang Delivery Order! Pumili ng rider at i-dispatch ang order para masubaybayan ang aktwal na GPS.');

    // Reset States
    setCustName('');
    setCustPhone('');
    setCustAddress('');
    setDeliveryItems([]);
    setDeliveryNotes('');
    setShowAddForm(false);
  };

  // Start Delivery Order
  const startDelivery = async (del: Delivery) => {
    if (!del.driverName || del.driverName === 'Hindi pa nakatalaga / Unassigned') {
      alert('⚠️ Mangyaring pumili muna ng Rider/Driver bago i-dispatch ang delivery order!\n\nPumunta sa dropdown na "TALAGANG RIDER (DRIVER)" sa active panel at pumili ng nakarehistrong rider.');
      return;
    }
    const updated: Delivery = {
      ...del,
      status: 'Out for Delivery',
      etaMinutes: Math.ceil(getDistance(getBranchCoord(del.branch), del.coordinates) * 4),
    };

    try {
      // Call onUpdateDelivery (which now does an optimistic local update in App.tsx)
      await onUpdateDelivery(updated);

      setActiveTrackId(del.id);
    } catch (error: any) {
      // Show user-friendly error message if dispatch fails
      const errorMsg = error?.message || 'Unknown error occurred';
      alert(`❌ Hindi na-dispatch ang rider! Error: ${errorMsg}\n\nPakitingnan ang koneksyon sa server o subukan muli.`);
    }
  };

  // Distance calculation from driver to customer
  const distanceKm = activeDelivery
    ? getDistance(activeDelivery.driverCoordinates, activeDelivery.coordinates)
    : 0;

  // Queue counts
  const pendingOrders = deliveries.filter(d => d.status === 'Pending');
  const preparingOrders = deliveries.filter(d => d.status === 'Preparing');
  const activeQueueOrders = deliveries.filter(d => ['Pending', 'Preparing'].includes(d.status));

  const toggleOrderExpand = (id: string) => {
    setExpandedOrderIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Delivery Receipt Modal */}
      {deliveredReceipt && (
        <DeliveryReceiptModal
          delivery={deliveredReceipt}
          onClose={() => setDeliveredReceipt(null)}
        />
      )}

      {/* TAB SWITCHER */}
      <div className="flex border border-slate-200 bg-white rounded-xl shadow-xs overflow-hidden">
        <button
          type="button"
          onClick={() => setActiveQueueTab('queue')}
          className={`flex-1 py-2.5 text-center text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeQueueTab === 'queue'
              ? 'bg-orange-500 text-white shadow-inner'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <ClipboardList className="h-4 w-4" />
          <span>Order Queue</span>
          {activeQueueOrders.length > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${activeQueueTab === 'queue' ? 'bg-white/30 text-white' : 'bg-orange-500 text-white'}`}>
              {activeQueueOrders.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveQueueTab('tracker')}
          className={`flex-1 py-2.5 text-center text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeQueueTab === 'tracker'
              ? 'bg-orange-500 text-white shadow-inner'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Navigation className="h-4 w-4" />
          <span>GPS Tracker & Dispatch</span>
        </button>
      </div>

      {/* ORDER QUEUE VIEW */}
      {activeQueueTab === 'queue' && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
              <span className="text-[9px] text-amber-600 font-extrabold uppercase tracking-widest block">Pending</span>
              <span className="text-2xl font-black text-amber-700">{pendingOrders.length}</span>
              <span className="text-[9px] text-amber-500 block">Bagong order</span>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
              <span className="text-[9px] text-blue-600 font-extrabold uppercase tracking-widest block">Preparing</span>
              <span className="text-2xl font-black text-blue-700">{preparingOrders.length}</span>
              <span className="text-[9px] text-blue-500 block">Inihahanda</span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
              <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-widest block">Total Active</span>
              <span className="text-2xl font-black text-slate-700">{activeQueueOrders.length}</span>
              <span className="text-[9px] text-slate-400 block">Kailangan ng aksyon</span>
            </div>
          </div>

          {activeQueueOrders.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-12 text-center">
              <ClipboardList className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-400 font-medium text-sm">Walang bagong incoming orders.</p>
              <p className="text-slate-300 text-xs mt-1">Lahat ng orders ay naka-dispatch na o wala pang pumasok.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeQueueOrders.map((order) => {
                const isExpanded = expandedOrderIds.has(order.id);
                const isPending = order.status === 'Pending';
                const isPreparing = order.status === 'Preparing';
                const itemsTotal = order.items.reduce((s, i) => s + i.price * i.quantity, 0);

                return (
                  <div
                    key={order.id}
                    className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
                      isPending ? 'border-amber-200' : 'border-blue-200'
                    }`}
                  >
                    {/* Order header */}
                    <div className={`px-4 py-3 flex items-center justify-between ${
                      isPending ? 'bg-amber-50' : 'bg-blue-50'
                    }`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          isPending ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                        }`}>
                          {isPending ? <Package className="h-4 w-4" /> : <ChefHat className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-extrabold text-slate-800 text-sm truncate">{order.customerName}</h4>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono uppercase tracking-wider shrink-0 ${
                              isPending ? 'bg-amber-200 text-amber-800' : 'bg-blue-200 text-blue-800'
                            }`}>
                              {order.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                            <span className="font-mono bg-slate-100 px-1 py-0.5 rounded">{order.id}</span>
                            <span>•</span>
                            <Phone className="h-2.5 w-2.5" />
                            <span>{order.customerPhone}</span>
                            <span>•</span>
                            <span>{new Date(order.timestamp).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="font-mono font-extrabold text-slate-800 text-sm">₱{order.totalAmount.toFixed(2)}</span>
                        <button
                          type="button"
                          onClick={() => toggleOrderExpand(order.id)}
                          className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Quick item summary (always visible) */}
                    <div className="px-4 py-2 border-t border-slate-100 bg-white">
                      <div className="flex flex-wrap gap-1.5">
                        {order.items.map((item, i) => (
                          <span key={i} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                            {item.name} ×{item.quantity}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="px-4 py-3 border-t border-slate-100 space-y-3">
                        {/* Full item breakdown */}
                        <div>
                          <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-2">Detalye ng Order:</p>
                          <div className="space-y-1.5 bg-slate-50 rounded-xl p-3">
                            {order.items.map((item, i) => (
                              <div key={i} className="flex justify-between items-center text-xs">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <span className="w-5 h-5 bg-orange-100 text-orange-600 rounded text-[9px] font-extrabold flex items-center justify-center shrink-0">
                                    {item.quantity}×
                                  </span>
                                  <span className="font-medium text-slate-700 truncate">{item.name}</span>
                                </div>
                                <div className="text-right shrink-0 ml-2">
                                  <span className="font-mono text-slate-500 text-[10px]">₱{item.price.toFixed(2)} ea.</span>
                                  <span className="font-mono font-extrabold text-slate-800 ml-2">₱{(item.price * item.quantity).toFixed(2)}</span>
                                </div>
                              </div>
                            ))}
                            <div className="border-t border-slate-200 pt-1.5 mt-1 space-y-0.5">
                              <div className="flex justify-between text-[10px]">
                                <span className="text-slate-400">Items subtotal</span>
                                <span className="font-mono text-slate-600">₱{itemsTotal.toFixed(2)}</span>
                              </div>
                              {order.deliveryFee > 0 && (
                                <div className="flex justify-between text-[10px]">
                                  <span className="text-slate-400">Delivery fee</span>
                                  <span className="font-mono text-slate-600">₱{order.deliveryFee.toFixed(2)}</span>
                                </div>
                              )}
                              <div className="flex justify-between text-xs font-extrabold">
                                <span className="text-slate-700">TOTAL</span>
                                <span className="font-mono text-slate-900">₱{order.totalAmount.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Delivery address */}
                        <div className="flex items-start gap-2 text-xs text-slate-500 bg-slate-50 rounded-xl p-3">
                          <MapPin className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-slate-700 block">{order.address}</span>
                            <span className="text-slate-400">{order.barangay} • {order.branch}</span>
                            {order.notes && <span className="text-orange-500 block mt-1 italic">📝 {order.notes}</span>}
                          </div>
                        </div>

                        {/* Payment info */}
                        <div className="flex justify-between items-center bg-slate-50 rounded-xl px-3 py-2 text-xs">
                          <span className="text-slate-400 font-medium">Payment</span>
                          <span className={`font-bold px-2 py-0.5 rounded font-mono text-[10px] ${
                            (order as any).paymentStatus === 'Paid'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {order.paymentMethod} • {(order as any).paymentStatus || 'Pending'}
                          </span>
                        </div>
                        {order.paymentMethod && order.paymentMethod !== 'Cash' && order.paymentStatus === 'Awaiting Verification' && (
                          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                            <p className="text-[10px] font-bold text-amber-900">I-verify bago i-dispatch</p>
                            <p className="mt-1 text-[10px] text-amber-800">Reference: <span className="font-mono font-bold">{order.paymentReference || 'Wala pa — kailangan isumite ng rider'}</span></p>
                            {order.paymentAmount != null && <p className="text-[10px] text-amber-800">Halaga: ₱{order.paymentAmount.toFixed(2)} / ₱{order.totalAmount.toFixed(2)}</p>}
                            <p className="mt-1 text-[9px] text-amber-700">Ihambing ang reference at halagang ito sa official GCash/Maya merchant account. Hindi sapat ang screenshot o reference lamang.</p>
                            {order.paymentProofUrl && (
                              <a href={order.paymentProofUrl} target="_blank" rel="noreferrer" className="mt-2 block">
                                <img
                                  src={order.paymentProofUrl}
                                  alt={`Payment proof for order ${order.id}`}
                                  className="max-h-48 w-full rounded-lg border border-amber-200 bg-white object-contain"
                                />
                                <span className="mt-1 block text-center text-[9px] font-bold text-blue-700 underline">Buksan ang payment screenshot</span>
                              </a>
                            )}
                            {order.paymentReference && (
                              <div className="mt-2 flex gap-2">
                                <button
                                  type="button"
                                  disabled={verifyingPaymentId === order.id}
                                  onClick={async () => {
                                    setVerifyingPaymentId(order.id);
                                    try { await onVerifyPayment(order, 'Successful'); }
                                    catch (error: any) { alert(error?.message || 'Hindi na-verify ang bayad.'); }
                                    finally { setVerifyingPaymentId(null); }
                                  }}
                                  className="flex-1 rounded-lg bg-emerald-600 px-2 py-1.5 text-[10px] font-bold text-white disabled:opacity-50 cursor-pointer"
                                >
                                  I-approve
                                </button>
                                <button
                                  type="button"
                                  disabled={verifyingPaymentId === order.id}
                                  onClick={async () => {
                                    setVerifyingPaymentId(order.id);
                                    try { await onVerifyPayment(order, 'Failed'); }
                                    catch (error: any) { alert(error?.message || 'Hindi na-update ang payment status.'); }
                                    finally { setVerifyingPaymentId(null); }
                                  }}
                                  className="flex-1 rounded-lg bg-red-600 px-2 py-1.5 text-[10px] font-bold text-white disabled:opacity-50 cursor-pointer"
                                >
                                  I-reject
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex gap-2 pt-1">
                          {isPending && (
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await onUpdateDelivery({ ...order, status: 'Preparing' });
                                } catch (err: any) {
                                  alert(err?.message || 'Hindi naisave. Subukan muli.');
                                }
                              }}
                              className="flex-1 py-2 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                            >
                              <ChefHat className="h-3.5 w-3.5" />
                              Simulan ang Paghahanda
                            </button>
                          )}
                          {isPreparing && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveTrackId(order.id);
                                setActiveQueueTab('tracker');
                              }}
                              className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                            >
                              <Navigation className="h-3.5 w-3.5" />
                              I-dispatch sa Rider
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Past orders summary */}
          {deliveries.filter(d => !['Pending','Preparing'].includes(d.status)).length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                <h3 className="font-extrabold text-slate-600 text-xs uppercase tracking-wider">
                  Natapos na / Naka-dispatch na Orders ({deliveries.filter(d => !['Pending','Preparing'].includes(d.status)).length})
                </h3>
              </div>
              <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                {deliveries
                  .filter(d => !['Pending','Preparing'].includes(d.status))
                  .map(order => (
                    <div key={order.id} className="px-4 py-2.5 flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-700 truncate">{order.customerName}</span>
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded font-mono uppercase ${
                            order.status === 'Delivered' ? 'bg-green-100 text-green-700' :
                            order.status === 'Cancelled' ? 'bg-red-100 text-red-600' :
                            'bg-orange-100 text-orange-700'
                          }`}>{order.status}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {order.items.map(i => `${i.name} ×${i.quantity}`).join(', ')}
                        </div>
                      </div>
                      <span className="font-mono font-extrabold text-slate-700 text-xs ml-3 shrink-0">₱{order.totalAmount.toFixed(2)}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* GPS TRACKER VIEW */}
      {activeQueueTab === 'tracker' && (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full items-stretch">
      <div className="lg:col-span-7 xl:col-span-8 flex flex-col bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="mb-3 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide flex items-center gap-1.5">
              <span>🗺️ GPS Tracker (Leaflet Map)</span>
              {activeDelivery && (
                <span className="text-xs bg-orange-50 border border-orange-200 text-silang-orange px-2 py-0.5 rounded font-mono font-bold animate-pulse">
                  Mabilisang Pagsubaybay: {activeDelivery.id}
                </span>
              )}
            </h3>
            {showAddForm && (
              <p className="text-[11px] text-silang-blue font-semibold mt-0.5 animate-pulse">
                💡 Tip: Pwedeng mag-click direkta sa mapa para makuha ang sakto at pasadyang GPS coordinates!
              </p>
            )}
          </div>

          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="px-3 py-1.5 text-xs font-bold bg-silang-blue hover:bg-silang-blue-dark text-white rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Bagong Hatid (Delivery)</span>
            </button>
          )}
        </div>

        {/* The leaflet map wrapper */}
        <div className="h-[280px] md:h-[350px] w-full relative">
          <DeliveryMap
            activeDelivery={activeDelivery}
            onMapClick={showAddForm ? handleMapClick : undefined}
            branchCoordinates={branchCoordinates}
            height="100%"
            showSearch={showAddForm}
            onLocationSelected={(lat, lng, address, barangay) => {
              if (showAddForm) {
                setCustCoordinates([lat, lng]);
                setCustAddress(address);
                if (barangay) {
                  setCustBarangay(barangay);
                }
              }
            }}
          />
        </div>
      </div>

      {/* Control panel column (4-5 cols) */}
      <div className="lg:col-span-5 xl:col-span-4 flex flex-col h-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden" id="delivery-panel-container">
        {/* VIEW 1: CREATING NEW DELIVERY */}
        {showAddForm ? (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/75 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-sm">Bagong Delivery Order</h3>
              <button
                onClick={() => setShowAddForm(false)}
                className="text-xs text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
              >
                Kanselahin
              </button>
            </div>

            <form onSubmit={handleAddDeliverySubmit} className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
              {/* Quick Preset Selector */}
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Mabilisang Pumili ng Customer Preset:</label>
                <select
                  onChange={(e) => handleCustomerQuickSelect(e.target.value)}
                  className="w-full px-2.5 py-1.5 border rounded-lg bg-white"
                >
                  <option value="">-- Pumili mula sa rehiyon ng Silang --</option>
                  <option value="">(manual entry only)</option>
                </select>
              </div>

              {/* Form entries */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Pangalan ng Customer *</label>
                  <input
                    type="text"
                    required
                    placeholder="E.g. Juan Dela Cruz"
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                    className="w-full px-2.5 py-1.5 border rounded-lg bg-white font-medium"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Phone Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="E.g. 0917-123-4567"
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    className="w-full px-2.5 py-1.5 border rounded-lg bg-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Barangay</label>

                  <input
                    type="text"
                    required
                    placeholder="E.g. Brgy. Sabutan"
                    value={custBarangay}
                    onChange={(e) => setCustBarangay(e.target.value)}
                    className="w-full px-2.5 py-1.5 border rounded-lg bg-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Mangagaling sa Branch:</label>
                  <select
                    value={custBranch}
                    onChange={(e) => setCustBranch(e.target.value as Branch)}
                    className="w-full px-2.5 py-1.5 border rounded-lg bg-white font-bold text-silang-blue"
                  >
                    <option value="Poblacion">Poblacion (Bayan)</option>
                    <option value="Bypass">Bypass Road</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Address *</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Isulat ang kumpletong address..."
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                  className="w-full px-2.5 py-1.5 border rounded-lg bg-white"
                />
              </div>

              {/* Coordinates read-only info */}
              <div className="p-2 rounded bg-slate-50 border flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block font-mono">MAP LAT/LNG COORDINATES:</span>
                  <span className="font-mono text-[11px] font-bold text-slate-600">
                    {custCoordinates[0].toFixed(5)}, {custCoordinates[1].toFixed(5)}
                  </span>
                </div>
                <MapPin className="h-4 w-4 text-red-500" />
              </div>

              {/* Delivery items add section */}
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Magdagdag ng Idedeliber na Item:</label>
                <select
                  onChange={(e) => {
                    addDeliveryItem(e.target.value);
                    e.target.value = '';
                  }}
                  className="w-full px-2.5 py-1.5 border rounded-lg bg-white"
                >
                  <option value="">-- Pumili ng Produkto --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (₱{p.price.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Added items list */}
              {deliveryItems.length > 0 && (
                <div className="border border-slate-100 rounded-lg overflow-hidden bg-white max-h-[120px] overflow-y-auto">
                  <div className="bg-slate-50 px-2 py-1 border-b border-slate-100 font-bold text-slate-500 uppercase tracking-wide text-[9px]">
                    Mga Produkto sa delivery bag:
                  </div>
                  <div className="p-1 divide-y divide-slate-100">
                    {deliveryItems.map((item, idx) => {
                      const prod = products.find((p) => p.id === item.productId)!;
                      return (
                        <div key={item.productId} className="flex justify-between items-center p-1 font-sans text-[11px]">
                          <span className="font-bold text-slate-700 truncate max-w-[150px]">{prod.name}</span>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="1"
                              required
                              value={item.quantity}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 1;
                                const updated = [...deliveryItems];
                                updated[idx].quantity = val;
                                setDeliveryItems(updated);
                              }}
                              className="w-10 px-1 text-center border rounded font-bold"
                            />
                            <button
                              type="button"
                              onClick={() => setDeliveryItems(deliveryItems.filter((_, i) => i !== idx))}
                              className="text-red-500 font-bold hover:underline"
                            >
                              x
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Delivery Fee (₱)</label>
                  <input
                    type="number"
                    placeholder="50"
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(e.target.value)}
                    className="w-full px-2.5 py-1.5 border rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Tala o Driver Notes</label>
                  <input
                    type="text"
                    placeholder="Bilin sa rider..."
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                    className="w-full px-2.5 py-1.5 border rounded-lg bg-white"
                  />
                </div>
              </div>

              {/* Submit Delivery Cart */}
              <button
                type="submit"
                className="w-full py-2 bg-silang-blue hover:bg-silang-blue-dark text-white font-bold rounded-lg shadow-sm transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                <CheckSquare className="h-4 w-4" />
                <span>Gumawa ng Delivery Order</span>
              </button>
            </form>
          </div>
        ) : (
          /* VIEW 2: ACTIVE DELIVERIES */
          <div className="flex flex-col h-full overflow-hidden">
            {/* Delivery logs tab */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/75 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Delivery List & GPS Tracker</h3>
                <p className="text-[10px] text-slate-400">Live location appears after the rider enables GPS sharing.</p>
              </div>
            </div>

            {/* List container */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Show live stats only after the rider's device has sent a GPS fix */}
              {activeDelivery && (
                <div className="bg-slate-800 text-white rounded-xl p-4 shadow-lg space-y-3.5 border border-slate-700 animate-fade-in relative overflow-hidden">
                  {/* Decorative glowing overlay */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-silang-orange/10 rounded-full blur-2xl pointer-events-none"></div>

                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-[10px] font-mono tracking-widest text-slate-400">ACTIVE GPS PATH</span>
                      <h4 className="text-base font-bold text-slate-100">{activeDelivery.customerName}</h4>
                      <p className="text-[11px] text-slate-300 font-sans">{activeDelivery.address}</p>
                    </div>
                    <span className="bg-silang-orange text-white text-[10px] font-bold px-2 py-0.5 rounded font-mono uppercase tracking-wider animate-pulse">
                      {activeDelivery.status}
                    </span>
                  </div>

                  {/* ADMIN CONTROLS: Driver Assignment & Status Updates */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700 text-xs">
                    <div>
                      <label className="text-[9px] text-slate-400 block font-bold uppercase mb-0.5">TALAGANG RIDER (DRIVER):</label>
                      <select
                        value={activeDelivery.driverName || ''}
                        onChange={async (e) => {
                          const newDriver = e.target.value;
                          const updated: Delivery = {
                            ...activeDelivery,
                            driverName: newDriver,
                          };
                          try {
                            await onUpdateDelivery(updated);
                          } catch (err: any) {
                            alert(err?.message || 'Hindi naisave ang rider assignment. Subukan muli.');
                          }
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white outline-none cursor-pointer"
                      >
                        <option value="Hindi pa nakatalaga / Unassigned">-- Pumili ng Rider --</option>
                        {staffList.filter(s => s.role === 'rider').map(rider => (
                          <option key={rider.id} value={rider.name}>{rider.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[9px] text-slate-400 block font-bold uppercase mb-0.5">BAGUHIN ANG STATUS:</label>
                      <select
                        value={activeDelivery.status}
                        onChange={async (e) => {
                          const nextStatus = e.target.value as Delivery['status'];
                          
                          // Validate rider is selected before allowing Out for Delivery
                          if (nextStatus === 'Out for Delivery') {
                            if (!activeDelivery.driverName || activeDelivery.driverName === 'Hindi pa nakatalaga / Unassigned') {
                              alert('⚠️ Mangyaring pumili muna ng Rider/Driver bago baguhin ang status sa "Out for Delivery"!\n\nGamitin ang dropdown na "TALAGANG RIDER (DRIVER)" sa itaas.');
                              return;
                            }
                          }

                          let updated: Delivery = {
                            ...activeDelivery,
                            status: nextStatus,
                          };
                          if (nextStatus === 'Out for Delivery') {
                            updated.etaMinutes = Math.ceil(getDistance(getBranchCoord(activeDelivery.branch), activeDelivery.coordinates) * 4);
                          } else if (nextStatus === 'Delivered') {
                            updated.etaMinutes = 0;
                          }
                          try {
                            await onUpdateDelivery(updated);
                            // Show receipt when admin marks as Delivered
                            if (nextStatus === 'Delivered') {
                              setDeliveredReceipt(updated);
                            }
                          } catch (err: any) {
                            alert(err?.message || 'Hindi naisave ang status update. Subukan muli.');
                          }
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-orange-400 font-bold outline-none cursor-pointer"
                      >
                        <option value="Pending">Pending (Naghihintay)</option>
                        <option value="Preparing">Preparing (Inihahanda)</option>
                        <option value="Out for Delivery">Out for Delivery (On the Way)</option>
                        <option value="Delivered">Delivered (Naihatid na)</option>
                        <option value="Cancelled">Cancelled (Kanselado)</option>
                      </select>
                    </div>
                  </div>

                  {activeDelivery.status === 'Out for Delivery' ? (
                    <div className="space-y-2 text-xs pt-1 border-t border-slate-700">
                      {activeDelivery.driverLocationUpdatedAt ? (
                        <>
                          <div className="grid grid-cols-2 gap-3 text-center bg-slate-900/60 p-2 rounded-lg border border-slate-700/50">
                            <div>
                              <span className="text-[10px] text-slate-400 block font-bold uppercase">Distansya sa Destino</span>
                              <span className="font-mono text-base font-extrabold text-silang-orange">
                                {distanceKm.toFixed(2)} km
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block font-bold uppercase">ETA ng Driver</span>
                              <span className="font-mono text-base font-extrabold text-silang-green">
                                {activeDelivery.etaMinutes} mins
                              </span>
                            </div>
                          </div>
                          <p className="text-center text-[10px] text-slate-400">
                            Huling GPS update: {new Date(activeDelivery.driverLocationUpdatedAt).toLocaleTimeString()}
                          </p>
                        </>
                      ) : (
                        <p className="rounded-lg border border-amber-500/30 bg-slate-900/60 p-3 text-center text-xs font-semibold text-amber-200">
                          Waiting for the rider's first GPS location.
                        </p>
                      )}
                    </div>
                  ) : activeDelivery.status === 'Delivered' ? (
                    <div className="bg-green-950/80 border border-green-800 p-2.5 rounded-lg flex flex-col gap-2 text-green-300 text-xs mt-1">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4.5 w-4.5 text-silang-green shrink-0" />
                        <p className="font-medium">Ang delivery na ito ay matagumpay nang naidala sa customer!</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDeliveredReceipt(activeDelivery)}
                        className="w-full py-1.5 bg-green-700/60 hover:bg-green-700/90 text-green-100 font-bold rounded text-[10px] uppercase tracking-wide flex items-center justify-center gap-1 cursor-pointer transition-all"
                      >
                        🧾 Tingnan ang Resibo / View Receipt
                      </button>
                    </div>
                  ) : (
                    <div className="mt-2 text-xs">
                      <button
                        onClick={() => startDelivery(activeDelivery)}
                        className="w-full py-2 bg-silang-orange hover:bg-silang-orange-dark text-white font-bold rounded-lg shadow-sm transition-all flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Navigation className="h-3.5 w-3.5" />
                        <span>I-dispatch ang rider</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Delivery logs queue */}
              <div className="space-y-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Delivery Orders Queue ({deliveries.length})
                </span>

                {deliveries.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 border border-dashed rounded-lg bg-slate-50/50">
                    Walang delivery orders sa listahan.
                  </div>
                ) : (
                  deliveries.map((del) => {
                    const isSelected = del.id === activeTrackId;
                    return (
                      <button
                        key={del.id}
                        type="button"
                        onClick={() => {
                          setActiveTrackId(del.id);
                        }}
                        className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-silang-blue-light/50 border-silang-blue/30 ring-1 ring-silang-blue/10 shadow-sm'
                            : 'bg-white hover:bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="w-full flex justify-between items-start">
                          <div>
                            <span className="text-[9px] font-mono text-slate-400 font-bold bg-slate-100 px-1 py-0.5 rounded">
                              {del.id}
                            </span>
                            <h5 className="font-bold text-slate-800 text-xs sm:text-sm mt-1">{del.customerName}</h5>
                            <span className="text-[10px] text-slate-500 block flex items-center gap-0.5">
                              <Phone className="h-2.5 w-2.5 inline" />
                              {del.customerPhone}
                            </span>
                          </div>

                          <span
                            className={`text-[9px] font-bold font-mono px-2 py-0.5 rounded uppercase tracking-wider ${
                              del.status === 'Delivered'
                                ? 'bg-green-100 text-green-700'
                                : del.status === 'Out for Delivery'
                                ? 'bg-orange-100 text-orange-700 animate-pulse'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {del.status === 'Out for Delivery' ? '⚡ OUT' : del.status}
                          </span>
                        </div>

                        {/* Delivery items detail */}
                        <div className="mt-2 border-t border-slate-100 pt-2 w-full space-y-1">
                          {del.items && del.items.length > 0 ? del.items.map((item, i) => (
                            <div key={i} className="flex justify-between items-center text-[10px]">
                              <span className="text-slate-600 truncate flex-1 mr-1">{item.name}</span>
                              <span className="text-slate-400 shrink-0 mr-1.5">×{item.quantity}</span>
                              <span className="font-mono font-bold text-slate-700 shrink-0">₱{(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                          )) : (
                            <span className="text-slate-400 text-[10px]">{del.items.length} item(s)</span>
                          )}
                          <div className="flex justify-between text-[10px] pt-1 border-t border-slate-100">
                            <span className="text-slate-400 font-medium">Branch: {del.branch}</span>
                            <span className="font-extrabold text-slate-800 font-mono">₱{del.totalAmount.toFixed(2)}</span>
                          </div>
                        </div>

                        {/* Show rider assignment status */}
                        {del.status === 'Pending' && (
                          <div className="mt-2 text-center py-1 bg-amber-50 text-amber-700 rounded text-[10px] font-bold border border-amber-200">
                            👆 Pindutin para pumili ng rider at i-dispatch
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
      )}
    </div>
  );
}
