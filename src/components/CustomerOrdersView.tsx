/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Delivery } from '../types';

interface CustomerOrdersViewProps {
  customerOrders: Delivery[];
  activeTrackId: string | null;
  onSelectOrder: (id: string) => void;
  onViewReceipt: (delivery: Delivery) => void;
}

function statusBadgeClass(status: Delivery['status']): string {
  switch (status) {
    case 'Delivered':
      return 'bg-green-100 text-green-700';
    case 'Out for Delivery':
      return 'bg-purple-100 text-purple-700 animate-pulse';
    case 'Cancelled':
      return 'bg-red-100 text-red-600';
    case 'Preparing':
      return 'bg-blue-100 text-blue-700';
    default:
      return 'bg-amber-100 text-amber-700';
  }
}

function statusLabel(status: Delivery['status']): string {
  switch (status) {
    case 'Out for Delivery':
      return '⚡ TRANSIT';
    case 'Delivered':
      return '✅ DELIVERED';
    case 'Cancelled':
      return '❌ CANCELLED';
    case 'Preparing':
      return '👨‍🍳 PREPARING';
    default:
      return '⏳ PENDING';
  }
}

export default function CustomerOrdersView({
  customerOrders,
  activeTrackId,
  onSelectOrder,
  onViewReceipt,
}: CustomerOrdersViewProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
          <span>📜</span> Aking Lahat ng Order ({customerOrders.length})
        </h3>
        <div className="flex gap-2 text-[10px]">
          <span className="bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full">
            {customerOrders.filter((o) => o.status === 'Pending').length} Pending
          </span>
          <span className="bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">
            {customerOrders.filter((o) => o.status === 'Preparing').length} Preparing
          </span>
          <span className="bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">
            {customerOrders.filter((o) => o.status === 'Delivered').length} Delivered
          </span>
        </div>
      </div>

      {customerOrders.length === 0 ? (
        <div className="py-16 text-center">
          <span className="text-5xl block mb-3">🛒</span>
          <p className="text-slate-400 font-medium text-sm">
            Wala ka pang naisasagawang online delivery order.
          </p>
          <p className="text-slate-300 text-xs mt-1">
            Pumunta sa "Shop" tab para mag-order.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {customerOrders.map((del) => {
            const isSelected = del.id === (activeTrackId || customerOrders[0]?.id);
            return (
              <button
                key={del.id}
                type="button"
                onClick={() => onSelectOrder(del.id)}
                className={`w-full text-left px-4 py-4 transition-all cursor-pointer hover:bg-slate-50 ${
                  isSelected
                    ? 'bg-orange-50 border-l-4 border-l-[--color-silang-orange]'
                    : 'border-l-4 border-l-transparent'
                }`}
              >
                {/* Top row: ID, date, status */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-bold shrink-0">
                        {del.id}
                      </span>
                      <span className="font-extrabold text-slate-800 text-sm">{del.customerName}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                      <span>🏪 {del.branch}</span>
                      <span>•</span>
                      <span>
                        🕐{' '}
                        {new Date(del.timestamp).toLocaleString('en-PH', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded font-mono uppercase tracking-wider block mb-1 ${statusBadgeClass(
                        del.status
                      )}`}
                    >
                      {statusLabel(del.status)}
                    </span>
                    <span className="font-mono font-extrabold text-slate-900 text-sm">
                      ₱{del.totalAmount.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Items list */}
                <div className="bg-slate-50 rounded-xl px-3 py-2 space-y-1 mb-2">
                  <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
                    Mga na-order:
                  </p>
                  {del.items && del.items.length > 0 ? (
                    del.items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <span className="w-5 h-5 rounded bg-orange-100 text-orange-600 text-[9px] font-extrabold flex items-center justify-center shrink-0">
                            {item.quantity}×
                          </span>
                          <span className="text-slate-700 font-medium truncate">{item.name}</span>
                        </div>
                        <span className="font-mono font-bold text-slate-600 ml-2 shrink-0">
                          ₱{(item.price * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <span className="text-slate-400 text-[10px]">Walang item data</span>
                  )}
                </div>

                {/* Bottom row: fee, payment, rider, notes */}
                <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                  <span className="bg-white border border-slate-200 rounded-full px-2 py-0.5">
                    🚚 Fee: {del.deliveryFee === 0 ? 'LIBRE' : `₱${del.deliveryFee}`}
                  </span>
                  <span className="bg-white border border-slate-200 rounded-full px-2 py-0.5">
                    {del.paymentMethod === 'GCash' ? '💙' : del.paymentMethod === 'Maya' ? '💚' : '💵'}{' '}
                    {del.paymentMethod}
                  </span>
                  {del.driverName && del.driverName !== 'Hindi pa nakatalaga / Unassigned' && (
                    <span className="bg-white border border-slate-200 rounded-full px-2 py-0.5">
                      🛵 {del.driverName.split(' ').slice(0, 2).join(' ')}
                    </span>
                  )}
                  {del.notes && (
                    <span className="bg-orange-50 border border-orange-200 text-orange-600 rounded-full px-2 py-0.5 italic truncate max-w-[160px]">
                      📝 {del.notes}
                    </span>
                  )}
                </div>

                {/* Receipt button for delivered orders */}
                {del.status === 'Delivered' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewReceipt(del);
                    }}
                    className="mt-2 w-full py-1.5 bg-green-600 hover:bg-green-700 text-white font-extrabold rounded-lg text-[10px] flex items-center justify-center gap-1 cursor-pointer transition-colors"
                  >
                    🧾 Tingnan ang Resibo
                  </button>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
