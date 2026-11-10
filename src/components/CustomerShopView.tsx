/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Search, ShoppingBag } from 'lucide-react';
import { Product, Branch, CartItem, PackagingVariant } from '../types';
import { getProductImages, getProductVariants } from '../utils/productUtils';

// ── Helpers (copied from CustomerPortal) ──────────────────────────────────────

function isRenderableImage(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return (
    trimmed.startsWith('http') ||
    trimmed.startsWith('/uploads/') ||
    trimmed.startsWith('data:image') ||
    trimmed.startsWith('blob:')
  );
}

function ProductImage({
  src,
  alt,
  className,
  fallback = '🛒',
}: {
  src?: string | null;
  alt: string;
  className?: string;
  fallback?: string;
}) {
  const [hasError, setHasError] = useState(false);

  React.useEffect(() => {
    setHasError(false);
  }, [src]);

  const safeFallback = isRenderableImage(fallback) ? '🛒' : fallback || '🛒';

  if (!src || !isRenderableImage(src) || hasError) {
    return (
      <span className={className?.includes('w-16') ? 'text-4xl' : 'text-sm'}>
        {safeFallback}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
    />
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface CustomerShopViewProps {
  filteredProducts: Product[];
  categories: string[];
  selectedCategory: string;
  onCategoryChange: (cat: string) => void;
  selectedBranch: Branch;
  branchCoordinates: Record<string, [number, number]>;
  onBranchChange: (branch: Branch) => void;
  cart: CartItem[];
  onAddToCart: (product: Product, variant: PackagingVariant) => void;
  activeImageIndexes: Record<string, number>;
  onImageIndexChange: (productId: string, idx: number) => void;
  onOpenCart: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CustomerShopView({
  filteredProducts,
  categories,
  selectedCategory,
  onCategoryChange,
  selectedBranch,
  branchCoordinates,
  onBranchChange,
  cart,
  onAddToCart,
  activeImageIndexes,
  onImageIndexChange,
  onOpenCart,
  searchQuery,
  onSearchChange,
}: CustomerShopViewProps) {
  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        {/* Branch selector */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">SANGAY:</span>
          <select
            value={selectedBranch}
            onChange={(e) => onBranchChange(e.target.value as Branch)}
            className="bg-slate-100 border-none rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 cursor-pointer"
          >
            {Object.keys(branchCoordinates).length > 0 ? (
              Object.keys(branchCoordinates).map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))
            ) : (
              <option value="" disabled>
                -- No registered branches --
              </option>
            )}
          </select>
        </div>

        {/* Search bar (visible on md and below — header has one on lg+) */}
        <div className="relative w-full sm:max-w-xs md:hidden">
          <input
            type="text"
            placeholder="Maghanap ng produkto..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs border rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[--color-silang-green] outline-none"
          />
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
        </div>

        {/* Cart shortcut (mobile) */}
        <button
          type="button"
          onClick={onOpenCart}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[--color-silang-orange] text-white text-xs font-bold transition-all cursor-pointer hover:opacity-90 shrink-0 sm:hidden"
        >
          <ShoppingBag className="h-3.5 w-3.5" />
          <span>
            Bag ({cart.reduce((s, i) => s + i.quantity, 0)})
          </span>
        </button>
      </div>

      {/* Category pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar select-none">
        {categories.map((cat) => {
          const isActive = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => onCategoryChange(cat)}
              className={`px-3 py-1 text-[11px] font-bold rounded-full transition-all shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-[--color-silang-orange] text-white shadow-xs'
                  : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200/80'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Product grid */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-2xl text-slate-400 font-medium">
          Maaring baguhin ang filter, walang produktong natagpuan.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((prod) => {
            const stock = prod.stockByBranch?.[selectedBranch] ?? 0;
            const isOut = stock === 0;
            const isLow = stock <= prod.lowStockThreshold && stock > 0;

            const images = getProductImages(prod);
            const activeImgIdx = activeImageIndexes[prod.id] || 0;
            const currentImg = images[activeImgIdx] || '🛒';
            const variants = getProductVariants(prod);

            return (
              <div
                key={prod.id}
                className={`group border rounded-2xl overflow-hidden bg-white hover:shadow-md transition-all duration-200 flex flex-col justify-between relative ${
                  isOut
                    ? 'border-slate-200 opacity-60'
                    : isLow
                    ? 'border-orange-200 ring-1 ring-orange-100'
                    : 'border-slate-200 hover:border-[--color-silang-green]/40'
                }`}
              >
                {/* Top color strip */}
                <div
                  className="h-1.5 w-full shrink-0"
                  style={{ backgroundColor: prod.imagePlaceholderColor || '#f97316' }}
                />

                {/* Image carousel */}
                <div className="relative bg-slate-50/50 p-3 flex flex-col items-center justify-center border-b border-slate-100 shrink-0 select-none h-24">
                  <div className="my-1 transition-all duration-300 transform group-hover:scale-110 flex items-center justify-center">
                    <ProductImage
                      src={currentImg}
                      alt={prod.name}
                      className="w-16 h-16 object-cover rounded-lg shadow-sm"
                      fallback={typeof currentImg === 'string' ? currentImg : '🛒'}
                    />
                  </div>
                  {/* Carousel dots */}
                  <div className="flex gap-1 justify-center mt-2">
                    {images.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onImageIndexChange(prod.id, idx);
                        }}
                        className={`w-1.5 h-1.5 rounded-full transition-all ${
                          idx === activeImgIdx
                            ? 'bg-[--color-silang-orange] scale-125'
                            : 'bg-slate-300 hover:bg-slate-400'
                        }`}
                        title={`Litrato ${idx + 1}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Product info */}
                <div className="p-3 flex-1 flex flex-col justify-between">
                  <div>
                    <span className="text-[9px] text-slate-400 uppercase tracking-wider block font-bold mb-0.5">
                      {prod.category}
                    </span>
                    <h4 className="font-extrabold text-slate-800 text-xs sm:text-sm line-clamp-1 group-hover:text-[--color-silang-orange] transition-colors">
                      {prod.name}
                    </h4>
                    {prod.tagalogName && (
                      <span className="text-[9px] text-slate-500 italic block leading-tight">
                        {prod.tagalogName}
                      </span>
                    )}
                    <span className="text-[8px] font-mono text-slate-400 block mt-0.5">
                      Barcode: {prod.barcode}
                    </span>
                  </div>

                  {/* Stock status */}
                  <div className="mt-2.5 flex justify-between items-center text-[10px]">
                    <span className="text-slate-400 font-bold">Stock available:</span>
                    <span
                      className={`font-mono font-bold px-1.5 py-0.5 rounded ${
                        isOut
                          ? 'bg-red-50 text-red-600 font-extrabold'
                          : isLow
                          ? 'bg-orange-50 text-orange-600 animate-pulse font-extrabold'
                          : 'bg-slate-50 text-slate-700 font-extrabold'
                      }`}
                    >
                      {isOut ? 'Ubos / Out of Stock' : `${stock} ${prod.unit}`}
                    </span>
                  </div>

                  {/* Variant buttons */}
                  <div className="mt-3 pt-2 border-t border-slate-100">
                    <p className="text-[8px] text-slate-400 font-black uppercase tracking-wider mb-1.5">
                      MGA PAGPIPILIAN (Pindutin para i-cart):
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {variants.map((v) => {
                        const isQtyOut = stock < v.qtyPerUnit;
                        return (
                          <button
                            key={v.type}
                            type="button"
                            disabled={isOut || isQtyOut}
                            onClick={() => {
                              onAddToCart(prod, v);
                              const vImgIdx = images.indexOf(v.image || '');
                              if (vImgIdx > -1) {
                                onImageIndexChange(prod.id, vImgIdx);
                              }
                            }}
                            className={`flex flex-col items-center justify-center p-1.5 rounded border text-center transition-all cursor-pointer group/btn ${
                              isQtyOut || isOut
                                ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed opacity-40'
                                : 'bg-white border-slate-200 hover:border-[--color-silang-orange] hover:bg-orange-50/10 text-slate-700 hover:text-slate-950 active:scale-95'
                            }`}
                            title={`I-add sa cart ang ${v.label}`}
                          >
                            <span className="font-bold truncate w-full uppercase text-[7px] tracking-wide text-slate-400 group-hover/btn:text-orange-600">
                              {v.type === 'retail'
                                ? 'Tingi'
                                : v.type === 'package'
                                ? 'Balot'
                                : v.type === 'box'
                                ? 'Karton'
                                : v.type === 'sack'
                                ? 'Sako'
                                : 'Pakyaw'}
                            </span>
                            <span className="text-[11px] font-bold font-mono text-slate-800 group-hover/btn:text-orange-700 mt-0.5 leading-none">
                              ₱{v.price}
                            </span>
                            <span className="text-[7px] text-slate-400 italic">
                              {v.type === 'retail'
                                ? 'Kada isa'
                                : v.type === 'sack'
                                ? `${v.qtyPerUnit} ${prod.unit} bawat sako`
                                : `x${v.qtyPerUnit} ${v.unitName}`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
