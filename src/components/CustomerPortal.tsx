/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Product, Branch, Delivery, CartItem, PackagingVariant } from '../types';
import { MOCK_CUSTOMERS } from '../initialData';
import { getProductExpiryStatus, getProductImages, getProductVariants } from '../utils/productUtils';
import DeliveryMap from './DeliveryMap';
import DeliveryReceiptModal from './DeliveryReceiptModal';
import CustomerSidebar from './CustomerSidebar';
import {
  ShoppingBag, 
  MapPin, 
  Navigation, 
  Phone, 
  CheckCircle, 
  Clock, 
  Search, 
  User, 
  Trash2, 
  CheckSquare, 
  Smile, 
  ChevronRight, 
  TrendingUp, 
  Truck,
  Camera,
  Upload,
  LogOut,
  Eye,
  EyeOff,
  Archive,
  RotateCcw
} from 'lucide-react';

function isRenderableImage(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return trimmed.startsWith('http') || trimmed.startsWith('/uploads/') || trimmed.startsWith('data:image') || trimmed.startsWith('blob:');
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

  // Reset error state whenever the src changes so new images get a fresh attempt
  React.useEffect(() => {
    setHasError(false);
  }, [src]);

  // Ensure fallback is always a renderable emoji/text, not a URL string
  const safeFallback = isRenderableImage(fallback) ? '🛒' : (fallback || '🛒');

  if (!src || !isRenderableImage(src) || hasError) {
    return <span className={className?.includes('w-16') ? 'text-4xl' : 'text-sm'}>{safeFallback}</span>;
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

interface CustomerPortalProps {
  products: Product[];
  deliveries: Delivery[];
  branchCoordinates: Record<string, [number, number]>;
  onAddNewDelivery: (newDelivery: Delivery, paymentProof?: File) => Promise<void>;
  authenticatedCustomerName: string;
  onLogout: () => void;
  categories: string[];
  customers?: {
    name: string;
    phone: string;
    barangay: string;
    address: string;
    coordinates: [number, number];
    pin?: string;
    storeImage?: string | null;
  }[];
  onUpdateCustomerCoordinates?: (name: string, coords: [number, number], address?: string) => void;
  onUpdateDelivery?: (updated: Delivery) => void;
  onRefreshData?: () => void;
}

export default function CustomerPortal({
  products,
  deliveries,
  branchCoordinates,
  onAddNewDelivery,
  authenticatedCustomerName,
  onLogout,
  categories: dynamicCategories,
  customers = [],
  onUpdateCustomerCoordinates,
  onUpdateDelivery,
  onRefreshData,
}: CustomerPortalProps) {
  // Active Customer Profile
  const selectedProfileName = authenticatedCustomerName;
  const activeCustomerFromProps = customers?.find((c) => c.name === selectedProfileName);
  // initialData.ts intentionally exports MOCK_CUSTOMERS as never[] in this repo.
  // We keep a safe fallback instead of relying on that mock data.
  const activeCustomerFromMock = undefined as any;
  const activeCustomer: {
    name: string;
    phone: string;
    barangay: string;
    address: string;
    coordinates: [number, number];
    pin?: string;
    storeImage?: string | null;
  } =
    (activeCustomerFromProps as any) ||
    (activeCustomerFromMock as any) || {
      name: selectedProfileName || 'Tamu-tao / Guest',
      phone: '0912-345-6789',
      barangay: 'Brgy. Sabutan',
      address: '', // will be set from branch data
      coordinates: [14.2244, 120.9752] as [number, number],
      pin: '1234',
      storeImage: null
    };

  const [activeSubTab, setActiveSubTab] = useState<'shop' | 'orders' | 'tracking' | 'settings'>('shop');

  // Local state for profile form
  const [profilePhone, setProfilePhone] = useState(activeCustomer.phone || '');
  const [profileBarangay, setProfileBarangay] = useState(activeCustomer.barangay || '');
  const [profileAddress, setProfileAddress] = useState(activeCustomer.address || '');
  const [profileCoords, setProfileCoords] = useState<[number, number]>(activeCustomer.coordinates || [14.2244, 120.9752]);
  const [profilePin, setProfilePin] = useState(''); // Leave blank; only fill to change password
  const [profileStoreImage, setProfileStoreImage] = useState<string | null>(activeCustomer.storeImage || null);
  const [isUploadingProfileImage, setIsUploadingProfileImage] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [showProfilePassword, setShowProfilePassword] = useState(false);

  // Sync profile editing fields when activeCustomer changes
  React.useEffect(() => {
    if (activeCustomer) {
      setProfilePhone(activeCustomer.phone || '');
      setProfileBarangay(activeCustomer.barangay || '');
      setProfileAddress(activeCustomer.address || '');
      setProfileCoords(activeCustomer.coordinates || [14.2244, 120.9752]);
      setProfilePin(''); // Don't pre-fill password for security
      setProfileStoreImage(activeCustomer.storeImage || null);
    }
  }, [activeCustomer.name, activeCustomer.phone, activeCustomer.barangay, activeCustomer.address, activeCustomer.coordinates, activeCustomer.pin, activeCustomer.storeImage]);

  // Handle store image uploading from settings
  const handleProfileImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('storeImage', file);

    setIsUploadingProfileImage(true);
    try {
      const res = await fetch('/api/customers/upload-store-image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('silang_auth_token')}`
        },
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        setProfileStoreImage(data.imageUrl);
        alert('Matagumpay na na-upload ang litrato ng tindahan! Mangyaring i-click ang "Save Settings Changes" button sa ibaba upang mai-save ang inyong profile.');
      } else {
        alert(data.error || 'Magka-error sa pag-upload ng litrato.');
      }
    } catch (err: any) {
      console.error(err);
      alert('Network error during store image upload.');
    } finally {
      setIsUploadingProfileImage(false);
    }
  };

  // Save changes to profile details
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    // Only validate password if the customer is trying to change it
    if (profilePin.trim().length > 0 && profilePin.trim().length < 4) {
      alert('Ang Password/PIN ay dapat hindi bababa sa 4 na characters!');
      return;
    }

    setIsSavingProfile(true);
    try {
      const res = await fetch('/api/customers/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('silang_auth_token')}`
        },
        body: JSON.stringify({
          phone: profilePhone,
          barangay: profileBarangay,
          address: profileAddress,
          lat: profileCoords[0],
          lng: profileCoords[1],
          storeImage: profileStoreImage,
          pin: profilePin,
        })
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        alert('Matagumpay na na-save ang inyong Profile Settings! 🎉');
        if (onRefreshData) {
          onRefreshData();
        }
      } else {
        alert(data.error || 'Magka-error sa pag-save ng profile.');
      }
    } catch (err: any) {
      console.error(err);
      alert('Network error during profile update.');
    } finally {
      setIsSavingProfile(false);
    }
  };
  
  // Shopping state
  const [selectedBranch, setSelectedBranch] = useState<Branch>(() => Object.keys(branchCoordinates)[0] || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [deliveryReceiptToView, setDeliveryReceiptToView] = useState<Delivery | null>(null);
  const [activeImageIndexes, setActiveImageIndexes] = useState<Record<string, number>>({});

  // When branchCoordinates first loads from DB, snap selectedBranch to the first
  // real branch name so stockByBranch lookups use a valid key (not '').
  useEffect(() => {
    const branchKeys = Object.keys(branchCoordinates);
    if (branchKeys.length > 0 && (!selectedBranch || !branchKeys.includes(selectedBranch))) {
      setSelectedBranch(branchKeys[0] as Branch);
    }
  }, [branchCoordinates]);

  useEffect(() => {
    const handleChatbotAddToCart = (event: Event) => {
      const items = (event as CustomEvent<Array<{ productId: string; quantity: number }>>).detail || [];

      setCart(currentCart => {
        let updatedCart = [...currentCart];
        const stock = (product: Product) => product.stockByBranch?.[selectedBranch] ?? 0;

        for (const requestedItem of items) {
          const product = products.find(item => String(item.id) === String(requestedItem.productId));
          if (!product) continue;
          if (
            getProductExpiryStatus(product.expiryDate) === 'expired' ||
            getProductExpiryStatus(product.expiryDate) === 'unknown' ||
            product.authenticityStatus !== 'verified' ||
            !product.supplierName?.trim() ||
            !product.batchNumber?.trim()
          ) {
            window.alert(`${product.name} ay hindi available. Kailangan ng verified na supplier/batch record at valid na expiry date.`);
            continue;
          }

          const variants = getProductVariants(product);
          const retailVariant = variants.find(variant => variant.type === 'retail') || variants[0];
          const quantity = Math.max(1, Math.min(Number(requestedItem.quantity) || 1, 99));
          const unitsToAdd = quantity * (retailVariant?.qtyPerUnit || 1);
          const currentUnits = updatedCart.reduce((total, item) => {
            if (item.product.id !== product.id) return total;
            return total + (item.quantity * (item.selectedVariant?.qtyPerUnit || 1));
          }, 0);

          if (currentUnits + unitsToAdd > stock(product)) {
            window.alert(`Hindi maidadagdag ang item dahil kulang ang stock ng ${product.name} sa ${selectedBranch}.`);
            continue;
          }

          const existingIndex = updatedCart.findIndex(item =>
            item.product.id === product.id && item.selectedVariant?.type === retailVariant?.type
          );
          if (existingIndex >= 0) {
            updatedCart = updatedCart.map((item, index) =>
              index === existingIndex ? { ...item, quantity: item.quantity + quantity } : item
            );
          } else {
            updatedCart = [...updatedCart, { product, quantity, selectedVariant: retailVariant }];
          }
        }

        return updatedCart;
      });
    };

    window.addEventListener('chatbot:add-to-cart', handleChatbotAddToCart);
    return () => window.removeEventListener('chatbot:add-to-cart', handleChatbotAddToCart);
  }, [products, selectedBranch]);

  // Checkout Form States (defaults load from profile)
  const [customAddress, setCustomAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'GCash' | 'Maya'>('Cash');
  const [gcashTransactionNumber, setGcashTransactionNumber] = useState('');
  const [gcashProofFile, setGcashProofFile] = useState<File | null>(null);
  const [gcashProofPreview, setGcashProofPreview] = useState<string | null>(null);
  const [gcashProofError, setGcashProofError] = useState('');
  const [notes, setNotes] = useState('');
  const [pinCoordinates, setPinCoordinates] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (!gcashProofFile) {
      setGcashProofPreview(null);
      return;
    }

    const previewUrl = URL.createObjectURL(gcashProofFile);
    setGcashProofPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [gcashProofFile]);

  // Categories list
  const categories = ['All', ...dynamicCategories];

  // Filtered products list based on search & category
  const filteredProducts = products.filter((prod) => {
    const matchesSearch = prod.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (prod.tagalogName && prod.tagalogName.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          prod.barcode.includes(searchQuery);
    const matchesCategory = selectedCategory === 'All' || prod.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Track customer's own orders
  const customerOrders = deliveries.filter(
    (d) => d.customerName.toLowerCase() === activeCustomer.name.toLowerCase()
  );

  // Active tracking order selected by customer
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [orderHistoryView, setOrderHistoryView] = useState<'new' | 'history' | 'archived' | 'deleted'>('new');
  
  const newOrders = customerOrders.filter((d) => !d.deletedAt && !d.archivedAt && ['Pending', 'Preparing', 'Out for Delivery'].includes(d.status));
  const oldOrders = customerOrders.filter((d) => !d.deletedAt && !d.archivedAt && ['Delivered', 'Cancelled'].includes(d.status));
  const archivedOrders = customerOrders.filter((d) => !d.deletedAt && Boolean(d.archivedAt));
  const deletedOrders = customerOrders.filter((d) => Boolean(d.deletedAt));
  const visibleHistoryOrders = orderHistoryView === 'new' ? newOrders
    : orderHistoryView === 'history' ? oldOrders
    : orderHistoryView === 'archived' ? archivedOrders
    : deletedOrders;

  // Tracking is limited to active orders; completed and archived orders stay in order management.
  const activeOrder = newOrders.find((d) => d.id === activeTrackId) || newOrders[0] || null;

  const handleOrderOrganization = async (order: Delivery, action: 'archive' | 'restore' | 'delete') => {
    const labels = { archive: 'archive', restore: 'restore', delete: 'delete' };
    if (action === 'delete' && !window.confirm('Delete this order? You can restore it from Deleted Orders.')) return;
    try {
      const token = localStorage.getItem('silang_auth_token');
      const response = await fetch(`/api/deliveries/${encodeURIComponent(order.id)}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const responseText = await response.text();
      let data: any = null;
      if (responseText) {
        try {
          data = JSON.parse(responseText);
        } catch {
          throw new Error(`Server returned a non-JSON response (${response.status}). Please restart the app after updating the server.`);
        }
      }
      if (!response.ok || !data?.ok) throw new Error(data?.error || `Failed to ${labels[action]} order (${response.status}).`);
      setActiveTrackId(null);
      onRefreshData?.();
    } catch (error: any) {
      alert(error?.message || `Failed to ${labels[action]} order.`);
    }
  };

  const handleCancelOrder = async () => {
    if (!activeOrder || !onUpdateDelivery || !['Pending', 'Preparing'].includes(activeOrder.status)) return;
    if (!window.confirm('Sigurado ka bang kanselahin ang order na ito?')) return;

    try {
      await onUpdateDelivery({ ...activeOrder, status: 'Cancelled' });
      alert('Nakansela na ang order at ibinalik sa stock ang mga produkto.');
    } catch (error: any) {
      alert(error?.message || 'Hindi makansela ang order. Subukan muli.');
    }
  };

  // Add to cart with variant support
  const addToCart = (product: Product, variant: PackagingVariant) => {
    if (
      getProductExpiryStatus(product.expiryDate) === 'expired' ||
      getProductExpiryStatus(product.expiryDate) === 'unknown' ||
      product.authenticityStatus !== 'verified' ||
      !product.supplierName?.trim() ||
      !product.batchNumber?.trim()
    ) {
      alert('Hindi available ang produkto. Kailangan ng verified na supplier/batch record at valid na expiry date.');
      return;
    }
    const stock = product.stockByBranch?.[selectedBranch] ?? 0;
    const qtyNeeded = variant.qtyPerUnit;

    // Sum overall units currently in cart for this product
    const currentQtyInCart = cart.reduce((total, item) => {
      if (item.product.id === product.id) {
        const itemQtyPerUnit = item.selectedVariant ? item.selectedVariant.qtyPerUnit : 1;
        return total + (item.quantity * itemQtyPerUnit);
      }
      return total;
    }, 0);

    if (currentQtyInCart + qtyNeeded > stock) {
      alert(`Paumanhin! Limitadong stock sa ${selectedBranch} Branch. Mayroon na pong ${currentQtyInCart} units sa cart, at sinusubukan ninyong magdagdag ng ${qtyNeeded} units ngunit ${stock} units lamang ang natitirang stock.`);
      return;
    }

    const existingIndex = cart.findIndex(
      (item) => item.product.id === product.id && item.selectedVariant?.type === variant.type
    );

    if (existingIndex > -1) {
      const updatedCart = [...cart];
      updatedCart[existingIndex].quantity += 1;
      setCart(updatedCart);
    } else {
      setCart([...cart, { product, quantity: 1, selectedVariant: variant }]);
    }
  };

  // Update cart item quantity
  const updateQuantity = (index: number, change: number) => {
    const item = cart[index];
    const qtyPerUnit = item.selectedVariant ? item.selectedVariant.qtyPerUnit : 1;
    const stock = item.product.stockByBranch?.[selectedBranch] ?? 0;
    const newQty = item.quantity + change;

    if (newQty <= 0) {
      const updatedCart = [...cart];
      updatedCart.splice(index, 1);
      setCart(updatedCart);
    } else {
      // Sum overall units of other items of the same product in cart
      const totalOfOtherItems = cart.reduce((total, cartItem, idx) => {
        if (idx !== index && cartItem.product.id === item.product.id) {
          const itemQtyPerUnit = cartItem.selectedVariant ? cartItem.selectedVariant.qtyPerUnit : 1;
          return total + (cartItem.quantity * itemQtyPerUnit);
        }
        return total;
      }, 0);

      const totalRequired = totalOfOtherItems + (newQty * qtyPerUnit);

      if (totalRequired > stock) {
        alert(`Paumanhin! Hanggang ${stock} units lamang po ang stock sa ${selectedBranch} Branch.`);
        return;
      }

      const updatedCart = [...cart];
      updatedCart[index].quantity = newQty;
      setCart(updatedCart);
    }
  };

  // Math totals
  const subtotal = cart.reduce((sum, item) => {
    const price = item.selectedVariant ? item.selectedVariant.price : item.product.price;
    return sum + (price * item.quantity);
  }, 0);

  const deliveryFee = subtotal > 1000 ? 0 : 50; // free delivery above 1000 pesos
  const grandTotal = subtotal + deliveryFee;

  // Pin address on checkout map click
  const handleMapClick = (lat: number, lng: number) => {
    setPinCoordinates([lat, lng]);
  };

  // Handle Order Placement
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      alert('Mangyaring magdagdag ng kahit isang produkto sa cart bago mag-checkout.');
      return;
    }
    if (paymentMethod === 'GCash' && gcashTransactionNumber.trim().length < 3) {
      alert('Ilagay ang valid na GCash transaction number bago mag-place ng order.');
      return;
    }
    if (paymentMethod === 'GCash' && !gcashProofFile) {
      alert('Mag-upload ng screenshot ng GCash transaction bago mag-place ng order.');
      return;
    }

    const calculatedItems = cart.map((item) => {
      const price = item.selectedVariant ? item.selectedVariant.price : item.product.price;
      const name = item.selectedVariant 
        ? `${item.product.name} [${item.selectedVariant.label}]` 
        : item.product.name;
      return {
        productId: item.product.id,
        name,
        quantity: item.quantity,
        price,
        unit: item.selectedVariant?.unitName || item.product.unit,
      };
    });

    const finalAddress = customAddress.trim() || activeCustomer.address;
    const finalCoordinates = pinCoordinates || activeCustomer.coordinates;

    const newDelivery: Delivery = {
      id: `DEL-${Date.now().toString().slice(-4)}`,
      branch: selectedBranch,
      customerName: activeCustomer.name,
      customerPhone: activeCustomer.phone,
      address: finalAddress,
      barangay: activeCustomer.barangay,
      coordinates: finalCoordinates,
      status: 'Pending',
      items: calculatedItems,
      deliveryFee,
      totalAmount: grandTotal,
      driverName: 'Hindi pa nakatalaga / Unassigned',
      driverCoordinates: branchCoordinates[selectedBranch],
      etaMinutes: 0,
      notes: notes.trim() || undefined,
      timestamp: new Date().toISOString(),
      paymentMethod,
      paymentReference: paymentMethod === 'GCash' ? gcashTransactionNumber.trim() : null,
      paymentAmount: paymentMethod === 'GCash' ? grandTotal : null,
    };

    try {
      await onAddNewDelivery({
        ...newDelivery,
        // Link with POS transaction later (placeholder). Rider/payment validation relies on paymentMethod + payment endpoints.
        // If POS integration is available, set order_txn_id from POS response.
      }, paymentMethod === 'GCash' ? gcashProofFile || undefined : undefined);
      
      // Update customer default coordinate pin and address dynamically if a custom pin was made
      if (onUpdateCustomerCoordinates && pinCoordinates) {
        onUpdateCustomerCoordinates(activeCustomer.name, pinCoordinates, finalAddress);
      }

      alert(paymentMethod === 'GCash'
        ? 'Salamat po! Natanggap ang inyong order, GCash transaction number, at screenshot. Ibe-verify muna ng Silang Mini Mart ang bayad bago ito i-dispatch.'
        : 'Salamat po sa inyong Order! Matagumpay itong naisumite at inihahanda na ni Silang Mini Mart. Sundan ang inyong delivery gamit ang GPS live tracking!');
      
      // Clear and redirect
      setCart([]);
      setNotes('');
      setCustomAddress('');
      setPinCoordinates(null);
      setGcashTransactionNumber('');
      setGcashProofFile(null);
      setGcashProofError('');
      setActiveView('track');
      setActiveSubTab('tracking');
      setActiveTrackId(newDelivery.id);
    } catch (e: any) {
      alert(e?.message || 'Paumanhin, may error sa pag-proseso ng iyong order. Subukan muli.');
    }
  };

  // Compute driver distance for live tracking
  const getDistanceKm = (coord1: [number, number], coord2: [number, number]) => {
    const R = 6371; // km
    const dLat = ((coord2[0] - coord1[0]) * Math.PI) / 180;
    const dLon = ((coord2[1] - coord1[1]) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((coord1[0] * Math.PI) / 180) *
        Math.cos((coord2[0] * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const distanceKm = activeOrder
    ? getDistanceKm(activeOrder.driverCoordinates, activeOrder.coordinates)
    : 0;

  const [activeView, setActiveView] = useState<'shop' | 'orders' | 'track' | 'profile'>('shop');

  const handleSidebarNavigate = (view: 'shop' | 'orders' | 'track' | 'profile') => {
    setActiveView(view);
    setActiveSubTab(
      view === 'shop' ? 'shop' :
      view === 'orders' ? 'orders' :
      view === 'track' ? 'tracking' :
      'settings'
    );
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fff7ed_0%,_#f8fafc_35%,_#eef2ff_100%)] text-slate-800">
      <CustomerSidebar
        activeView={activeView}
        onNavigate={handleSidebarNavigate}
        cartItemCount={cart.length}
        customerName={activeCustomer.name}
        customerBarangay={activeCustomer.barangay}
        storeImage={profileStoreImage}
        onLogout={onLogout}
        orderCount={customerOrders.length}
        activeOrderCount={customerOrders.filter((order) => ['Pending', 'Preparing', 'Out for Delivery'].includes(order.status)).length}
      />

      <main className="min-h-screen pb-20 lg:ml-60 lg:pb-8">
        <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 lg:px-8">
          <header className="mb-6 overflow-hidden rounded-[28px] border border-slate-200 bg-white/90 shadow-[0_18px_45px_rgba(15,23,42,0.06)] backdrop-blur-xl">
            <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 px-4 py-5 sm:px-6 lg:px-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.2em] text-orange-50">
                    <span>🛒</span>
                    Customer Portal
                  </div>
                  <div>
                    <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl lg:text-3xl">
                      {activeView === 'shop' ? 'Silang Mini Mart Online Store' :
                        activeView === 'orders' ? 'Aking mga Order' :
                        activeView === 'track' ? 'Subaybayan ang Delivery' :
                        'Store Profile & Settings'}
                    </h1>
                    <p className="mt-1 max-w-2xl text-xs font-medium text-orange-50 sm:text-sm">
                      {activeView === 'shop' ? 'Mamili ng produkto at mag-place ng delivery order sa inyong napiling branch.' :
                        activeView === 'orders' ? 'Tingnan ang mga bagong order, nakaraang delivery, at naka-archive na order.' :
                        activeView === 'track' ? 'Sundan ang status, rider, at lokasyon ng kasalukuyang delivery.' :
                        'I-update ang inyong contact details at delivery address.'}
                    </p>
                  </div>
                </div>

                <div className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/15 bg-white/10 px-3 py-2.5 backdrop-blur-sm lg:w-auto lg:justify-start">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-lg font-black text-orange-600 shadow-md shadow-orange-700/20">
                      {activeCustomer.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-[0.22em] text-orange-100">Logged in</p>
                      <p className="truncate text-sm font-bold text-white">{activeCustomer.name}</p>
                      <p className="truncate text-[10px] text-orange-100">{activeCustomer.barangay}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onLogout}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-white/30 bg-white/15 px-3 py-2 text-[10px] font-extrabold text-white transition hover:bg-white/25 lg:hidden"
                    aria-label="Sign out of customer account"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="hidden min-[380px]:inline">Sign Out</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="grid gap-3 border-t border-slate-200 bg-slate-50/80 p-4 sm:grid-cols-3 sm:p-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Branch</p>
                <p className="mt-2 text-lg font-black text-slate-800">{selectedBranch}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Orders</p>
                <p className="mt-2 text-lg font-black text-slate-800">{customerOrders.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Cart Total</p>
                <p className="mt-2 text-lg font-black text-orange-600">₱{subtotal.toFixed(2)}</p>
              </div>
            </div>
          </header>

          <div className="space-y-6">
            {activeSubTab === 'shop' && (
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
                <div className="xl:col-span-8">
                  <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Branch</span>
                        <select
                          value={selectedBranch}
                          onChange={(e) => {
                            setSelectedBranch(e.target.value as Branch);
                            setCart([]);
                          }}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 outline-none transition focus:border-orange-500 focus:bg-white"
                        >
                          {Object.keys(branchCoordinates).length > 0 ? (
                            Object.keys(branchCoordinates).map((name) => (
                              <option key={name} value={name}>{name}</option>
                            ))
                          ) : (
                            <option value={''} disabled>-- No registered branches --</option>
                          )}
                        </select>
                      </div>

                      <div className="relative w-full sm:max-w-xs">
                        <input
                          type="text"
                          placeholder="Search products..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 py-2.5 text-xs font-medium text-slate-700 outline-none transition focus:border-orange-500 focus:bg-white"
                        />
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      </div>
                    </div>

                    <div className="mt-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                      {categories.map((cat) => {
                        const isActive = selectedCategory === cat;
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setSelectedCategory(cat)}
                            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] transition ${
                              isActive
                                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/25'
                                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {cat}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {filteredProducts.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-slate-400 shadow-sm">
                      No products found for the current filters.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                      {filteredProducts.map((prod) => {
                        const stock = prod.stockByBranch?.[selectedBranch] ?? 0;
                        const isOut = stock === 0;
                        const isLow = stock <= prod.lowStockThreshold && stock > 0;
                        const images = getProductImages(prod);
                        const activeImgIdx = activeImageIndexes[prod.id] || 0;
                        const currentImg = images[activeImgIdx] || '🛒';
                        const variants = getProductVariants(prod);
                        const expiryStatus = getProductExpiryStatus(prod.expiryDate);
                        const isUnavailable = isOut ||
                          expiryStatus === 'expired' ||
                          expiryStatus === 'unknown' ||
                          prod.authenticityStatus !== 'verified' ||
                          !prod.supplierName?.trim() ||
                          !prod.batchNumber?.trim();

                        return (
                          <article
                            key={prod.id}
                            className={`group flex min-h-[360px] flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg ${
                              isUnavailable ? 'border-slate-200 opacity-70' : isLow ? 'border-orange-200 ring-1 ring-orange-100' : 'border-slate-200'
                            }`}
                          >
                            <div className="h-1.5 w-full" style={{ backgroundColor: prod.imagePlaceholderColor || '#f97316' }} />
                            <div className="flex h-32 items-center justify-center border-b border-slate-100 bg-slate-50/60 p-3">
                              <ProductImage
                                src={currentImg}
                                alt={prod.name}
                                className="h-20 w-20 rounded-2xl object-cover shadow-sm"
                                fallback={typeof currentImg === 'string' ? currentImg : '🛒'}
                              />
                            </div>

                            <div className="flex flex-1 flex-col p-3.5">
                              <div className="mb-3">
                                <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">{prod.category}</span>
                                <h3 className="mt-1 text-sm font-black text-slate-800 line-clamp-1">{prod.name}</h3>
                                {prod.tagalogName && <p className="mt-1 text-[10px] italic text-slate-500">{prod.tagalogName}</p>}
                                <div className="mt-1 flex flex-wrap gap-1">
                                  <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold ${
                                    prod.authenticityStatus === 'verified'
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : prod.authenticityStatus === 'rejected'
                                        ? 'bg-red-100 text-red-700'
                                        : 'bg-slate-100 text-slate-600'
                                  }`}>
                                    {prod.authenticityStatus === 'verified' ? 'Supplier/lot verified' : prod.authenticityStatus === 'rejected' ? 'Not available' : 'Unverified'}
                                  </span>
                                  <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold ${
                                    expiryStatus === 'expired' ? 'bg-red-100 text-red-700'
                                      : expiryStatus === 'unknown' ? 'bg-amber-100 text-amber-700'
                                        : expiryStatus === 'expiring' ? 'bg-amber-100 text-amber-700'
                                          : 'bg-emerald-100 text-emerald-700'
                                  }`}>
                                    {expiryStatus === 'expired' ? 'Expired' : expiryStatus === 'unknown' ? 'Expiry not recorded' : expiryStatus === 'expiring' ? 'Expiring soon' : 'Not expired'}{prod.expiryDate ? ` · ${prod.expiryDate.slice(0, 10)}` : ''}
                                  </span>
                                  {prod.supplierName && (
                                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[8px] font-medium text-slate-600">
                                      Supplier · {prod.supplierName}
                                    </span>
                                  )}
                                  {prod.batchNumber && (
                                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[8px] font-medium text-slate-600">
                                      Lot · {prod.batchNumber}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="mb-3 flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-2.5 py-2 text-[10px]">
                                <span className="font-bold text-slate-500">Stock</span>
                                <span className={`rounded-md px-2 py-0.5 font-black ${
                                  isOut ? 'bg-red-100 text-red-600' : isLow ? 'bg-orange-100 text-orange-600' : 'bg-slate-200 text-slate-700'
                                }`}>
                                  {isOut ? 'Out' : `${stock} ${prod.unit}`}
                                </span>
                              </div>

                              <div className="mt-auto">
                                <p className="mb-2 text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">Choose size</p>
                                <div className="grid grid-cols-2 gap-2">
                                  {variants.map((v) => {
                                    const isQtyOut = stock < v.qtyPerUnit;
                                    return (
                                      <button
                                        key={v.type}
                                        type="button"
                                        disabled={isUnavailable || isQtyOut}
                                        onClick={() => {
                                          addToCart(prod, v);
                                          const vImgIdx = images.indexOf(v.image || '');
                                          if (vImgIdx > -1) {
                                            setActiveImageIndexes((prev) => ({ ...prev, [prod.id]: vImgIdx }));
                                          }
                                        }}
                                        className={`rounded-xl border p-2 text-center transition active:scale-[0.99] ${
                                          isQtyOut || isUnavailable
                                            ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300 opacity-50'
                                            : 'border-slate-200 bg-white text-slate-700 hover:border-orange-400 hover:bg-orange-50'
                                        }`}
                                      >
                                        <span className="block text-[7px] font-black uppercase tracking-[0.14em] text-slate-400">
                                          {v.type === 'retail' ? 'Retail' : v.type === 'package' ? 'Pack' : v.type === 'box' ? 'Box' : v.type === 'sack' ? 'Sack' : 'Bulk'}
                                        </span>
                                        <span className="mt-1 block text-xs font-black text-slate-800">₱{v.price}</span>
                                        <span className="mt-0.5 block text-[8px] text-slate-400">x{v.qtyPerUnit} {v.unitName}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>

                <aside className="xl:col-span-4">
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3.5">
                      <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-700">Delivery Bag</h2>
                      <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.12em] text-orange-700">
                        {cart.length} items
                      </span>
                    </div>

                    <div className="max-h-[620px] space-y-3 overflow-y-auto p-4">
                      {cart.length === 0 ? (
                        <div className="flex min-h-[250px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
                          <ShoppingBag className="h-10 w-10 text-slate-300" />
                          <p className="mt-3 text-sm font-bold text-slate-500">Your delivery bag is empty</p>
                          <p className="mt-1 text-[10px] text-slate-400">Pick items from the left to start your order.</p>
                        </div>
                      ) : (
                        cart.map((item, index) => {
                          const itemPrice = item.selectedVariant ? item.selectedVariant.price : item.product.price;
                          const itemLabel = item.selectedVariant ? item.selectedVariant.label : `Retail (1 ${item.product.unit})`;
                          const itemSubtotal = itemPrice * item.quantity;
                          const itemKey = `${item.product.id}-${item.selectedVariant?.type || 'retail'}`;
                          const itemImage = item.selectedVariant?.image || item.product.images?.[0] || null;

                          return (
                            <div key={itemKey} className="rounded-2xl border border-slate-200 bg-slate-50 p-2.5">
                              <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white">
                                  <ProductImage
                                    src={itemImage}
                                    alt="cart item"
                                    className="h-full w-full object-cover"
                                    fallback="🛒"
                                  />
                                </div>

                                <div className="min-w-0 flex-1">
                                  <h3 className="truncate text-xs font-black text-slate-800">{item.product.name}</h3>
                                  <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-orange-600">{itemLabel}</p>
                                  <p className="mt-1 text-[9px] font-mono text-slate-500">₱{itemPrice.toFixed(2)} each</p>
                                </div>
                              </div>

                              <div className="mt-3 flex items-center justify-between gap-2">
                                <div className="flex items-center overflow-hidden rounded-xl border border-slate-200 bg-white">
                                  <button
                                    type="button"
                                    onClick={() => updateQuantity(index, -1)}
                                    className="h-8 w-8 text-sm font-black text-slate-600 transition hover:bg-slate-100"
                                  >
                                    −
                                  </button>
                                  <span className="min-w-8 text-center text-xs font-black text-slate-800">{item.quantity}</span>
                                  <button
                                    type="button"
                                    onClick={() => updateQuantity(index, 1)}
                                    className="h-8 w-8 text-sm font-black text-slate-600 transition hover:bg-slate-100"
                                  >
                                    +
                                  </button>
                                </div>

                                <div className="text-right">
                                  <p className="text-[9px] text-slate-400">Total</p>
                                  <p className="text-xs font-black text-slate-800">₱{itemSubtotal.toFixed(2)}</p>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => updateQuantity(index, -9999)}
                                  className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <form onSubmit={handlePlaceOrder} className="space-y-3 border-t border-slate-100 bg-slate-50 p-4">
                      <div>
                        <label className="mb-1 block text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Delivery Address</label>
                        <textarea
                          rows={2}
                          value={customAddress}
                          onChange={(e) => setCustomAddress(e.target.value)}
                          placeholder={activeCustomer.address}
                          className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none transition focus:border-orange-500"
                        />
                      </div>

                      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                        <div className="flex items-center justify-between bg-slate-50 px-3 py-2">
                          <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Location Pin</span>
                          <MapPin className="h-4 w-4 text-orange-500" />
                        </div>
                        <div className="h-40">
                          <DeliveryMap
                            activeDelivery={null}
                            onMapClick={(lat, lng) => {
                              setPinCoordinates([lat, lng]);
                              if (!customAddress || customAddress === activeCustomer.address) {
                                setCustomAddress(`Pinned Point: [${lat.toFixed(5)}, ${lng.toFixed(5)}], ${activeCustomer.barangay}`);
                              }
                            }}
                            branchCoordinates={branchCoordinates}
                            height="160px"
                            showSearch={true}
                            onLocationSelected={(lat, lng, address) => {
                              setPinCoordinates([lat, lng]);
                              setCustomAddress(address);
                            }}
                          />
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Message</label>
                          <input
                            type="text"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Gate code or note"
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none transition focus:border-orange-500"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Payment</label>
                          <select
                            value={paymentMethod}
                            onChange={(e) => {
                              setPaymentMethod(e.target.value as 'Cash' | 'GCash' | 'Maya');
                              setGcashProofError('');
                            }}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none transition focus:border-orange-500"
                          >
                            <option value="Cash">Cash</option>
                            <option value="GCash">GCash</option>
                            <option value="Maya">Maya</option>
                          </select>
                        </div>
                      </div>

                      {paymentMethod === 'GCash' && (
                        <section className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50/70 p-3">
                          <div>
                            <h3 className="text-xs font-black text-blue-900">GCash payment proof</h3>
                            <p className="mt-1 text-[10px] leading-relaxed text-blue-800">
                              Pagkatapos magbayad sa GCash, ilagay ang transaction number at mag-upload ng malinaw na screenshot. Ibe-verify muna ang bayad bago ito markahang paid.
                            </p>
                          </div>
                          <div>
                            <label htmlFor="gcash-transaction-number" className="mb-1 block text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">
                              GCash transaction number <span className="text-red-500">*</span>
                            </label>
                            <input
                              id="gcash-transaction-number"
                              type="text"
                              value={gcashTransactionNumber}
                              onChange={(e) => setGcashTransactionNumber(e.target.value)}
                              minLength={3}
                              maxLength={120}
                              required
                              autoComplete="off"
                              placeholder="Ilagay ang transaction number"
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none transition focus:border-blue-500"
                            />
                          </div>
                          <div>
                            <label htmlFor="gcash-payment-proof" className="mb-1 block text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">
                              Screenshot ng transaction <span className="text-red-500">*</span>
                            </label>
                            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-blue-300 bg-white px-3 py-3 text-xs font-bold text-blue-700 transition hover:bg-blue-50">
                              <Upload className="h-4 w-4" />
                              {gcashProofFile ? 'Palitan ang screenshot' : 'Pumili ng screenshot'}
                              <input
                                id="gcash-payment-proof"
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                required
                                className="sr-only"
                                onChange={(e) => {
                                  const file = e.target.files?.[0] || null;
                                  if (file && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
                                    setGcashProofError('JPG, PNG, o WEBP image lamang ang puwedeng i-upload.');
                                    setGcashProofFile(null);
                                    e.target.value = '';
                                    return;
                                  }
                                  if (file && file.size > 5 * 1024 * 1024) {
                                    setGcashProofError('Maximum na 5 MB ang screenshot.');
                                    setGcashProofFile(null);
                                    e.target.value = '';
                                    return;
                                  }
                                  setGcashProofError('');
                                  setGcashProofFile(file);
                                }}
                              />
                            </label>
                            <p className="mt-1 text-[9px] text-slate-500">JPG, PNG, o WEBP · hanggang 5 MB</p>
                            {gcashProofError && <p role="alert" className="mt-1 text-[10px] font-bold text-red-600">{gcashProofError}</p>}
                            {gcashProofPreview && (
                              <img
                                src={gcashProofPreview}
                                alt="GCash transaction screenshot preview"
                                className="mt-2 max-h-48 w-full rounded-xl border border-slate-200 bg-white object-contain"
                              />
                            )}
                          </div>
                        </section>
                      )}

                      <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3">
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <span>Subtotal</span>
                          <span className="font-mono font-bold text-slate-700">₱{subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <span>Delivery Fee</span>
                          <span className="font-mono font-bold text-slate-700">
                            {deliveryFee === 0 ? 'FREE' : `₱${deliveryFee.toFixed(2)}`}
                          </span>
                        </div>
                        <div className="flex items-center justify-between border-t border-dashed border-slate-200 pt-2 text-sm font-black text-slate-800">
                          <span>Total</span>
                          <span className="font-mono text-orange-600">₱{grandTotal.toFixed(2)}</span>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={cart.length === 0}
                        className={`w-full rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-[0.16em] transition ${
                          cart.length === 0
                            ? 'cursor-not-allowed bg-slate-200 text-slate-400'
                            : 'bg-orange-500 text-white shadow-md shadow-orange-500/20 hover:bg-orange-600'
                        }`}
                      >
                        Place Order
                      </button>
                    </form>
                  </div>
                </aside>
              </div>
            )}

            {(activeSubTab === 'tracking' || activeSubTab === 'orders') && (
              <div className="space-y-5">
                {activeSubTab === 'tracking' && (
                  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                      <div>
                        <h2 className="text-sm font-black text-slate-800">Mga kasalukuyang order</h2>
                        <p className="mt-1 text-[11px] text-slate-500">Pumili ng order para makita ang pinakabagong delivery status.</p>
                      </div>
                      <span className="rounded-full bg-orange-50 px-3 py-1 text-[10px] font-extrabold text-orange-700">
                        {newOrders.length} active
                      </span>
                    </div>
                    {newOrders.length > 0 ? (
                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {newOrders.map((order) => (
                          <button
                            key={order.id}
                            type="button"
                            onClick={() => setActiveTrackId(order.id)}
                            className={`rounded-xl border p-3 text-left transition ${
                              activeOrder?.id === order.id
                                ? 'border-orange-300 bg-orange-50 ring-1 ring-orange-100'
                                : 'border-slate-200 bg-slate-50 hover:border-orange-200 hover:bg-orange-50/50'
                            }`}
                          >
                            <span className="flex items-center justify-between gap-2">
                              <span className="truncate font-mono text-[10px] font-bold text-slate-500">{order.id}</span>
                              <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold ${
                                order.status === 'Out for Delivery' ? 'bg-orange-100 text-orange-700' :
                                order.status === 'Preparing' ? 'bg-blue-100 text-blue-700' :
                                'bg-amber-100 text-amber-700'
                              }`}>{order.status}</span>
                            </span>
                            <span className="mt-2 flex items-center justify-between gap-2">
                              <span className="truncate text-xs font-bold text-slate-800">{order.branch}</span>
                              <span className="font-mono text-xs font-black text-slate-800">₱{order.totalAmount.toFixed(2)}</span>
                            </span>
                            <span className="mt-1 block text-[10px] text-slate-500">
                              {new Date(order.timestamp).toLocaleDateString('en-PH')}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                        <Truck className="mx-auto h-7 w-7 text-slate-300" />
                        <p className="mt-2 text-xs font-bold text-slate-600">Wala pang active delivery</p>
                        <p className="mt-1 text-[11px] text-slate-400">Makikita rito ang order kapag na-place na ito.</p>
                      </div>
                    )}
                  </section>
                )}

                {activeSubTab === 'tracking' && (
                  <>
                {activeOrder ? (
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className={`flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between ${
                      activeOrder.status === 'Delivered' ? 'bg-green-50' :
                      activeOrder.status === 'Out for Delivery' ? 'bg-orange-50' :
                      activeOrder.status === 'Cancelled' ? 'bg-red-50' :
                      'bg-slate-900'
                    }`}>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-white/80 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-slate-700">
                            {activeOrder.id}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] ${
                            activeOrder.status === 'Delivered' ? 'bg-green-100 text-green-700' :
                            activeOrder.status === 'Out for Delivery' ? 'bg-orange-100 text-orange-700' :
                            activeOrder.status === 'Cancelled' ? 'bg-red-100 text-red-700' :
                            activeOrder.status === 'Preparing' ? 'bg-blue-100 text-blue-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {activeOrder.status}
                          </span>
                        </div>
                        <h2 className={`mt-2 text-lg font-black ${activeOrder.status === 'Pending' || activeOrder.status === 'Preparing' ? 'text-white' : 'text-slate-800'}`}>
                          {activeOrder.customerName}
                        </h2>
                      </div>

                      {onUpdateDelivery && ['Pending', 'Preparing'].includes(activeOrder.status) && (
                        <button
                          type="button"
                          onClick={handleCancelOrder}
                          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-red-600 transition hover:bg-red-100"
                        >
                          Cancel Order
                        </button>
                      )}
                    </div>

                    <div className="grid gap-5 p-4 lg:grid-cols-2">
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <p className="mb-3 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Order Journey</p>
                          <div className="grid grid-cols-4 gap-2">
                            {[
                              'Ordered',
                              'Preparing',
                              'On the way',
                              'Delivered',
                            ].map((step, index) => {
                              const states = ['Pending', 'Preparing', 'Out for Delivery', 'Delivered'];
                              const isDone = states.slice(0, index + 1).includes(activeOrder.status);
                              const isCurrent = states[index] === activeOrder.status;
                              return (
                                <div key={step} className="text-center">
                                  <div className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${
                                    isDone ? 'bg-orange-500 text-white' : isCurrent ? 'border-2 border-orange-300 bg-orange-50 text-orange-600' : 'bg-white text-slate-300 border border-slate-200'
                                  }`}>
                                    {index + 1}
                                  </div>
                                  <p className="mt-1 text-[9px] font-bold text-slate-500">{step}</p>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <p className="mb-2 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Items</p>
                          <div className="space-y-2">
                            {activeOrder.items.map((item, i) => (
                              <div key={i} className="flex items-center justify-between rounded-xl bg-white px-3 py-2">
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-bold text-slate-700">{item.name}</p>
                                  <p className="text-[9px] text-slate-400">Qty: {item.quantity}</p>
                                </div>
                                <p className="font-mono text-xs font-black text-slate-800">₱{(item.price * item.quantity).toFixed(2)}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <p className="mb-2 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Delivery Details</p>
                          <div className="space-y-2 text-xs text-slate-600">
                            <p><span className="font-bold text-slate-500">Branch:</span> {activeOrder.branch}</p>
                            <p><span className="font-bold text-slate-500">Address:</span> {activeOrder.address}</p>
                            <p><span className="font-bold text-slate-500">Barangay:</span> {activeOrder.barangay}</p>
                            <p><span className="font-bold text-slate-500">Payment:</span> {activeOrder.paymentMethod || 'Cash'} · {activeOrder.paymentStatus || 'Pending'}</p>
                            {activeOrder.paymentReference && <p><span className="font-bold text-slate-500">Transaction no.:</span> <span className="font-mono">{activeOrder.paymentReference}</span></p>}
                            {activeOrder.notes && <p><span className="font-bold text-slate-500">Note:</span> {activeOrder.notes}</p>}
                          </div>
                        </div>

                        {activeOrder.status === 'Out for Delivery' && (
                          <div className="rounded-2xl border border-orange-200 bg-orange-50 p-3">
                            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-orange-500">Live GPS</p>
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              <div className="rounded-xl bg-white p-3 text-center">
                                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-orange-500">Distance</p>
                                <p className="mt-1 font-mono text-lg font-black text-orange-600">
                                  {activeOrder.driverLocationUpdatedAt ? `${distanceKm.toFixed(2)} km` : 'Waiting for GPS'}
                                </p>
                              </div>
                              <div className="rounded-xl bg-white p-3 text-center">
                                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-green-600">ETA estimate</p>
                                <p className="mt-1 font-mono text-lg font-black text-green-600">
                                  {activeOrder.driverLocationUpdatedAt ? `${activeOrder.etaMinutes} min` : 'Waiting for GPS'}
                                </p>
                              </div>
                            </div>
                            {activeOrder.driverLocationUpdatedAt && (
                              <p className="mt-2 text-center text-[10px] text-slate-500">
                                Last rider update: {new Date(activeOrder.driverLocationUpdatedAt).toLocaleTimeString()}
                                {activeOrder.driverLocationAccuracyMeters != null &&
                                  ` • GPS accuracy ±${Math.round(activeOrder.driverLocationAccuracyMeters)} m`}
                              </p>
                            )}
                            <div className="mt-3 h-[320px] overflow-hidden rounded-xl border border-slate-200 sm:h-[380px] lg:h-[420px]">
                              <DeliveryMap
                                activeDelivery={activeOrder}
                                onMapClick={handleMapClick}
                                branchCoordinates={branchCoordinates}
                                height="100%"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
                  </>
                )}

                {activeSubTab === 'orders' && (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-100 bg-slate-50 px-4 py-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-700">Orders</h2>
                      <span className="rounded-full bg-slate-200 px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.12em] text-slate-600">{visibleHistoryOrders.length} orders</span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {([
                        ['new', 'New Orders', newOrders.length],
                        ['history', 'Order History', oldOrders.length],
                        ['archived', 'Archived', archivedOrders.length],
                        ['deleted', 'Deleted', deletedOrders.length],
                      ] as const).map(([view, label, count]) => (
                        <button key={view} type="button" onClick={() => { setOrderHistoryView(view); setActiveTrackId(null); }} className={`rounded-xl px-2 py-2 text-[9px] font-black uppercase tracking-[0.08em] transition ${orderHistoryView === view ? 'bg-orange-500 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-100'}`}>
                          {label} ({count})
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {visibleHistoryOrders.map((del) => (
                      <div key={del.id} className={`transition hover:bg-slate-50 ${del.id === activeTrackId ? 'bg-orange-50' : 'bg-white'}`}>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTrackId(del.id);
                            if (['Pending', 'Preparing', 'Out for Delivery'].includes(del.status)) {
                              setActiveView('track');
                              setActiveSubTab('tracking');
                            }
                          }}
                          className="flex w-full flex-col gap-2 px-4 py-3 text-left"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div><p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">{del.id}</p><p className="text-sm font-black text-slate-800">{del.branch}</p></div>
                            <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] ${
                              del.status === 'Delivered' ? 'bg-green-100 text-green-700' : del.status === 'Out for Delivery' ? 'bg-orange-100 text-orange-700' : del.status === 'Cancelled' ? 'bg-red-100 text-red-700' : del.status === 'Preparing' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                            }`}>{del.status}</span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-500"><span>{new Date(del.timestamp).toLocaleDateString('en-PH')}</span><span className="font-mono font-black text-slate-800">₱{del.totalAmount.toFixed(2)}</span></div>
                        </button>
                        <div className="flex justify-end gap-2 px-4 pb-3">
                          {orderHistoryView === 'history' && <button type="button" onClick={() => handleOrderOrganization(del, 'archive')} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[9px] font-black uppercase text-slate-600 hover:bg-slate-100"><Archive className="h-3 w-3" /> Archive</button>}
                          {(orderHistoryView === 'history' || orderHistoryView === 'archived') && <button type="button" onClick={() => handleOrderOrganization(del, 'delete')} className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[9px] font-black uppercase text-red-600 hover:bg-red-100"><Trash2 className="h-3 w-3" /> Delete</button>}
                          {(orderHistoryView === 'archived' || orderHistoryView === 'deleted') && <button type="button" onClick={() => handleOrderOrganization(del, 'restore')} className="inline-flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1.5 text-[9px] font-black uppercase text-green-700 hover:bg-green-100"><RotateCcw className="h-3 w-3" /> Restore</button>}
                        </div>
                      </div>
                    ))}
                    {visibleHistoryOrders.length === 0 && <div className="px-4 py-10 text-center text-xs font-bold text-slate-400">No orders in this section.</div>}
                  </div>
                </div>
                )}
              </div>
            )}

            {activeSubTab === 'settings' && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                <div className="mb-5 border-b border-slate-100 pb-4">
                  <h2 className="text-lg font-black text-slate-800">Store Profile & Settings</h2>
                  <p className="mt-1 text-xs text-slate-500">Update contact details, delivery address, and store image for better rider coordination.</p>
                </div>

                <form onSubmit={handleSaveProfile} className="space-y-6">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Customer Name</label>
                      <input value={activeCustomer.name} disabled className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-500" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Phone Number</label>
                      <input value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-700 outline-none transition focus:border-orange-500 focus:bg-white" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Barangay</label>
                      <input value={profileBarangay} onChange={(e) => setProfileBarangay(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-700 outline-none transition focus:border-orange-500 focus:bg-white" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Password / PIN</label>
                      <div className="relative">
                        <input type={showProfilePassword ? 'text' : 'password'} value={profilePin} onChange={(e) => setProfilePin(e.target.value)} placeholder="Leave blank to keep current" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 pr-10 text-xs font-mono font-bold text-slate-700 outline-none transition focus:border-orange-500 focus:bg-white" />
                        <button type="button" onClick={() => setShowProfilePassword((prev) => !prev)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                          {showProfilePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Detailed Address</label>
                    <textarea rows={3} value={profileAddress} onChange={(e) => setProfileAddress(e.target.value)} className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-700 outline-none transition focus:border-orange-500 focus:bg-white" />
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Store Photo</p>
                          <p className="mt-1 text-[10px] text-slate-500">Upload a clear preview for rider delivery coordination.</p>
                        </div>
                        <label className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-700 transition hover:bg-slate-100">
                          {isUploadingProfileImage ? 'Uploading...' : 'Upload'}
                          <input type="file" accept="image/*" className="hidden" onChange={handleProfileImageUpload} disabled={isUploadingProfileImage} />
                        </label>
                      </div>

                      {profileStoreImage ? (
                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                          <img src={profileStoreImage} alt="Store Preview" className="h-40 w-full object-cover" />
                        </div>
                      ) : (
                        <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white text-sm font-bold text-slate-400">No store image</div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Map Location</p>
                      <div className="mt-3 h-52 overflow-hidden rounded-xl border border-slate-200 bg-white">
                        <DeliveryMap
                          activeDelivery={null}
                          branchCoordinates={branchCoordinates}
                          onMapClick={(lat, lng) => setProfileCoords([lat, lng])}
                          height="100%"
                          showSearch={true}
                          onLocationSelected={(lat, lng, address, barangay) => {
                            setProfileCoords([lat, lng]);
                            setProfileAddress(address);
                            if (barangay) setProfileBarangay(barangay);
                          }}
                        />
                      </div>
                      <p className="mt-3 text-[10px] font-mono font-black text-orange-600">[{profileCoords[0].toFixed(6)}, {profileCoords[1].toFixed(6)}]</p>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button type="submit" disabled={isSavingProfile || isUploadingProfileImage} className="rounded-xl bg-orange-500 px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-white shadow-md shadow-orange-500/20 transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60">
                      {isSavingProfile ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </main>

      {deliveryReceiptToView && (
        <DeliveryReceiptModal
          delivery={deliveryReceiptToView}
          onClose={() => setDeliveryReceiptToView(null)}
        />
      )}
    </div>
  );
}
