/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Product, CartItem, Branch, Transaction, PackagingVariant } from '../types';
import { Search, ShoppingCart, User, CreditCard, Percent, ChevronRight, Trash2, Printer, CheckCircle, Tag, Download, QrCode } from 'lucide-react';
import { getProductExpiryStatus, getProductImages, getProductVariants } from '../utils/productUtils';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

interface POSViewProps {
  products: Product[];
  currentBranch: Branch;
  onBranchChange: (branch: Branch) => void;
  onCheckout: (transaction: Transaction) => Promise<void> | void;
  activeCashier: string;
  categories: string[];
}

export default function POSView({
  products,
  currentBranch,
  onBranchChange,
  onCheckout,
  activeCashier,
  categories: dynamicCategories,
}: POSViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountType, setDiscountType] = useState<Transaction['discountType']>('none');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<Transaction['paymentMethod']>('Cash');
  const [amountPaid, setAmountPaid] = useState<string>('');
  const [showReceipt, setShowReceipt] = useState<Transaction | null>(null);
  const [activeImageIndexes, setActiveImageIndexes] = useState<Record<string, number>>({});
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  // Generate QR Code when a receipt is displayed
  useEffect(() => {
    if (showReceipt) {
      const qrData = `SILANG MINI MART\nOfficial Receipt\nID: ${showReceipt.id}\nBranch: ${showReceipt.branch} Branch\nDate: ${new Date(showReceipt.timestamp).toLocaleString('en-PH')}\nItems Count: ${showReceipt.items.reduce((sum, i) => sum + i.quantity, 0)}\nVAT included: PHP ${(showReceipt.vatAmount ?? 0).toFixed(2)}\nTotal: PHP ${showReceipt.total.toFixed(2)}\nSalamat po!`;
      QRCode.toDataURL(qrData, { margin: 1, width: 250 })
        .then((url) => {
          setQrCodeUrl(url);
        })
        .catch((err) => {
          console.error('Failed to generate QR Code:', err);
        });
    } else {
      setQrCodeUrl('');
    }
  }, [showReceipt]);

  // Categories list
  const categories = ['All', ...dynamicCategories];

  // Filter products based on search and category
  const filteredProducts = products.filter((prod) => {
    const matchesSearch = prod.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (prod.tagalogName && prod.tagalogName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      prod.barcode.includes(searchTerm);
    const matchesCategory = selectedCategory === 'All' || prod.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Add to cart with specific packaging variant support
  const addToCart = (product: Product, variant?: PackagingVariant) => {
    if (getProductExpiryStatus(product.expiryDate) === 'expired' || product.authenticityStatus === 'rejected') {
      alert('Hindi maaaring idagdag sa cart ang expired o tinanggihang produkto.');
      return;
    }
    // Get corresponding packaging variants or fallback
    const activeVariant = variant || getProductVariants(product).find(v => v.type === 'retail') || {
      type: 'retail',
      label: `Daily Retail (1 ${product.unit})`,
      qtyPerUnit: 1,
      price: product.price,
      cost: product.cost,
      unitName: product.unit
    };

    const currentStock = product.stockByBranch?.[currentBranch] ?? product.stockBranchA ?? 0;

    const qtyNeeded = activeVariant.qtyPerUnit;

    // Check if the same product with the exact same variant type is already in the cart
    const existingIndex = cart.findIndex(
      (item) => item.product.id === product.id && item.selectedVariant?.type === activeVariant.type
    );

    // Sum up overall required base units currently in cart for this product
    const totalQtyInCart = cart.reduce((total, item) => {
      if (item.product.id === product.id) {
        const itemQtyPerUnit = item.selectedVariant ? item.selectedVariant.qtyPerUnit : 1;
        return total + (item.quantity * itemQtyPerUnit);
      }
      return total;
    }, 0);

    if (totalQtyInCart + qtyNeeded > currentStock) {
      alert(`Oopps! Limitadong stock sa ${currentBranch} Branch. Mayroon nang ${totalQtyInCart} units sa cart at sinusubukang magdagdag ng ${qtyNeeded} units, ngunit ${currentStock} lamang ang magagamit.`);
      return;
    }

    if (existingIndex > -1) {
      const updatedCart = [...cart];
      updatedCart[existingIndex].quantity += 1;
      setCart(updatedCart);
    } else {
      setCart([...cart, { product, quantity: 1, selectedVariant: activeVariant }]);
    }
  };

  // Update quantity with variant support
  const updateQuantity = (index: number, change: number) => {
    const item = cart[index];
    const qtyPerUnit = item.selectedVariant ? item.selectedVariant.qtyPerUnit : 1;
    const currentStock = item.product.stockByBranch?.[currentBranch] ?? item.product.stockBranchA ?? 0;

    
    const newQty = item.quantity + change;

    if (newQty <= 0) {
      const updatedCart = cart.filter((_, i) => i !== index);
      setCart(updatedCart);
    } else {
      // Calculate overall product pieces in cart excluding this item
      const totalQtyOfOtherItems = cart.reduce((total, cartItem, idx) => {
        if (idx !== index && cartItem.product.id === item.product.id) {
          const itemQtyPerUnit = cartItem.selectedVariant ? cartItem.selectedVariant.qtyPerUnit : 1;
          return total + (cartItem.quantity * itemQtyPerUnit);
        }
        return total;
      }, 0);

      const totalRequiredPieces = totalQtyOfOtherItems + (newQty * qtyPerUnit);

      if (totalRequiredPieces > currentStock) {
        alert(`Oopps! Limitadong stock sa ${currentBranch} Branch. Mayroon lamang ${currentStock} ${item.product.unit} magagamit.`);
        return;
      }

      const updatedCart = [...cart];
      updatedCart[index].quantity = newQty;
      setCart(updatedCart);
    }
  };

  // Delete from cart
  const removeFromCart = (index: number) => {
    const updatedCart = cart.filter((_, i) => i !== index);
    setCart(updatedCart);
  };

  // Math calculations
  const subtotal = cart.reduce((sum, item) => {
    const price = item.selectedVariant ? item.selectedVariant.price : item.product.price;
    return sum + (price * item.quantity);
  }, 0);

  let discountAmount = 0;
  if (discountType === 'senior' || discountType === 'pwd') {
    // 20% discount on purchase
    discountAmount = Math.round(subtotal * 0.20 * 100) / 100;
  } else if (discountType === 'percentage') {
    discountAmount = Math.round(subtotal * (discountPercent / 100) * 100) / 100;
  }

  const total = Math.round((subtotal - discountAmount) * 100) / 100;
  const vatAmount = Math.round(total * 12 / 112 * 100) / 100;
  const changeValue = amountPaid ? Math.max(0, parseFloat(amountPaid) - total) : 0;

  // Checkout process
  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    const unavailableItem = cart.find(item =>
      getProductExpiryStatus(item.product.expiryDate) === 'expired' ||
      item.product.authenticityStatus === 'rejected'
    );
    if (unavailableItem) {
      alert(`Hindi maaaring i-checkout ang expired o tinanggihang produkto: ${unavailableItem.product.name}.`);
      return;
    }

    const paidNum = parseFloat(amountPaid);
    if (isNaN(paidNum) || paidNum < total) {
      alert(`Kulang ang binayad! Kailangan ng hindi bababa sa ₱${total.toFixed(2)}.`);
      return;
    }

    const transactionId = `TXN-${Date.now().toString().slice(-6)}`;
    const newTxn: Transaction = {
      id: transactionId,
      branch: currentBranch,
      items: cart.map((item) => {
        const name = item.selectedVariant 
          ? `${item.product.name} [${item.selectedVariant.label}]` 
          : item.product.name;
        const price = item.selectedVariant ? item.selectedVariant.price : item.product.price;
        const unit = item.selectedVariant ? item.selectedVariant.unitName : item.product.unit;
        return {
          productId: item.product.id,
          name,
          price,
          quantity: item.quantity,
          unit,
        };
      }),
      subtotal,
      discountType,
      discountAmount,
      vatAmount,
      total,
      paymentMethod,
      amountPaid: paidNum,
      change_amount: changeValue,
      timestamp: new Date().toISOString(),
      cashier: activeCashier,
    };

    try {
      await onCheckout(newTxn);
    } catch (error) {
      alert(error instanceof Error ? `Hindi natuloy ang checkout: ${error.message}` : 'Hindi natuloy ang checkout. Pakisubukan muli.');
      return;
    }
    setShowReceipt(newTxn);
    setCart([]);
    setAmountPaid('');
    setDiscountType('none');
    setDiscountPercent(0);
  };

  const handleDownloadPDF = () => {
    if (!showReceipt) return;

    try {
      // Calculate dynamic receipt height: 
      // Base padding + metadata + headers + each item + totals + QR code + footer
      // 80mm width thermal roll. Height grows dynamically.
      const itemHeight = 4.5;
      const baseHeight = 135; // base space for logo, metadata, totals, qr, footer
      const dynamicHeight = baseHeight + (showReceipt.items.length * itemHeight);
      
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [80, Math.max(160, dynamicHeight)]
      });

      const margin = 5;
      const width = 80;
      const rightAlign = width - margin;
      const center = width / 2;

      let y = 10;

      // 1. Header (Branding)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42); // slate-900 (Silang Blue equivalent)
      doc.text('SILANG MINI MART', center, y, { align: 'center' });
      
      y += 4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(22, 163, 74); // green-600 (Silang Green equivalent)
      doc.text('CONVENIENCE STORE', center, y, { align: 'center' });

      y += 3.5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139); // slate-500
                    // Dynamic branch address is stored in DB per registered branch.
      // POS receipt should not hardcode a city/province.
      const address = String(showReceipt.branch);
      doc.text(address, center, y, { align: 'center' });


      y += 3;
      doc.text('POS POS-001 (Official Receipt)', center, y, { align: 'center' });

      y += 3.5;
      // Dashed separator line
      doc.setFont('courier', 'normal');
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text('-'.repeat(42), margin, y);

      // 2. Transaction Metadata
      y += 3.5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(71, 85, 105); // slate-600

      doc.text('RESIDU ID:', margin, y);
      doc.setFont('helvetica', 'bold');
      doc.text(showReceipt.id, rightAlign, y, { align: 'right' });

      y += 3.5;
      doc.setFont('helvetica', 'normal');
      doc.text('PETSA:', margin, y);
      doc.text(new Date(showReceipt.timestamp).toLocaleString('en-PH'), rightAlign, y, { align: 'right' });

      y += 3.5;
      doc.text('TAGA-TALA:', margin, y);
      doc.text(showReceipt.cashier, rightAlign, y, { align: 'right' });

      y += 3.5;
      doc.text('PARAAN:', margin, y);
      doc.text(showReceipt.paymentMethod, rightAlign, y, { align: 'right' });

      y += 3.5;
      // Dashed separator line
      doc.setFont('courier', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text('-'.repeat(42), margin, y);

      // 3. Purchased Items Table Header
      y += 4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text('PRODUKTO', margin, y);
      doc.text('QTY', margin + 38, y, { align: 'center' });
      doc.text('PRESYO', rightAlign, y, { align: 'right' });

      y += 3.5;
      doc.setFont('courier', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text('-'.repeat(42), margin, y);

      y += 3.5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(51, 65, 85); // slate-700

      showReceipt.items.forEach((item) => {
        let displayName = item.name;
        // Wrap or truncate if too long for 80mm
        if (displayName.length > 22) {
          displayName = displayName.substring(0, 20) + '..';
        }
        doc.text(displayName, margin, y);
        doc.text(item.quantity.toString(), margin + 38, y, { align: 'center' });
        doc.text(`PHP ${(item.price * item.quantity).toFixed(2)}`, rightAlign, y, { align: 'right' });
        y += itemHeight;
      });

      // Dashed separator line
      doc.setFont('courier', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text('-'.repeat(42), margin, y);

      // 4. Totals Block
      y += 3.5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(71, 85, 105);

      doc.text('SUBTOTAL:', margin, y);
      doc.text(`PHP ${showReceipt.subtotal.toFixed(2)}`, rightAlign, y, { align: 'right' });

      if (showReceipt.discountAmount > 0) {
        y += 3.5;
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(220, 38, 38); // red-600
        doc.text(`BAWAS (${showReceipt.discountType.toUpperCase()}):`, margin, y);
        doc.text(`-PHP ${showReceipt.discountAmount.toFixed(2)}`, rightAlign, y, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
      }

      y += 3.5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('VAT (12%, kasama sa presyo):', margin, y);
      doc.text(`PHP ${showReceipt.vatAmount?.toFixed(2) ?? '0.00'}`, rightAlign, y, { align: 'right' });

      y += 4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text('KABUUAN:', margin, y);
      doc.text(`PHP ${showReceipt.total.toFixed(2)}`, rightAlign, y, { align: 'right' });

      y += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text('BINAYAD:', margin, y);
      doc.text(`PHP ${showReceipt.amountPaid.toFixed(2)}`, rightAlign, y, { align: 'right' });

      y += 3.5;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(51, 65, 85);
      doc.text('SUKLI:', margin, y);
      doc.text(`PHP ${showReceipt.change_amount.toFixed(2)}`, rightAlign, y, { align: 'right' });

      y += 4;
      // Dashed separator line
      doc.setFont('courier', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text('-'.repeat(42), margin, y);

      // 5. QR Code Section (Centered)
      if (qrCodeUrl) {
        y += 3;
        const qrSize = 24;
        doc.addImage(qrCodeUrl, 'PNG', center - (qrSize / 2), y, qrSize, qrSize);
        y += qrSize + 2;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.5);
        doc.setTextColor(148, 163, 184);
        doc.text('Resibo QR - Scan to Verify', center, y, { align: 'center' });
      }

      y += 3.5;
      // Dashed separator line
      doc.setFont('courier', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text('-'.repeat(42), margin, y);

      // 6. Footer
      y += 4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(71, 85, 105);
      doc.text('Maraming Salamat po sa inyong pagtangkilik!', center, y, { align: 'center' });

      y += 3;
      doc.setFont('helvetica', 'normal');
      doc.text('Mabuhay!  ', center, y, { align: 'center' });

      y += 3;
      doc.setFontSize(5);
      doc.setTextColor(148, 163, 184);
      doc.text('S-I-L-A-N-G-M-I-N-I-M-A-R-T', center, y, { align: 'center' });

      // Save PDF
      doc.save(`SilangMiniMart-Resibo-${showReceipt.id}.pdf`);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      alert('Nagka-error sa pag-download ng PDF. Subukan po uli.');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full items-stretch">
      {/* Products Column (8 Cols) */}
      <div className="lg:col-span-7 xl:col-span-8 flex flex-col h-full bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden" id="pos-products-container">
        {/* Branch & Search Headers */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/80 flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-slate-500 uppercase tracking-wider">Active Branch:</span>
            <div className="inline-flex rounded-xl bg-orange-500 text-white px-3 py-1 text-xs font-black shadow-xs tracking-wide">
              {currentBranch} Branch
            </div>
          </div>

          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search product name, tagalog name, or scan barcode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs font-bold rounded-xl border border-slate-200 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 bg-white font-sans"
            />
          </div>
        </div>

        {/* Categories Scroller */}
        <div className="px-4 py-2 bg-white border-b border-slate-100 flex gap-1.5 overflow-x-auto no-scrollbar scroll-smooth">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-silang-blue/10 text-silang-blue border border-silang-blue/20 font-semibold'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-transparent'
              }`}
            >
              {cat === 'All' ? 'Lahat' : cat}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="flex-1 p-4 overflow-y-auto min-h-[400px]">
          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <span className="text-4xl mb-2">🔍</span>
              <p className="text-sm">Walang nahanap na produkto.</p>
              <button
                onClick={() => { setSearchTerm(''); setSelectedCategory('All'); }}
                className="mt-3 text-xs text-silang-blue font-semibold hover:underline"
              >
                I-reset ang filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredProducts.map((prod) => {
                const stock = prod.stockByBranch?.[currentBranch] ?? prod.stockBranchA ?? prod.stockBranchB ?? 0;
                const isLow = stock <= prod.lowStockThreshold;
                const isOut = stock === 0;

                const images = getProductImages(prod);
                const activeImgIdx = activeImageIndexes[prod.id] || 0;
                const currentImg = images[activeImgIdx] || '🛒';
                const variants = getProductVariants(prod);
                const expiryStatus = getProductExpiryStatus(prod.expiryDate);
                const isExpired = expiryStatus === 'expired';

                return (
                  <div
                    key={prod.id}
                    className={`group text-left border rounded-xl overflow-hidden bg-white hover:shadow-md transition-all flex flex-col justify-between h-full relative ${
                      isOut || isExpired
                        ? 'border-slate-200 opacity-60'
                        : isLow
                        ? 'border-orange-200 ring-1 ring-orange-100'
                        : 'border-slate-200 hover:border-silang-blue/30'
                    }`}
                  >
                    {/* Visual Category Block */}
                    <div
                      className="h-1.5 w-full shrink-0"
                      style={{ backgroundColor: prod.imagePlaceholderColor || '#0052cc' }}
                    ></div>

                    {/* Image View with switcher dots */}
                    <div className="relative bg-slate-50/50 p-2.5 flex flex-col items-center justify-center border-b border-slate-100 shrink-0 select-none h-24">
                      <div className="my-1 transition-all duration-300 transform group-hover:scale-110 flex items-center justify-center">
                        {currentImg && (currentImg.startsWith('http') || currentImg.startsWith('data:image') || currentImg.startsWith('/uploads/')) ? (
                          <img
                            src={currentImg}
                            alt={prod.name}
                            className="w-16 h-16 object-cover rounded-lg shadow-sm"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="text-3xl">{currentImg}</span>
                        )}
                      </div>

                      {/* Dot carousel for multiple product images */}
                      <div className="flex gap-1 justify-center mt-1.5">
                        {images.map((_, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveImageIndexes(prev => ({ ...prev, [prod.id]: idx }));
                            }}
                            className={`w-1.5 h-1.5 rounded-full transition-all ${
                              idx === activeImgIdx ? 'bg-orange-500 scale-125' : 'bg-slate-300 hover:bg-slate-400'
                            }`}
                            title={`Tingnan ang litrato ${idx + 1}`}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="p-2.5 flex-1 flex flex-col justify-between">
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase tracking-wider block font-bold mb-0.5">
                          {prod.category}
                        </span>
                        <h4 className="font-bold text-slate-800 text-xs line-clamp-1 group-hover:text-silang-blue transition-colors">
                          {prod.name}
                        </h4>
                        {prod.tagalogName && (
                          <span className="text-[9px] text-slate-500 italic block leading-tight">
                            {prod.tagalogName}
                          </span>
                        )}
                        <div className="flex flex-wrap gap-1 mt-1">
                          <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold ${
                            prod.authenticityStatus === 'verified'
                              ? 'bg-emerald-100 text-emerald-700'
                              : prod.authenticityStatus === 'rejected'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-slate-100 text-slate-600'
                          }`}>
                            {prod.authenticityStatus === 'verified' ? 'Pinagmulan na-verify' : prod.authenticityStatus === 'rejected' ? 'Rejected' : 'Hindi pa verified'}
                          </span>
                          {prod.expiryDate && (
                            <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold ${
                              expiryStatus === 'expired' ? 'bg-red-100 text-red-700'
                                : expiryStatus === 'expiring' ? 'bg-amber-100 text-amber-700'
                                  : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {expiryStatus === 'expired' ? 'Expired' : expiryStatus === 'expiring' ? 'Malapit mag-expire' : 'Hindi pa expired'} · {prod.expiryDate.slice(0, 10)}
                            </span>
                          )}
                        </div>
                        <span className="text-[8px] font-mono text-slate-400 block mt-0.5">
                          Code: {prod.barcode}
                        </span>
                      </div>

                      {/* Stock summary info */}
                      <div className="mt-2 flex justify-between items-center text-[10px]">
                        <span className="text-slate-400">Stock:</span>
                        <span
                          className={`font-mono font-bold px-1.5 py-0.5 rounded ${
                            isOut
                              ? 'bg-red-50 text-red-600'
                              : isLow
                              ? 'bg-orange-50 text-orange-600 animate-pulse'
                              : 'bg-slate-50 text-slate-700'
                          }`}
                        >
                          {isOut ? 'Ubos' : `${stock} ${prod.unit}`}
                        </span>
                      </div>

                      {/* Variants Grid / Selection Buttons */}
                      <div className="mt-2.5 pt-2 border-t border-slate-100">
                        <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider mb-1">Pagpilian (Pindutin):</p>
                        <div className="grid grid-cols-2 gap-1">
                          {variants.map((v) => {
                            const isQtyOut = stock < v.qtyPerUnit;
                            return (
                              <button
                                key={v.type}
                                type="button"
                                disabled={isOut || isQtyOut || isExpired || prod.authenticityStatus === 'rejected'}
                                onClick={() => {
                                  addToCart(prod, v);
                                  // Switch active image to correspond to variant emoji if possible
                                  const vImgIdx = images.indexOf(v.image || '');
                                  if (vImgIdx > -1) {
                                    setActiveImageIndexes(prev => ({ ...prev, [prod.id]: vImgIdx }));
                                  }
                                }}
                                className={`flex flex-col items-center justify-center p-1 rounded border text-center transition-all cursor-pointer group/btn ${
                                  isQtyOut || isOut || isExpired || prod.authenticityStatus === 'rejected'
                                    ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed opacity-40'
                                    : 'bg-white border-slate-200 hover:border-orange-400 hover:bg-orange-50/10 text-slate-700 hover:text-slate-950 active:scale-95'
                                }`}
                                title={`I-add sa cart: ${v.label}`}
                              >
                                <span className="font-bold truncate w-full uppercase text-[7px] tracking-wide text-slate-400 group-hover/btn:text-orange-600">
                                  {v.type === 'retail' ? 'Tingi' : v.type === 'package' ? 'Balot' : v.type === 'box' ? 'Karton' : v.type === 'sack' ? 'Sako' : 'Pakyaw'}
                                </span>
                                <span className="text-[11px] font-bold font-mono text-slate-800 group-hover/btn:text-orange-700 mt-0.5 leading-none">
                                  ₱{v.price}
                                </span>
                                <span className="text-[7px] text-slate-400 italic">
                                  {v.type === 'retail' ? 'Kada isa' : v.type === 'sack' ? `${v.qtyPerUnit} ${prod.unit} bawat sako` : `x${v.qtyPerUnit} ${v.unitName}`}
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
      </div>

      {/* Cart Column (4-5 Cols) */}
      <div className="lg:col-span-5 xl:col-span-4 flex flex-col h-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden" id="pos-cart-container">
        {/* Cart Header */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/75 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-silang-blue/10 rounded-lg text-silang-blue">
              <ShoppingCart className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Rider / Cashier Cart</h3>
              <p className="text-[11px] text-slate-400 font-mono">Taga-tala: {activeCashier}</p>
            </div>
          </div>
          <span className="bg-silang-blue text-white text-xs font-bold px-2 py-0.5 rounded-full">
            {cart.reduce((sum, item) => sum + item.quantity, 0)} items
          </span>
        </div>

        {/* Cart items list */}
        <div className="flex-1 overflow-y-auto p-4 min-h-[250px]">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 h-full">
              <span className="text-4xl mb-2">🛒</span>
              <p className="text-sm font-medium">Walang laman ang cart</p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-[200px] text-center">
                Pumili ng mga produkto sa kaliwa para magsimula ng benta.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((item, index) => {
                const itemPrice = item.selectedVariant ? item.selectedVariant.price : item.product.price;
                const itemLabel = item.selectedVariant ? item.selectedVariant.label : `Retail (1 ${item.product.unit})`;
                const itemSubtotal = itemPrice * item.quantity;
                const itemKey = `${item.product.id}-${item.selectedVariant?.type || 'retail'}`;
                const itemImage = item.selectedVariant?.image || getProductImages(item.product)[0] || '🛒';

                return (
                  <div
                    key={itemKey}
                    className="flex items-center justify-between p-2 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-2 flex-1 pr-2 min-w-0">
                      <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-lg shadow-xs border border-slate-100 shrink-0 overflow-hidden">
                        {itemImage && (itemImage.startsWith('http') || itemImage.startsWith('data:image') || itemImage.startsWith('/uploads/')) ? (
                          <img
                            src={itemImage}
                            alt="cart item"
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          itemImage
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h5 className="font-bold text-slate-700 text-xs line-clamp-1">
                          {item.product.name}
                        </h5>
                        <p className="text-[9px] text-orange-600 font-bold uppercase tracking-wider leading-none mt-0.5">
                          {itemLabel}
                        </p>
                        <div className="flex gap-2 text-[9px] text-slate-400 font-mono mt-0.5">
                          <span>₱{itemPrice.toFixed(2)} each</span>
                          <span>•</span>
                          <span className="font-bold text-slate-600">Total: ₱{itemSubtotal.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Quantity Selector */}
                      <div className="flex items-center rounded-lg bg-slate-100 border border-slate-200 overflow-hidden text-xs">
                        <button
                          type="button"
                          onClick={() => updateQuantity(index, -1)}
                          className="px-1.5 py-0.5 hover:bg-slate-200 text-slate-600 font-bold transition-colors cursor-pointer"
                        >
                          -
                        </button>
                        <span className="px-1.5 font-bold text-slate-800">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(index, 1)}
                          className="px-1.5 py-0.5 hover:bg-slate-200 text-slate-600 font-bold transition-colors cursor-pointer"
                        >
                          +
                        </button>
                      </div>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => removeFromCart(index)}
                        className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Totals & Checkout Form */}
        <div className="p-4 bg-slate-50 border-t border-slate-200">
          <form onSubmit={handleCheckoutSubmit} className="space-y-3">
            {/* Discount Section */}
            <div className="bg-white p-2.5 rounded-lg border border-slate-200/60 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1">
                  <Tag className="h-3 w-3 text-silang-orange" />
                  Bawas o Discount
                </label>
                <div className="flex rounded bg-slate-100 p-0.5 border border-slate-200 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setDiscountType('none')}
                    className={`px-2 py-0.5 rounded font-medium cursor-pointer ${
                      discountType === 'none' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    Walang Bawas
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType('senior')}
                    className={`px-2 py-0.5 rounded font-medium cursor-pointer ${
                      discountType === 'senior' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    Senior (20%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType('pwd')}
                    className={`px-2 py-0.5 rounded font-medium cursor-pointer ${
                      discountType === 'pwd' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    PWD (20%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType('percentage')}
                    className={`px-2 py-0.5 rounded font-medium cursor-pointer ${
                      discountType === 'percentage' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    Custom %
                  </button>
                </div>
              </div>

              {discountType === 'percentage' && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-slate-500">Ilang Porsyento? (%):</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                    className="w-16 px-1.5 py-0.5 text-xs text-center border border-slate-200 rounded"
                  />
                </div>
              )}
            </div>

            {/* Calculations Panel */}
            <div className="space-y-1 text-slate-600 text-xs font-medium">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>₱{subtotal.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>
                    Bawas (
                    {discountType === 'senior'
                      ? 'Senior Citizen'
                      : discountType === 'pwd'
                      ? 'PWD'
                      : `${discountPercent}%`}
                    ):
                  </span>
                  <span>-₱{discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>VAT 12% (kasama sa presyo):</span>
                <span>₱{vatAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-slate-800 pt-1 border-t border-slate-200">
                <span>Kabuuang Bayarin:</span>
                <span className="text-silang-blue">₱{total.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              {(['Cash', 'GCash', 'Maya'] as const).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`py-1.5 px-2 text-xs font-bold rounded-lg border text-center transition-all cursor-pointer ${
                    paymentMethod === method
                      ? 'bg-silang-blue text-white border-silang-blue shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {method === 'Cash' ? '💵 Cash' : method === 'GCash' ? '🔵 GCash' : '🟢 Maya'}
                </button>
              ))}
            </div>

            {/* Paid Input & Submit */}
            <div className="space-y-2 pt-2">
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-sm">₱</span>
                <input
                  type="number"
                  placeholder="Halaga ng binayad ng customer..."
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  disabled={cart.length === 0}
                  className="w-full pl-7 pr-3 py-2 text-sm font-semibold rounded-lg border border-slate-200 focus:outline-none focus:border-silang-blue bg-white"
                />
              </div>

              {amountPaid && (
                <div className="flex justify-between items-center text-xs px-2 py-1 bg-green-50 rounded text-green-700 font-semibold">
                  <span>Sukli (Change):</span>
                  <span className="text-sm font-bold">₱{changeValue.toFixed(2)}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={cart.length === 0}
                className={`w-full py-2.5 font-bold rounded-xl text-white shadow transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  cart.length === 0
                    ? 'bg-slate-300 cursor-not-allowed'
                    : 'bg-silang-blue hover:bg-silang-blue-dark active:scale-[0.98]'
                }`}
              >
                <CreditCard className="h-4.5 w-4.5" />
                <span>I-proseso ang Bayad (₱{total.toFixed(2)})</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* POS Receipt Modal Dialog */}
      {showReceipt && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-100 flex flex-col justify-between max-h-[90vh] overflow-hidden">
            {/* Printable Area */}
            <div className="flex-1 overflow-y-auto pr-1 text-center font-mono text-xs text-slate-800 space-y-4">
              {/* Header */}
              <div className="space-y-1">
                {/* Simulated Logo Brand */}
                <div className="flex flex-col items-center">
                  <span className="text-xl">🌅</span>
                  <h2 className="text-base font-black font-display tracking-tight text-silang-blue uppercase">
                    SILANG MINI MART
                  </h2>
                  <span className="text-[10px] font-bold text-silang-green uppercase tracking-widest">
                    Convenience Store
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  {String(showReceipt.branch)}
                </p>
                <p className="text-[10px] text-slate-400">POS POS-001 (Official Receipt)</p>
              </div>

              {/* Transaction Metadata */}
              <div className="border-y border-dashed border-slate-200 py-2 text-left text-[10px] space-y-0.5 text-slate-500">
                <div className="flex justify-between">
                  <span>RESIDU ID:</span>
                  <span>{showReceipt.id}</span>
                </div>
                <div className="flex justify-between">
                  <span>PETSA:</span>
                  <span>{new Date(showReceipt.timestamp).toLocaleString('en-PH')}</span>
                </div>
                <div className="flex justify-between">
                  <span>TAGA-TALA:</span>
                  <span>{showReceipt.cashier}</span>
                </div>
                <div className="flex justify-between">
                  <span>PARAAN:</span>
                  <span>{showReceipt.paymentMethod}</span>
                </div>
              </div>

              {/* Items list */}
              <div className="space-y-1.5 text-left text-[11px]">
                <div className="grid grid-cols-12 gap-1 font-bold text-slate-600 border-b border-dashed border-slate-200 pb-1">
                  <span className="col-span-6">PRODUKTO</span>
                  <span className="col-span-2 text-center">QTY</span>
                  <span className="col-span-4 text-right">PRESYO</span>
                </div>
                {showReceipt.items.map((item) => (
                  <div key={item.productId} className="grid grid-cols-12 gap-1 text-slate-700">
                    <span className="col-span-6 truncate">{item.name}</span>
                    <span className="col-span-2 text-center">
                      {item.quantity}
                    </span>
                    <span className="col-span-4 text-right">
                      ₱{(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Totals block */}
              <div className="border-t border-dashed border-slate-200 pt-2 text-right space-y-1 text-slate-700">
                <div className="flex justify-between">
                  <span>SUBTOTAL:</span>
                  <span>₱{showReceipt.subtotal.toFixed(2)}</span>
                </div>
                {showReceipt.discountAmount > 0 && (
                  <div className="flex justify-between text-red-600 font-bold">
                    <span>BAWAS ({showReceipt.discountType.toUpperCase()}):</span>
                    <span>-₱{showReceipt.discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>VAT 12% (kasama sa presyo):</span>
                  <span>₱{(showReceipt.vatAmount ?? 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-extrabold text-sm border-t border-dashed border-slate-200 pt-1 text-slate-900">
                  <span>KABUUAN:</span>
                  <span>₱{showReceipt.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 mt-2">
                  <span>BINAYAD:</span>
                  <span>₱{showReceipt.amountPaid.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-600 font-bold">
                  <span>SUKLI:</span>
                  <span>₱{showReceipt.change_amount.toFixed(2)}</span>
                </div>
              </div>

              {/* QR Code Segment */}
              {qrCodeUrl && (
                <div className="border-t border-dashed border-slate-200 pt-3 flex flex-col items-center justify-center space-y-1 select-none">
                  <div className="bg-white p-1.5 border border-slate-200 rounded-xl shadow-xs">
                    <img
                      src={qrCodeUrl}
                      alt="Receipt QR Code"
                      className="w-24 h-24"
                    />
                  </div>
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Resibo QR - Scan to Verify</span>
                </div>
              )}

              {/* Footer */}
              <div className="border-t border-dashed border-slate-200 pt-3 text-center space-y-1 text-[10px] text-slate-400">
                <p className="font-bold text-slate-500">Maraming Salamat po sa inyong pagtangkilik!</p>
                <p>Mabuhay! 🌅</p>
                <p className="font-sans text-[8px] tracking-widest mt-1">S-I-L-A-N-G-M-I-N-I-M-A-R-T</p>
              </div>
            </div>

            {/* Print & Close Buttons */}
            <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
              <button
                type="button"
                onClick={handleDownloadPDF}
                className="w-full py-2.5 text-xs font-bold rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-[0.99] text-white shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all"
              >
                <Download className="h-4 w-4" />
                <span>I-download ang PDF Resibo</span>
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    window.print();
                  }}
                  className="py-2 text-xs font-bold rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center justify-center gap-1.5 cursor-pointer text-slate-600"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>I-print</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowReceipt(null)}
                  className="py-2 text-xs font-bold rounded-xl bg-silang-blue hover:bg-silang-blue-dark text-white flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span>Tapos Na</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
