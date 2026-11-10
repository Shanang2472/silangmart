import React, { useState } from 'react';
import { Delivery } from '../types';
import { 
  Users, 
  Search, 
  MapPin, 
  Phone, 
  ShoppingBag, 
  ChevronRight, 
  X, 
  Calendar, 
  CheckCircle, 
  ShieldCheck,
  CreditCard
} from 'lucide-react';

interface CustomerRecord {
  name: string;
  phone: string;
  barangay: string;
  address: string;
  coordinates: [number, number];
}

interface CustomerManagementViewProps {
  customers: CustomerRecord[];
  deliveries: Delivery[];
}

export default function CustomerManagementView({ customers, deliveries }: CustomerManagementViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBarangay, setSelectedBarangay] = useState('All');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);

  const barangays = ['All', ...Array.from(new Set(customers.map(c => c.barangay)))];

  // Filter customers
  const filteredCustomers = customers.filter(cust => {
    const matchesSearch = cust.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          cust.phone.includes(searchQuery) ||
                          cust.address.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesBarangay = selectedBarangay === 'All' || cust.barangay === selectedBarangay;
    return matchesSearch && matchesBarangay;
  });

  // Calculate customer metrics
  const getCustomerMetrics = (customerName: string) => {
    const custDeliveries = deliveries.filter(d => d.customerName.toLowerCase() === customerName.toLowerCase());
    const totalOrders = custDeliveries.length;
    const totalSpent = custDeliveries.reduce((sum, d) => sum + d.totalAmount, 0);
    const lastOrder = custDeliveries.length > 0 
      ? custDeliveries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
      : null;

    return { totalOrders, totalSpent, lastOrder, history: custDeliveries };
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-black uppercase tracking-wider rounded-full">
              Customer Directory
            </span>
            <span className="text-xs text-slate-400 font-bold">{customers.length} Registered Accounts</span>
          </div>
          <h1 className="text-2xl font-black font-display text-slate-800 tracking-tight mt-1">
            Silang Mini Mart Customer Accounts & Order History
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage customer profiles, inspect saved delivery GPS location pins, and analyze purchase history.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by customer name, phone, or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-sans"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Barangay:</span>
          <select
            value={selectedBarangay}
            onChange={(e) => setSelectedBarangay(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer outline-none focus:ring-2 focus:ring-blue-500 font-sans"
          >
            {barangays.map((b, idx) => (
              <option key={idx} value={b}>{b}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Customer Directory Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredCustomers.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-black uppercase tracking-wider text-slate-500">No Matching Customers Found</p>
            <p className="text-[10px] text-slate-400 mt-1">Try adjusting your search criteria or barangay filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-600">
              <thead className="text-[10px] uppercase font-black tracking-widest text-slate-400 bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Customer Name</th>
                  <th className="px-6 py-3.5">Contact Number</th>
                  <th className="px-6 py-3.5">Barangay & Address</th>
                  <th className="px-6 py-3.5">Total Orders</th>
                  <th className="px-6 py-3.5">Total Spend</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredCustomers.map((cust, idx) => {
                  const metrics = getCustomerMetrics(cust.name);
                  return (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-black flex items-center justify-center text-xs shrink-0">
                            {cust.name.charAt(0)}
                          </div>
                          <div>
                            <span className="font-extrabold text-slate-800 text-xs block">{cust.name}</span>
                            <span className="text-[9px] text-emerald-600 font-extrabold uppercase flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3" /> Verified Customer
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 font-mono font-bold text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{cust.phone}</span>
                        </div>
                      </td>

                      <td className="px-6 py-4 max-w-xs">
                        <div className="flex items-start gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-slate-800 block text-[11px]">{cust.barangay}</span>
                            <span className="text-[10px] text-slate-500 truncate block max-w-[220px]" title={cust.address}>
                              {cust.address}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 font-bold font-mono rounded-lg">
                          {metrics.totalOrders} Orders
                        </span>
                      </td>

                      <td className="px-6 py-4 font-mono font-black text-slate-800">
                        ₱{metrics.totalSpent.toFixed(2)}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setSelectedCustomer(cust)}
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-extrabold text-xs uppercase rounded-xl transition-all flex items-center gap-1 ml-auto cursor-pointer"
                        >
                          <span>View Profile</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Customer Detail Side Drawer */}
      {selectedCustomer && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 z-50 animate-fade-in"
            onClick={() => setSelectedCustomer(null)}
          />
          <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] bg-white z-50 shadow-2xl flex flex-col border-l border-slate-200 animate-slide-left">
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white font-black flex items-center justify-center text-sm shadow-sm">
                  {selectedCustomer.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-sm uppercase tracking-tight">{selectedCustomer.name}</h3>
                  <span className="text-[10px] text-slate-500 font-medium">Customer Profile & Order History</span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedCustomer(null)}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Info Cards */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Contact Info</span>
                  <span className="text-[10px] font-mono font-bold text-slate-700">{selectedCustomer.phone}</span>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">{selectedCustomer.barangay}</span>
                    <span className="text-[11px] text-slate-600 block mt-0.5 leading-relaxed">{selectedCustomer.address}</span>
                    <span className="text-[9px] font-mono font-bold text-orange-600 mt-1 block">
                      GPS PIN: [{selectedCustomer.coordinates[0].toFixed(5)}, {selectedCustomer.coordinates[1].toFixed(5)}]
                    </span>
                  </div>
                </div>
              </div>

              {/* Delivery History */}
              <div>
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <ShoppingBag className="w-4 h-4 text-blue-600" />
                  <span>Recent Orders & Deliveries</span>
                </h4>

                {getCustomerMetrics(selectedCustomer.name).history.length === 0 ? (
                  <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-center text-slate-400">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">No Past Delivery Orders</p>
                    <p className="text-[10px] text-slate-400 mt-1">This customer has not placed any online delivery orders yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {getCustomerMetrics(selectedCustomer.name).history.map((order) => (
                      <div key={order.id} className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <span className="font-mono font-extrabold text-xs text-slate-800">{order.id}</span>
                          <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded-full ${
                            order.status === 'Delivered' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {order.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 space-y-1">
                          <div className="flex justify-between">
                            <span>Items ({order.items.length}):</span>
                            <span className="font-bold text-slate-800">{order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}</span>
                          </div>
                          <div className="flex justify-between font-mono">
                            <span>Total Amount:</span>
                            <span className="font-bold text-slate-900">₱{order.totalAmount.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
