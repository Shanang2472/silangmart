import React, { useEffect, useMemo, useState } from 'react';
import { PackagePlus, Truck, Clock3, CheckCircle2, LogOut, Store, CalendarDays, Boxes } from 'lucide-react';
import type { BranchRecord, Product, SupplierDelivery } from '../types';

interface Props {
  supplierName: string;
  branches: BranchRecord[];
  onLogout: () => void;
}

type DeliveryItemDraft = { productId: string; quantity: number; cost: number };

export default function SupplierDashboard({ supplierName, branches, onLogout }: Props) {
  const [deliveries, setDeliveries] = useState<SupplierDelivery[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [branch, setBranch] = useState(branches[0]?.name || 'Poblacion');
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<DeliveryItemDraft[]>([]);

  const headers = () => ({
    Authorization: `Bearer ${localStorage.getItem('silang_auth_token') || ''}`,
    'Content-Type': 'application/json',
  });

  const load = async () => {
    setLoading(true);
    try {
      const [deliveryRes, productRes] = await Promise.all([
        fetch('/api/supplier-deliveries?mine=1', { headers: headers() }),
        fetch('/api/products', { headers: headers() }),
      ]);
      const deliveryData = await deliveryRes.json();
      const productData = await productRes.json();
      if (!deliveryRes.ok) throw new Error(deliveryData.error || 'Unable to load deliveries');
      setDeliveries(deliveryData.supplierDeliveries || []);
      setProducts(productData.products || []);
    } catch (e: any) {
      setError(e.message || 'Unable to load supplier portal data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const addProduct = (productId: string) => {
    if (!productId || items.some((item) => item.productId === productId)) return;
    const product = products.find((p) => p.id === productId);
    setItems((current) => [...current, { productId, quantity: 1, cost: product?.cost || 0 }]);
  };

  const totalCost = useMemo(() => items.reduce((sum, item) => sum + item.quantity * item.cost, 0), [items]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!items.length) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/supplier-deliveries', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ supplierName, branch, deliveryDate, status: 'Pending', totalCost, items: items.map((item) => ({
          ...item,
          productName: products.find((p) => p.id === item.productId)?.name || item.productId,
        })) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to create delivery');
      setItems([]);
      await load();
    } catch (e: any) {
      setError(e.message || 'Unable to create delivery');
    } finally {
      setSaving(false);
    }
  };

  const pendingCount = deliveries.filter((d) => d.status === 'Pending').length;
  const receivedCount = deliveries.filter((d) => d.status === 'Received').length;
  const deliveredValue = deliveries.filter((d) => d.status === 'Received').reduce((sum, d) => sum + d.totalCost, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center"><Truck size={20}/></div>
            <div><p className="text-xs text-slate-400 font-bold uppercase">Supplier Portal</p><h1 className="font-black">{supplierName}</h1></div>
          </div>
          <button onClick={onLogout} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"><LogOut size={16}/><span className="text-xs font-bold">Logout</span></button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[{label:'Pending Deliveries', value:pendingCount, icon:Clock3, color:'text-amber-400'}, {label:'Received Deliveries', value:receivedCount, icon:CheckCircle2, color:'text-emerald-400'}, {label:'Received Value', value:`₱${deliveredValue.toLocaleString(undefined,{maximumFractionDigits:2})}`, icon:Boxes, color:'text-orange-400'}].map((card) => (
            <div key={card.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-5"><card.icon className={`${card.color} mb-3`} size={22}/><p className="text-slate-400 text-xs font-bold uppercase">{card.label}</p><p className="text-2xl font-black mt-1">{card.value}</p></div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <form onSubmit={submit} className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 h-fit">
            <h2 className="font-black flex items-center gap-2"><PackagePlus size={18} className="text-orange-400"/> Create Delivery</h2>
            {error && <p className="mt-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">{error}</p>}
            <label className="block mt-5 text-xs font-bold text-slate-400 uppercase">Destination Branch</label>
            <select value={branch} onChange={(e) => setBranch(e.target.value)} className="mt-2 w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5">
              {branches.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
            </select>
            <label className="block mt-4 text-xs font-bold text-slate-400 uppercase">Delivery Date</label>
            <input type="date" value={deliveryDate} min={new Date().toISOString().slice(0,10)} onChange={(e) => setDeliveryDate(e.target.value)} className="mt-2 w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5" />
            <label className="block mt-4 text-xs font-bold text-slate-400 uppercase">Add Product</label>
            <select defaultValue="" onChange={(e) => { addProduct(e.target.value); e.target.value = ''; }} className="mt-2 w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5">
              <option value="" disabled>Select product</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div className="mt-4 space-y-2">
              {items.map((item, index) => {
                const product = products.find((p) => p.id === item.productId);
                return <div key={item.productId} className="grid grid-cols-[1fr_70px_90px_28px] gap-2 items-center bg-slate-950 rounded-lg p-2">
                  <span className="text-xs font-bold truncate">{product?.name}</span>
                  <input aria-label="Quantity" type="number" min="1" value={item.quantity} onChange={(e) => setItems((all) => all.map((x,i) => i===index ? {...x, quantity: Math.max(1, Number(e.target.value))} : x))} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm" />
                  <input aria-label="Unit cost" type="number" min="0" step="0.01" value={item.cost} onChange={(e) => setItems((all) => all.map((x,i) => i===index ? {...x, cost: Number(e.target.value)} : x))} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm" />
                  <button type="button" onClick={() => setItems((all) => all.filter((_,i) => i !== index))} className="text-slate-500 hover:text-red-400">×</button>
                </div>;
              })}
            </div>
            <div className="flex items-center justify-between mt-4 border-t border-slate-800 pt-4"><span className="text-sm text-slate-400">Total cost</span><strong className="text-xl text-orange-400">₱{totalCost.toLocaleString(undefined,{maximumFractionDigits:2})}</strong></div>
            <button disabled={saving || !items.length} className="mt-4 w-full bg-orange-500 disabled:opacity-40 hover:bg-orange-600 rounded-lg py-3 text-sm font-black uppercase">{saving ? 'Submitting...' : 'Submit Delivery'}</button>
          </form>

          <section className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800"><h2 className="font-black flex items-center gap-2"><CalendarDays size={18} className="text-orange-400"/> Delivery History</h2></div>
            {loading ? <p className="p-8 text-center text-slate-500">Loading deliveries...</p> : deliveries.length === 0 ? <div className="p-10 text-center text-slate-500"><Store className="mx-auto mb-3"/><p>No deliveries yet.</p></div> : <div className="divide-y divide-slate-800">
              {deliveries.map((delivery) => <div key={delivery.id} className="p-5">
                <div className="flex justify-between gap-3"><div><p className="font-black">{delivery.id}</p><p className="text-xs text-slate-400 mt-1">{delivery.branch} • {new Date(delivery.deliveryDate).toLocaleDateString()}</p></div><span className={`text-[10px] font-black px-2 py-1 h-fit rounded-full ${delivery.status === 'Received' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>{delivery.status}</span></div>
                <p className="text-sm text-slate-300 mt-3">{delivery.items.map((item) => `${item.quantity}× ${item.productName}`).join(' • ')}</p>
                <p className="mt-2 text-right font-black text-orange-400">₱{delivery.totalCost.toLocaleString(undefined,{maximumFractionDigits:2})}</p>
              </div>)}
            </div>}
          </section>
        </div>
      </main>
    </div>
  );
}
