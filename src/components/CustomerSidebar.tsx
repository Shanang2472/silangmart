/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ShoppingBag, Package, Truck, User, ShoppingCart, LogOut } from 'lucide-react';

type ActiveView = 'shop' | 'orders' | 'track' | 'profile';

interface CustomerSidebarProps {
  activeView: ActiveView;
  onNavigate: (view: ActiveView) => void;
  cartItemCount: number;
  customerName: string;
  customerBarangay: string;
  storeImage: string | null;
  onLogout: () => void;
  orderCount: number;
  activeOrderCount: number;
}

const navItems: { id: ActiveView; label: string; icon: React.ElementType }[] = [
  { id: 'shop', label: 'Shop', icon: ShoppingBag },
  { id: 'orders', label: 'My Orders', icon: Package },
  { id: 'track', label: 'Track Delivery', icon: Truck },
  { id: 'profile', label: 'Profile', icon: User },
];

export default function CustomerSidebar({
  activeView,
  onNavigate,
  cartItemCount,
  customerName,
  customerBarangay,
  storeImage,
  onLogout,
  orderCount,
  activeOrderCount,
}: CustomerSidebarProps) {
  return (
    <>
      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-60 flex-col bg-white border-r border-slate-200 shadow-sm z-30">
        {/* Brand block */}
        <div className="bg-gradient-to-br from-[--color-silang-green] to-[--color-silang-green-dark] p-4 flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center text-xl shadow-inner shrink-0">
            🛒
          </div>
          <div className="min-w-0">
            <span className="text-white font-black text-[11px] uppercase tracking-widest leading-none block">
              SILANG MINI MART
            </span>
            <span className="text-green-100 text-[9px] font-medium block mt-0.5 truncate">
              Customer Portal
            </span>
          </div>
        </div>

        {/* Customer identity pill */}
        <div className="px-3 py-2.5 border-b border-slate-100 flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
            {storeImage ? (
              <img src={storeImage} alt="Store" className="w-full h-full object-cover" />
            ) : (
              <User className="h-4 w-4 text-slate-400" />
            )}
          </div>
          <div className="min-w-0">
            <span className="font-bold text-slate-800 text-xs block truncate">{customerName}</span>
            <span className="text-[9px] text-slate-400 block truncate">{customerBarangay}</span>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ id, label, icon: Icon }) => {
            const isActive = activeView === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onNavigate(id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold transition-all cursor-pointer relative ${
                  isActive
                    ? 'border-l-4 border-[--color-silang-green] bg-green-50 text-[--color-silang-green-dark]'
                    : 'border-l-4 border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">{label}</span>
                {id === 'orders' && activeOrderCount > 0 && (
                  <span className="bg-amber-100 text-amber-700 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full animate-pulse">
                    {activeOrderCount}
                  </span>
                )}
                {id === 'orders' && activeOrderCount === 0 && orderCount > 0 && (
                  <span className="bg-slate-100 text-slate-500 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full">
                    {orderCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Cart summary + Logout */}
        <div className="p-3 border-t border-slate-100 space-y-2 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('shop')}
            className="w-full flex items-center justify-between gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-slate-500" />
              <span className="text-xs font-bold text-slate-700">Cart</span>
            </div>
            {cartItemCount > 0 && (
              <span className="bg-[--color-silang-orange] text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                {cartItemCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── MOBILE BOTTOM TAB BAR ── */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 flex lg:hidden z-50">
        {navItems.map(({ id, label, icon: Icon }) => {
          const isActive = activeView === id;
          const showCartBadge = id === 'shop' && cartItemCount > 0;
          const showOrderBadge = id === 'orders' && activeOrderCount > 0;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 relative cursor-pointer transition-colors ${
                isActive
                  ? 'text-[--color-silang-green]'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <div className="relative">
                <Icon className="h-5 w-5" />
                {showCartBadge && (
                  <span className="absolute -top-1.5 -right-2 bg-[--color-silang-orange] text-white text-[8px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center">
                    {cartItemCount > 9 ? '9+' : cartItemCount}
                  </span>
                )}
                {showOrderBadge && (
                  <span className="absolute -top-1.5 -right-2 bg-amber-500 text-white text-[8px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                    {activeOrderCount > 9 ? '9+' : activeOrderCount}
                  </span>
                )}
              </div>
              <span className={`text-[9px] font-bold ${isActive ? 'font-extrabold' : ''}`}>{label}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={onLogout}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 text-slate-400 hover:text-red-600 cursor-pointer transition-colors"
          aria-label="Sign out"
        >
          <LogOut className="h-5 w-5" />
          <span className="text-[9px] font-bold">Sign Out</span>
        </button>
      </nav>
    </>
  );
}
