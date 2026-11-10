/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Transaction, Delivery, ServiceTransaction, Product } from '../types';
import { BarChart, TrendingUp, Coins, Award, ShoppingBag, Globe, RefreshCw, Layers, Printer } from 'lucide-react';
import { jsPDF } from 'jspdf';

type ReportPeriod = 'daily' | 'weekly' | 'monthly';

interface BranchAnalyticsProps {
  transactions: Transaction[];
  deliveries: Delivery[];
  services: ServiceTransaction[];
  products: Product[];
}

export default function BranchAnalytics({
  transactions,
  deliveries,
  services,
  products,
}: BranchAnalyticsProps) {
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('daily');
  const now = new Date();
  const periodStart = new Date(now);
  const periodEnd = new Date(now);

  if (reportPeriod === 'daily') {
    periodStart.setHours(0, 0, 0, 0);
    periodEnd.setHours(23, 59, 59, 999);
  } else if (reportPeriod === 'weekly') {
    const dayOfWeek = periodStart.getDay();
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    periodStart.setDate(periodStart.getDate() - daysFromMonday);
    periodStart.setHours(0, 0, 0, 0);
    periodEnd.setTime(periodStart.getTime());
    periodEnd.setDate(periodStart.getDate() + 6);
    periodEnd.setHours(23, 59, 59, 999);
  } else {
    periodStart.setDate(1);
    periodStart.setHours(0, 0, 0, 0);
    periodEnd.setMonth(periodStart.getMonth() + 1, 0);
    periodEnd.setHours(23, 59, 59, 999);
  }

  const isInReportPeriod = (timestamp: string) => {
    const date = new Date(timestamp);
    return date >= periodStart && date <= periodEnd;
  };

  const periodTransactions = transactions.filter((transaction) => isInReportPeriod(transaction.timestamp));
  const periodDeliveries = deliveries.filter((delivery) => isInReportPeriod(delivery.timestamp));
  const periodServices = services.filter((service) => isInReportPeriod(service.timestamp));

  // 1. Math formulas for the selected report period
  const totalRetailRevenue = periodTransactions.reduce((sum, t) => sum + t.total, 0);

  // Deliveries completed
  const completedDeliveries = periodDeliveries.filter((d) => d.status === 'Delivered');
  const totalDeliveryRevenue = completedDeliveries.reduce((sum, d) => sum + d.totalAmount, 0);

  // Services convenience fees revenue (this is net profit directly!)
  const totalServicesFees = periodServices.filter((s) => s.status === 'Completed').reduce((sum, s) => sum + s.serviceFee, 0);

  const totalGrossRevenue = totalRetailRevenue + totalDeliveryRevenue + totalServicesFees;

  // Revenue/metrics by branch (dynamic from DB-provided branch names)
  // Note: Product stock in this project is still stored as stockBranchA/stockBranchB in the Product model,
  // so stock summary cannot be fully dynamic until the DB/Product model is migrated.

  const revenueByBranch: Record<string, number> = {};
  const deliveryItemsByBranch: Record<string, number> = {};
  const servicesFeesByBranch: Record<string, number> = {};

  for (const t of periodTransactions) {
    revenueByBranch[t.branch] = (revenueByBranch[t.branch] || 0) + t.total;
  }
  for (const d of periodDeliveries) {
    if (d.status !== 'Delivered') continue;
    revenueByBranch[d.branch] = (revenueByBranch[d.branch] || 0) + d.totalAmount;
  }
  for (const s of periodServices) {
    if (s.status !== 'Completed') continue;
    revenueByBranch[s.branch] = (revenueByBranch[s.branch] || 0) + s.serviceFee;
  }

  // Stock summary fallback (legacy A/B only)
  const totalItemsA = products.reduce((sum, p) => sum + p.stockBranchA, 0);
  const totalItemsB = products.reduce((sum, p) => sum + p.stockBranchB, 0);


  // 2. Sales by Category (CSS Visualizer Chart)
  const salesByCategory: Record<string, number> = {};
  
  // Aggregate from regular transactions
  periodTransactions.forEach((t) => {
    t.items.forEach((item) => {
      const prod = products.find((p) => p.id === item.productId);
      const cat = prod ? prod.category : 'Other';
      salesByCategory[cat] = (salesByCategory[cat] || 0) + item.price * item.quantity;
    });
  });

  // Aggregate from completed deliveries
  completedDeliveries.forEach((d) => {
    d.items.forEach((item) => {
      const prod = products.find((p) => p.id === item.productId);
      const cat = prod ? prod.category : 'Other';
      salesByCategory[cat] = (salesByCategory[cat] || 0) + item.price * item.quantity;
    });
  });

  const categoriesChartData = Object.entries(salesByCategory)
    .map(([category, value]) => ({ category, value }))
    .sort((a, b) => b.value - a.value);

  const maxCategoryValue = categoriesChartData.length > 0 ? categoriesChartData[0].value : 1;

  // Best Selling Products (top 5)
  const productSalesQty: Record<string, { name: string; qty: number; revenue: number }> = {};
  periodTransactions.forEach((t) => {
    t.items.forEach((item) => {
      if (!productSalesQty[item.productId]) {
        productSalesQty[item.productId] = { name: item.name, qty: 0, revenue: 0 };
      }
      productSalesQty[item.productId].qty += item.quantity;
      productSalesQty[item.productId].revenue += item.price * item.quantity;
    });
  });

  completedDeliveries.forEach((d) => {
    d.items.forEach((item) => {
      if (!productSalesQty[item.productId]) {
        const prod = products.find((p) => p.id === item.productId);
        productSalesQty[item.productId] = { name: prod ? prod.name : item.name, qty: 0, revenue: 0 };
      }
      productSalesQty[item.productId].qty += item.quantity;
      productSalesQty[item.productId].revenue += item.price * item.quantity;
    });
  });

  const topProducts = Object.values(productSalesQty)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  const periodLabel = reportPeriod === 'daily' ? 'Daily Report' : reportPeriod === 'weekly' ? 'Weekly Report' : 'Monthly Report';
  const formatDate = (date: Date) => date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const handlePrintReport = () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 18;
    const money = (value: number) => `PHP ${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('SILANG MINI MART', pageWidth / 2, y, { align: 'center' });
    y += 8;
    doc.setFontSize(13);
    doc.text(periodLabel, pageWidth / 2, y, { align: 'center' });
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`${formatDate(periodStart)} - ${formatDate(periodEnd)}`, pageWidth / 2, y, { align: 'center' });
    y += 12;

    doc.setDrawColor(190, 190, 190);
    doc.line(15, y, pageWidth - 15, y);
    y += 9;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('SALES SUMMARY', 15, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.text(`Gross revenue: ${money(totalGrossRevenue)}`, 15, y);
    y += 6;
    doc.text(`POS sales: ${money(totalRetailRevenue)} (${periodTransactions.length} transactions)`, 15, y);
    y += 6;
    doc.text(`Delivery sales: ${money(totalDeliveryRevenue)} (${completedDeliveries.length} delivered)`, 15, y);
    y += 6;
    doc.text(`Service fees: ${money(totalServicesFees)} (${periodServices.filter((service) => service.status === 'Completed').length} completed)`, 15, y);
    y += 11;

    doc.setFont('helvetica', 'bold');
    doc.text('BRANCH PERFORMANCE', 15, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    Object.entries(revenueByBranch).sort((a, b) => b[1] - a[1]).forEach(([branch, revenue]) => {
      doc.text(`${branch}: ${money(revenue)}`, 15, y);
      y += 6;
    });
    y += 5;

    doc.setFont('helvetica', 'bold');
    doc.text('TOP SELLING PRODUCTS', 15, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    topProducts.forEach((product, index) => {
      const productLine = `${index + 1}. ${product.name} - ${product.qty} pcs - ${money(product.revenue)}`;
      doc.text(doc.splitTextToSize(productLine, pageWidth - 30), 15, y);
      y += 6;
    });
    y += 7;
    doc.setDrawColor(190, 190, 190);
    doc.line(15, y, pageWidth - 15, y);
    y += 7;
    doc.setFontSize(8);
    doc.text(`Generated: ${new Date().toLocaleString('en-PH')}`, 15, y);
    doc.save(`silang-mini-mart-${reportPeriod}-report.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-base font-black text-slate-800">Reports &amp; Analytics</h2>
          <p className="text-xs text-slate-500 mt-1">Pumili ng sakop ng ulat at i-print bilang paper-sized PDF.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1" role="group" aria-label="Report period">
            {(['daily', 'weekly', 'monthly'] as ReportPeriod[]).map((period) => (
              <button
                key={period}
                type="button"
                onClick={() => setReportPeriod(period)}
                className={`px-3 py-2 rounded-md text-xs font-bold capitalize transition-colors ${reportPeriod === period ? 'bg-silang-blue text-white shadow-sm' : 'text-slate-600 hover:bg-white'}`}
              >
                {period}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handlePrintReport}
            className="inline-flex items-center gap-2 rounded-lg bg-silang-orange px-3 py-2 text-xs font-black text-white hover:bg-silang-orange-dark transition-colors"
          >
            <Printer className="h-4 w-4" />
            Print Report
          </button>
        </div>
      </div>

      {/* 1. Main visual KPIs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Gross Sales */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Kabuuang Benta (Gross)</span>
            <span className="text-xl sm:text-2xl font-black text-silang-blue block mt-1 font-mono">
              ₱{totalGrossRevenue.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-green-600 font-bold flex items-center gap-0.5 mt-1.5">
              <TrendingUp className="h-3 w-3" />
              +14.5% vs nakaraang linggo
            </span>
          </div>
          <div className="p-3 bg-blue-50 text-silang-blue rounded-xl">
            <Coins className="h-6 w-6" />
          </div>
        </div>

        {/* KPI 2: Retail Cashier sales */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Benta sa Cashier (POS)</span>
            <span className="text-xl sm:text-2xl font-black text-slate-800 block mt-1 font-mono">
              ₱{totalRetailRevenue.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-slate-400 block mt-1.5">
              {periodTransactions.length} mga completed purchases
            </span>
          </div>
          <div className="p-3 bg-slate-50 text-slate-600 rounded-xl">
            <ShoppingBag className="h-6 w-6" />
          </div>
        </div>

        {/* KPI 3: Delivery sales */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Benta sa Hatid (Delivery)</span>
            <span className="text-xl sm:text-2xl font-black text-slate-800 block mt-1 font-mono">
              ₱{totalDeliveryRevenue.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-slate-500 font-bold block mt-1.5">
              {completedDeliveries.length} delivered orders sa Silang
            </span>
          </div>
          <div className="p-3 bg-orange-50 text-silang-orange rounded-xl">
            <Globe className="h-6 w-6" />
          </div>
        </div>

        {/* KPI 4: Services Net Fees */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Kita sa Serbisyo (Convenience Fee)</span>
            <span className="text-xl sm:text-2xl font-black text-silang-green-dark block mt-1 font-mono">
              ₱{totalServicesFees.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-green-600 font-bold block mt-1.5">
              100% Net Profit (E-load/Bills)
            </span>
          </div>
          <div className="p-3 bg-green-50 text-silang-green rounded-xl">
            <Award className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* 2. Dynamic Branch Comparison block (no hardcoded Branch A/B) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide flex items-center gap-1.5">
            <RefreshCw className="h-4 w-4 text-silang-blue" />
            Paghahambing ng Branch (Performance)
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {Object.entries(revenueByBranch)
              .sort((a, b) => b[1] - a[1])
              .map(([branchName, revenue]) => (
                <div
                  key={branchName}
                  className="border border-slate-100 rounded-xl p-4 bg-slate-50/40 relative overflow-hidden flex flex-col justify-between"
                >
                  <span className="text-[10px] font-bold text-slate-700 uppercase bg-slate-100 px-2 py-0.5 rounded">
                    {branchName}
                  </span>

                  <div className="mt-3">
                    <h4 className="font-extrabold text-slate-800 text-base">Kabuuang Benta:</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">₱{revenue.toFixed(2)}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Dami ng Item sa Estante:</span>
                      {/* Stock summary is legacy A/B-only (until DB/product model is migrated to dynamic branches) */}
                      <span className="font-bold text-slate-800 font-mono">
                        {branchName === Object.keys(revenueByBranch)[0] ? totalItemsA : totalItemsB} pcs
                      </span>

                    </div>
                  </div>
                </div>
              ))}

            {Object.keys(revenueByBranch).length === 0 && (
              <div className="col-span-full text-center py-6 text-slate-400 text-xs">
                Walang benta na maitala pa.
              </div>
            )}
          </div>

          {/* Visual Percentage Performance Bar Chart */}
          <div className="space-y-2 pt-2 text-xs">
            <span className="font-bold text-slate-500 block">Proporsyon ng Kita ng mga Branch:</span>
            {Object.keys(revenueByBranch).length > 0 ? (
              (() => {
                const entries = Object.entries(revenueByBranch);
                const total = entries.reduce((sum, [, v]) => sum + v, 0);
                if (total <= 0) {
                  return <div className="text-center py-2 text-slate-400 italic">Walang benta na maitala pa.</div>;
                }
                return (
                  <div>
                    <div className="h-4.5 w-full rounded-full bg-slate-100 overflow-hidden flex font-bold text-[9px] text-white text-center">
                      {entries.map(([branchName, revenue], idx) => (
                        <div
                          key={branchName}
                          style={{ width: `${(revenue / total) * 100}%` }}
                          className={
                            idx % 2 === 0
                              ? 'bg-silang-blue flex items-center justify-center transition-all'
                              : 'bg-silang-orange flex items-center justify-center transition-all'
                          }
                        >
                          {((revenue / total) * 100).toFixed(0)}%
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap justify-between gap-2 text-[10px] text-slate-400 mt-1 font-medium">
                      {entries
                        .sort((a, b) => b[1] - a[1])
                        .map(([branchName, revenue]) => (
                          <span key={branchName}>
                            {branchName} (₱{revenue.toFixed(0)})
                          </span>
                        ))}
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="text-center py-2 text-slate-400 italic">Walang benta na maitala pa.</div>
            )}
          </div>
        </div>


        {/* Category Sales Visual Chart (5 cols) */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide flex items-center gap-1.5">
            <BarChart className="h-4 w-4 text-silang-blue" />
            Benta Kada Kategorya (Revenue Breakdown)
          </h3>

          <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
            {categoriesChartData.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">Walang naitalang benta sa kahit anong kategorya.</div>
            ) : (
              categoriesChartData.map((item) => {
                const percent = (item.value / maxCategoryValue) * 100;
                return (
                  <div key={item.category} className="space-y-1 text-xs">
                    <div className="flex justify-between items-center font-medium">
                      <span className="text-slate-700 font-bold">{item.category}</span>
                      <span className="font-bold text-slate-900 font-mono">₱{item.value.toFixed(2)}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${percent}%` }}
                        className="bg-silang-blue h-full rounded-full transition-all"
                      ></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 3. Top selling products list & Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top 5 Products Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Award className="h-4 w-4 text-silang-orange" />
            Top 5 Best Selling na Produkto
          </h3>

          {topProducts.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">Walang sapat na transaksyon para makita ang top products.</div>
          ) : (
            <div className="divide-y text-xs font-sans">
              <div className="grid grid-cols-12 gap-1 font-bold text-slate-400 uppercase tracking-wider text-[10px] pb-2">
                <span className="col-span-7">PRODUKTO</span>
                <span className="col-span-2 text-center">BENTA QTY</span>
                <span className="col-span-3 text-right">KABUUANG KITA</span>
              </div>
              {topProducts.map((prod, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-1 py-2.5 items-center text-slate-700 hover:bg-slate-50 rounded px-1 transition-all">
                  <div className="col-span-7 flex items-center gap-1.5">
                    <span className="w-5 h-5 bg-silang-blue/10 text-silang-blue font-bold rounded-full flex items-center justify-center text-[10px]">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-slate-800 truncate">{prod.name}</span>
                  </div>
                  <span className="col-span-2 text-center font-bold font-mono">{prod.qty} pcs</span>
                  <span className="col-span-3 text-right font-bold text-slate-900 font-mono">₱{prod.revenue.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Transaction Logs list */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Layers className="h-4 w-4 text-silang-blue" />
            Huling 5 Benta sa Cashier (Logs)
          </h3>

          {periodTransactions.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">Walang nakaraang benta sa POS.</div>
          ) : (
            <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
              {periodTransactions.slice(-5).reverse().map((txn) => (
                <div key={txn.id} className="text-xs p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-800 font-mono">{txn.id}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                        txn.branch === 'Poblacion' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'
                      }`}>
                        {txn.branch}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Taga-tala: {txn.cashier} • {new Date(txn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <span className="font-bold text-silang-blue text-sm font-mono">
                    ₱{txn.total.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
