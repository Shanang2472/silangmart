/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Search, ShoppingCart, LogOut } from 'lucide-react';

type ActiveView = 'shop' | 'orders' | 'track' | 'profile';

interface CustomerHeaderProps {
  customerName: string;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  cartItemCount: number;
  onCartClick: () => void;
  onLogout: () => void;
  activeView: ActiveView;
  showSearch: boolean;
}

export default function CustomerHeader({
  customerName,
  searchQuery,
  onSearchChange,
  cartItemCount,
  onCartClick,
  onLogout,
  showSearch,
}: CustomerHeaderProps) {
  return (
    <header className="sticky top-0 z-20 bg-white border-b border-slate-100 shadow-sm px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
      {/* Left: greeting */}
      <div className="flex items-center gap-2 min-w-0 shrink-0">
        <span className="text-sm font-black text-slate-800 truncate hidden sm:block">
          Kamusta, <span className="text-[--color-silang-green-dark]">{customerName}</span>!
        </span>
        <span className="text-sm font-black text-slate-800 truncate sm:hidden">
          {customerName}
        </span>
      </div>

      {/* Center: search bar (only when showSearch === true) */}
      {showSearch && (
        <div className="relative w-full max-w-sm">
          <input
            type="text"
            placeholder="Maghanap ng produkto..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[--color-silang-green] focus:border-transparent outline-none transition-all"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
        </div>
      )}

      {/* Right: cart + logout */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Cart button */}
        <button
          type="button"
          onClick={onCartClick}
          className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer"
          title="Delivery Bag"
        >
          <ShoppingCart className="h-4 w-4 text-slate-600" />
          <span className="text-xs font-bold text-slate-700 hidden sm:block">Cart</span>
          {cartItemCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-[--color-silang-orange] text-white text-[8px] font-extrabold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-0.5">
              {cartItemCount > 99 ? '99+' : cartItemCount}
            </span>
          )}
        </button>

        {/* Logout — visible on mobile (desktop logout lives in sidebar) */}
        <button
          type="button"
          onClick={onLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer md:hidden"
          title="Sign Out"
        >
          <LogOut className="h-4 w-4" />
          <span className="text-xs font-bold">Sign Out</span>
        </button>
      </div>
    </header>
  );
}
