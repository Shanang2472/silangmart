import React, { useState } from 'react';
import { Product, Transaction, Delivery } from '../types';
import { 
  TrendingUp, 
  ShoppingBag, 
  Clock, 
  Truck, 
  PackageCheck, 
  AlertTriangle, 
  XCircle, 
  Coins, 
  ArrowUpRight, 
  ArrowDownRight,
  ChevronRight,
  Search,
  Filter,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';

interface DashboardOverviewProps {
  products: Product[];
  transactions: Transaction[];
  deliveries: Delivery[];
  currentBranch: string;
  onNavigateToTab: (tab: 'POS' | 'Inventory' | 'Deliveries' | 'Analytics' | 'Customers') => void;
  onQuickRestock: () => void;
}

export default function DashboardOverview({
  products,
  transactions,
  deliveries,
  currentBranch,
  onNavigateToTab,
  onQuickRestock
}: DashboardOverviewProps) {
  const [salesTimeframe, setSalesTimeframe] = useState<'today' | 'week' | 'month'>('today');

  // Metrics calculation
  const todayStr = new Date().toISOString().split('T')[0];

  const todayTransactions = transactions.filter((t) => {
    const d = new Date(t.timestamp).toISOString().split('T')[0];
    return d === todayStr;
  });

  const todayPosSales = todayTransactions.reduce((sum, t) => sum + t.total, 0);

  const completedDeliveriesToday = deliveries.filter(d => d.status === 'Delivered' && new Date(d.timestamp).toISOString().split('T')[0] === todayStr);
  const todayDeliverySales = completedDeliveriesToday.reduce((sum, d) => sum + d.totalAmount, 0);
  const totalTodayRevenue = todayPosSales + todayDeliverySales;

  const totalOrdersCount = transactions.length + deliveries.length;
  const pendingDeliveries = deliveries.filter(d => ['Pending', 'Confirmed', 'Preparing', 'Ready', 'Assigned', 'Out for Delivery'].includes(d.status));
  
  const lowStockProducts = products.filter(p => {
    const stock = currentBranch === 'Poblacion' ? p.stockBranchA : p.stockBranchB;
    return stock > 0 && stock <= p.lowStockThreshold;
  });

  const outOfStockProducts = products.filter(p => {
    const stock = currentBranch === 'Poblacion' ? p.stockBranchA : p.stockBranchB;
    return stock === 0;
  });

  const healthyStockCount = products.length - lowStockProducts.length - outOfStockProducts.length;

  // Order status counts
  const statusCounts = {
    Pending: deliveries.filter(d => d.status === 'Pending').length,
    Preparing: deliveries.filter(d => d.status === 'Preparing').length,
    OutForDelivery: deliveries.filter(d => d.status === 'Out for Delivery').length,
    Delivered: deliveries.filter(d => d.status === 'Delivered').length,
    Cancelled: deliveries.filter(d => d.status === 'Cancelled').length,
  };

  const metricCards = [
    {
      title: "Today's Revenue",
      value: `₱${totalTodayRevenue.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      description: "Combined POS & Online Orders",
      trend: "+12.4%",
      isPositive: true,
      icon: Coins,
      color: "bg-blue-500/10 text-blue-600 border-blue-200"
    },
    {
      title: "Total Orders",
      value: totalOrdersCount.toString(),
      description: `${transactions.length} POS • ${deliveries.length} Deliveries`,
      trend: "+8.1%",
      isPositive: true,
      icon: ShoppingBag,
      color: "bg-emerald-500/10 text-emerald-600 border-emerald-200"
    },
    {
      title: "Pending Deliveries",
      value: pendingDeliveries.length.toString(),
      description: "Active customer dispatch orders",
      trend: pendingDeliveries.length > 0 ? "Requires action" : "All cleared",
      isPositive: pendingDeliveries.length === 0,
      icon: Clock,
      color: "bg-amber-500/10 text-amber-600 border-amber-200"
    },
    {
      title: "Active Riders",
      value: "3 Active",
      description: "Silang Cavite Route",
      trend: "GPS Live",
      isPositive: true,
      icon: Truck,
      color: "bg-purple-500/10 text-purple-600 border-purple-200"
    },
    {
      title: "Total Products",
      value: products.length.toString(),
      description: `${healthyStockCount} In-Stock items`,
      trend: `${currentBranch} Store`,
      isPositive: true,
      icon: PackageCheck,
      color: "bg-slate-500/10 text-slate-700 border-slate-200"
    },
    {
      title: "Low Stock Items",
      value: lowStockProducts.length.toString(),
      description: "Below reorder threshold",
      trend: lowStockProducts.length > 0 ? "Restock needed" : "Healthy",
      isPositive: lowStockProducts.length === 0,
      icon: AlertTriangle,
      color: lowStockProducts.length > 0 ? "bg-amber-500/10 text-amber-600 border-amber-200" : "bg-emerald-500/10 text-emerald-600 border-emerald-200"
    },
    {
      title: "Out of Stock",
      value: outOfStockProducts.length.toString(),
      description: "0 inventory on shelf",
      trend: outOfStockProducts.length > 0 ? "Critical" : "All available",
      isPositive: outOfStockProducts.length === 0,
      icon: XCircle,
      color: outOfStockProducts.length > 0 ? "bg-rose-500/10 text-rose-600 border-rose-200" : "bg-emerald-500/10 text-emerald-600 border-emerald-200"
    },
    {
      title: "Gross Sales",
      value: `₱${(todayPosSales + todayDeliverySales * 1.5).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`,
      description: "Estimated target pace",
      trend: "+14.8%",
      isPositive: true,
      icon: TrendingUp,
      color: "bg-orange-500/10 text-orange-600 border-orange-200"
    }
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-6 rounded-2xl shadow-md border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-orange-500 text-white font-black text-[10px] uppercase tracking-widest rounded-full">
              Live Operations Dashboard
            </span>
            <span className="text-xs text-slate-400 font-medium">Branch: <strong className="text-white">{currentBranch}</strong></span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black font-display tracking-tight text-white mt-1">
            Silang Mini Mart Management Console
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Real-time overview of POS sales, inventory status, active deliveries, and order dispatches.
          </p>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <button
            onClick={() => onNavigateToTab('POS')}
            className="flex-1 sm:flex-initial px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Open POS Cashier</span>
          </button>
          <button
            onClick={onQuickRestock}
            className="flex-1 sm:flex-initial px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 text-orange-400" />
            <span>Quick Restock</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">{card.title}</span>
                <div className={`p-2 rounded-xl border ${card.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <h3 className="text-xl font-black text-slate-800 font-mono tracking-tight">{card.value}</h3>
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-0.5 ${
                  card.isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                }`}>
                  {card.isPositive ? <ArrowUpRight className="w-3 h-3 text-emerald-600" /> : <ArrowDownRight className="w-3 h-3 text-amber-600" />}
                  {card.trend}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium mt-1 truncate">{card.description}</p>
            </div>
          );
        })}
      </div>

      {/* Responsive Grid: Sales Overview + Order Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Overview Bar Visualization */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4 mb-4">
              <div>
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-orange-500" />
                  <span>Sales Performance Trend</span>
                </h2>
                <p className="text-[10px] text-slate-400 mt-0.5">Summary of POS and Online Store revenue</p>
              </div>

              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-auto">
                <button
                  onClick={() => setSalesTimeframe('today')}
                  className={`px-3 py-1 text-[10px] font-extrabold uppercase rounded-lg transition-all cursor-pointer ${
                    salesTimeframe === 'today' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Today
                </button>
                <button
                  onClick={() => setSalesTimeframe('week')}
                  className={`px-3 py-1 text-[10px] font-extrabold uppercase rounded-lg transition-all cursor-pointer ${
                    salesTimeframe === 'week' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  This Week
                </button>
                <button
                  onClick={() => setSalesTimeframe('month')}
                  className={`px-3 py-1 text-[10px] font-extrabold uppercase rounded-lg transition-all cursor-pointer ${
                    salesTimeframe === 'month' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  This Month
                </button>
              </div>
            </div>

            {/* Visual Bar Breakdown */}
            <div className="space-y-4 my-4">
              <div>
                <div className="flex justify-between text-xs font-extrabold mb-1">
                  <span className="text-slate-600">POS Retail Cashier Sales</span>
                  <span className="text-blue-600 font-mono">₱{todayPosSales.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-600 rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min(100, (todayPosSales / (totalTodayRevenue || 1)) * 100)}%` }} 
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-extrabold mb-1">
                  <span className="text-slate-600">Online Customer Delivery Sales</span>
                  <span className="text-orange-500 font-mono">₱{todayDeliverySales.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-orange-500 rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min(100, (todayDeliverySales / (totalTodayRevenue || 1)) * 100)}%` }} 
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500">Need detailed breakdown reports?</span>
            <button
              onClick={() => onNavigateToTab('Analytics')}
              className="text-xs font-black text-orange-600 hover:text-orange-700 flex items-center gap-1 hover:underline cursor-pointer"
            >
              <span>View Sales Analytics</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Order Status Breakdown Panel */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="border-b border-slate-100 pb-3 mb-4">
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Truck className="w-4 h-4 text-blue-600" />
                <span>Delivery Order Status Pipeline</span>
              </h2>
              <p className="text-[10px] text-slate-400 mt-0.5">Live order states across drivers</p>
            </div>

            <div className="space-y-2">
              {[
                { label: 'Pending Approval', count: statusCounts.Pending, color: 'bg-amber-100 text-amber-800' },
                { label: 'Preparing Items', count: statusCounts.Preparing, color: 'bg-purple-100 text-purple-800' },
                { label: 'Out for Delivery', count: statusCounts.OutForDelivery, color: 'bg-orange-100 text-orange-800' },
                { label: 'Delivered', count: statusCounts.Delivered, color: 'bg-emerald-100 text-emerald-800' },
                { label: 'Cancelled', count: statusCounts.Cancelled, color: 'bg-rose-100 text-rose-800' }
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-xs font-bold text-slate-700">{item.label}</span>
                  <span className={`px-2 py-0.5 text-[10px] font-black rounded-full font-mono ${item.color}`}>
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 mt-4">
            <button
              onClick={() => onNavigateToTab('Deliveries')}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold uppercase tracking-wider rounded-xl transition-all cursor-pointer text-center"
            >
              Open GPS Delivery Tracker →
            </button>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Recent Orders Table + Low Stock Alert Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders Compact Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600" />
              <span>Latest Customer Orders</span>
            </h3>
            <button
              onClick={() => onNavigateToTab('Deliveries')}
              className="text-xs text-orange-600 hover:underline font-extrabold cursor-pointer"
            >
              View All Orders
            </button>
          </div>

          {deliveries.length === 0 ? (
            <div className="py-8 text-center text-slate-400">
              <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">No Orders Placed Yet</p>
              <p className="text-[10px] text-slate-400 mt-1">New online store orders will appear here automatically.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-slate-600">
                <thead className="text-[10px] uppercase font-black tracking-widest text-slate-400 bg-slate-50/80 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2">Order ID</th>
                    <th className="px-3 py-2">Customer</th>
                    <th className="px-3 py-2">Items</th>
                    <th className="px-3 py-2">Total</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {deliveries.slice(0, 5).map((ord) => (
                    <tr key={ord.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-800">{ord.id}</td>
                      <td className="px-3 py-2.5 font-bold text-slate-700">{ord.customerName}</td>
                      <td className="px-3 py-2.5 text-slate-500">{ord.items.length} items</td>
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-800">₱{ord.totalAmount.toFixed(2)}</td>
                      <td className="px-3 py-2.5">
                        <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded-full ${
                          ord.status === 'Delivered' ? 'bg-emerald-100 text-emerald-700' :
                          ord.status === 'Out for Delivery' ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {ord.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Low Stock Items Attention Panel */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>Low Stock Attention</span>
              </h3>
              <span className="px-2 py-0.5 text-[10px] font-black bg-amber-100 text-amber-800 rounded-full">
                {lowStockProducts.length} Items
              </span>
            </div>

            {lowStockProducts.length === 0 ? (
              <div className="py-8 text-center text-slate-400">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-xs font-bold uppercase tracking-wider text-slate-600">All Stocks Healthy!</p>
                <p className="text-[10px] text-slate-400 mt-1">No products are currently below low stock threshold.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto no-scrollbar">
                {lowStockProducts.slice(0, 4).map((prod) => {
                  const stock = currentBranch === 'Poblacion' ? prod.stockBranchA : prod.stockBranchB;
                  return (
                    <div key={prod.id} className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/70 flex items-center justify-between">
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="text-xs font-bold text-slate-800 truncate">{prod.name}</p>
                        <p className="text-[9px] text-slate-500 uppercase tracking-wider font-medium">{prod.category} • Code: {prod.barcode}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-black text-amber-700 font-mono block">{stock} {prod.unit}</span>
                        <span className="text-[8px] text-amber-600 uppercase font-bold block">Thres: {prod.lowStockThreshold}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 mt-4">
            <button
              onClick={onQuickRestock}
              className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-extrabold uppercase tracking-wider rounded-xl transition-all cursor-pointer text-center shadow-xs"
            >
              Go to Inventory Restock →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
