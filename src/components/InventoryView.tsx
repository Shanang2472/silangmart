/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Product, Branch, SupplierDelivery, PackagingVariant } from '../types';
import {
  Search,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  ShieldAlert,
  PlusCircle,
  Edit3,
  Trash2,
  FolderEdit,
  AlertTriangle,
  Sliders,
  Check,
  X,
  Settings,
} from 'lucide-react';
import { getProductExpiryStatus, getProductVariants, getProductImages } from '../utils/productUtils';
import type { VariantType } from '../types/upload';
import InventoryVariantImagesFields, { type VariantImagesState } from './InventoryVariantImagesFields';

interface InventoryViewProps {
  products: Product[];
  currentBranch: Branch;
  branches?: { id?: number; name: string }[];
  onBranchChange: (branch: Branch) => void;
  onUpdateStocks: (productId: string, branch: Branch, newStock: number, overStockThreshold?: number) => void;
  onAddNewProduct: (newProduct: Product) => Promise<void> | void;
  onAddSupplierDelivery: (delivery: SupplierDelivery) => void;
  supplierDeliveries: SupplierDelivery[];
  categories: string[];
  onAddCategory: (category: string) => void;
  onDeleteCategory: (category: string) => void;
  onRenameCategory: (oldName: string, newName: string) => void;
  onUpdateProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  prefillLowStockProducts?: boolean;
  onPrefillConsumed?: () => void;
}

function buildProductVariants(
  price: number,
  cost: number,
  unit: Product['unit'],
  images: string[],
  packagePriceInput: string,
  boxPriceInput: string,
  wholesalePriceInput: string,
  sackPriceInput: string,
  sackQuantityInput: string,
  existingVariantImages?: Partial<Record<VariantType, string>>,
): PackagingVariant[] {
  const optionalPrices = [
    { type: 'package' as const, input: packagePriceInput, label: 'Presyo ng Balot / Package', quantity: 6, unitName: 'pack', image: existingVariantImages?.package || images[1] || '🛍️' },
    { type: 'box' as const, input: boxPriceInput, label: 'Presyo ng Karton / Box', quantity: 24, unitName: 'box', image: existingVariantImages?.box || images[2] || '📦' },
    { type: 'wholesale' as const, input: wholesalePriceInput, label: 'Presyo ng Pakyaw / Wholesale', quantity: 100, unitName: 'bulk', image: existingVariantImages?.wholesale || images[3] || '🚚' },
  ];
  const variants: PackagingVariant[] = [
    { type: 'retail', label: `Daily Retail (1 ${unit})`, qtyPerUnit: 1, price, cost, unitName: unit, image: existingVariantImages?.retail || images[0] || '🌾' },
  ];

  for (const optional of optionalPrices) {
    if (optional.input.trim() === '') continue;

    const variantPrice = Number(optional.input);
    if (!Number.isFinite(variantPrice) || variantPrice < 0) {
      throw new Error(`${optional.label} ay dapat zero o mas mataas na numero.`);
    }

    variants.push({
      type: optional.type,
      label: `${optional.type === 'package' ? 'Pack / Balot' : optional.type === 'box' ? 'Box / Karton' : 'Wholesale Pakyaw'} (${optional.quantity} ${unit}s)`,
      qtyPerUnit: optional.quantity,
      price: variantPrice,
      cost: cost * optional.quantity,
      unitName: optional.unitName,
      image: optional.image,
    });
  }

  if (sackPriceInput.trim() !== '') {
    const sackPrice = Number(sackPriceInput);
    const sackQuantity = Number(sackQuantityInput);
    if (!Number.isFinite(sackPrice) || sackPrice < 0) {
      throw new Error('Ang presyo ng sako ay dapat zero o mas mataas na numero.');
    }
    if (!Number.isInteger(sackQuantity) || sackQuantity <= 0) {
      throw new Error('Maglagay ng wastong bigat o quantity ng bawat sako.');
    }

    variants.push({
      type: 'sack',
      label: `Sako (${sackQuantity} ${unit})`,
      qtyPerUnit: sackQuantity,
      price: sackPrice,
      cost: cost * sackQuantity,
      unitName: 'sako',
      image: existingVariantImages?.sack || images[4] || '🌾',
    });
  }

  return variants;
}

interface ProductTraceabilityFieldsProps {
  batchNumber: string;
  setBatchNumber: React.Dispatch<React.SetStateAction<string>>;
  supplierName: string;
  setSupplierName: React.Dispatch<React.SetStateAction<string>>;
  expiryDate: string;
  setExpiryDate: React.Dispatch<React.SetStateAction<string>>;
  authenticityStatus: NonNullable<Product['authenticityStatus']>;
  setAuthenticityStatus: React.Dispatch<React.SetStateAction<NonNullable<Product['authenticityStatus']>>>;
}

function ProductTraceabilityFields({
  batchNumber,
  setBatchNumber,
  supplierName,
  setSupplierName,
  expiryDate,
  setExpiryDate,
  authenticityStatus,
  setAuthenticityStatus,
}: ProductTraceabilityFieldsProps) {
  return (
    <div className="col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
      <div className="sm:col-span-2">
        <h4 className="text-xs font-bold text-emerald-800">Product traceability at kaligtasan</h4>
        <p className="mt-1 text-[10px] text-slate-500">Ilagay ang impormasyon mula sa supplier invoice at packaging. Ang status ay staff-verified record, hindi awtomatikong patunay ng authenticity.</p>
      </div>
      <label className="text-[11px] font-semibold text-slate-600">
        Supplier / pinanggalingan
        <input value={supplierName} onChange={(event) => setSupplierName(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-normal" placeholder="Pangalan ng supplier" />
      </label>
      <label className="text-[11px] font-semibold text-slate-600">
        Batch / lot number
        <input value={batchNumber} onChange={(event) => setBatchNumber(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono font-normal" placeholder="Nasa packaging o invoice" />
      </label>
      <label className="text-[11px] font-semibold text-slate-600">
        Expiry date
        <input type="date" value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-normal" />
      </label>
      <label className="text-[11px] font-semibold text-slate-600">
        Pag-verify ng pinagmulan
        <select value={authenticityStatus} onChange={(event) => setAuthenticityStatus(event.target.value as NonNullable<Product['authenticityStatus']>)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-normal">
          <option value="unverified">Hindi pa nabe-verify</option>
          <option value="verified">Na-verify ang supplier / batch</option>
          <option value="rejected">Tinanggihan / kahina-hinala</option>
        </select>
      </label>
    </div>
  );
}

export default function InventoryView({
  products,
  currentBranch,
  branches = [],
  onBranchChange,
  onUpdateStocks,
  onAddNewProduct,
  onAddSupplierDelivery,
  supplierDeliveries,
  categories,
  onAddCategory,
  onDeleteCategory,
  onRenameCategory,
  onUpdateProduct,
  onDeleteProduct,
  prefillLowStockProducts,
  onPrefillConsumed,
}: InventoryViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'list' | 'deliveries' | 'add-product' | 'supplier-form' | 'manage-categories' | 'edit-product'>('list');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [stockAdjustmentQty, setStockAdjustmentQty] = useState('');
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'subtract' | 'set'>('add');
  const [modalOverStockLimit, setModalOverStockLimit] = useState<string>('');

  // Stock Limit Manager States
  const [defaultStockLimit, setDefaultStockLimit] = useState<number>(500);
  const [showStockLimitModal, setShowStockLimitModal] = useState<boolean>(false);
  const [bulkLimitInput, setBulkLimitInput] = useState<string>('500');
  const [bulkLimitCategory, setBulkLimitCategory] = useState<string>('All');
  const [isSavingBulkLimit, setIsSavingBulkLimit] = useState<boolean>(false);

  // Category Manager State
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');

  // Add/Edit Product Form States
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [newProdName, setNewProdName] = useState('');
  const [newProdTagalog, setNewProdTagalog] = useState('');
  const [newProdCategory, setNewProdCategory] = useState<string>('');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdCost, setNewProdCost] = useState('');
  const [newProdBatchNumber, setNewProdBatchNumber] = useState('');
  const [newProdSupplierName, setNewProdSupplierName] = useState('');
  const [newProdExpiryDate, setNewProdExpiryDate] = useState('');
  const [newProdAuthenticityStatus, setNewProdAuthenticityStatus] = useState<NonNullable<Product['authenticityStatus']>>('unverified');

  const [newProdBranchesLoading, setNewProdBranchesLoading] = useState(false);
  const [newProdBranches, setNewProdBranches] = useState<string[]>([]);
  const [newProdStockByBranch, setNewProdStockByBranch] = useState<Record<string, string>>({});

  // Legacy fields kept for compatibility (used only in edit form prefill)
  const [newProdStockA, setNewProdStockA] = useState('');
  const [newProdStockB, setNewProdStockB] = useState('');

  const [newProdShelf, setNewProdShelf] = useState('');

  const [newProdBarcode, setNewProdBarcode] = useState('');
  const [newProdUnit, setNewProdUnit] = useState<Product['unit']>('pc');
  const [newProdThreshold, setNewProdThreshold] = useState('50');
  const [newProdOverStockLimit, setNewProdOverStockLimit] = useState('500');

  // Load default_stock_limit from settings
  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((settings) => {
        if (settings?.default_stock_limit) {
          let val = settings.default_stock_limit;
          if (typeof val === 'string') {
            try { val = JSON.parse(val); } catch {}
          }
          const num = Number(val);
          if (Number.isFinite(num) && num > 0) {
            setDefaultStockLimit(num);
            setBulkLimitInput(num.toString());
            setNewProdOverStockLimit(num.toString());
          }
        }
      })
      .catch((err) => console.error('Failed to load system settings:', err));
  }, []);

  // Image Upload and URLs
  const [newProdImageUrl, setNewProdImageUrl] = useState('');

  // Variant images (device upload)
  const [variantImages, setVariantImages] = useState<VariantImagesState>({});
  // Existing variant image URLs already stored in the product
  const [existingVariantImageUrls, setExistingVariantImageUrls] = useState<Partial<Record<VariantType, string>>>({});

  // Custom Packaging prices
  const [newProdPkgPrice, setNewProdPkgPrice] = useState('');
  const [newProdBoxPrice, setNewProdBoxPrice] = useState('');
  const [newProdWholesalePrice, setNewProdWholesalePrice] = useState('');
  const [newProdSackPrice, setNewProdSackPrice] = useState('');
  const [newProdSackQty, setNewProdSackQty] = useState('');

  // Supplier Delivery Form State
  const [supplierName, setSupplierName] = useState('');
  const [deliveryBranch, setDeliveryBranch] = useState<Branch>(currentBranch); 

  useEffect(() => {
    setDeliveryBranch(currentBranch);
  }, [currentBranch]);

  const [deliveryItems, setDeliveryItems] = useState<{ productId: string; quantity: number; cost: number }[]>([]);

  const getBranchStock = (product: Product | null | undefined, branch: Branch = currentBranch) => {
    if (!product) return 0;
    return product.stockByBranch?.[branch] ?? 0;
  };

  const getProductMaxLimit = (prod: Product | null | undefined): number => {
    if (!prod) return defaultStockLimit;
    return (prod.overStockThreshold !== undefined && prod.overStockThreshold !== null && prod.overStockThreshold > 0)
      ? prod.overStockThreshold
      : defaultStockLimit;
  };

  const currentSelectedStock = selectedProduct ? getBranchStock(selectedProduct, currentBranch) : 0;
  const currentSelectedLimit = selectedProduct ? getProductMaxLimit(selectedProduct) : defaultStockLimit;
  const isProductOverstocked = currentSelectedStock >= currentSelectedLimit;

  useEffect(() => {
    if (selectedProduct && currentSelectedStock >= currentSelectedLimit) {
      setAdjustmentType('subtract');
    }
  }, [selectedProduct, currentSelectedStock, currentSelectedLimit]);

  const getStockStatusLabel = (stock: number, threshold: number, maxLimit: number = defaultStockLimit) => {
    if (stock <= 0) return 'Out of stock';
    if (stock >= maxLimit) return 'Overstock';
    if (stock <= threshold) return 'Low stock';
    return 'Healthy';
  };

  // Automatically select the first category as default when category list loads/updates
  useEffect(() => {
    if (categories.length > 0 && !newProdCategory) {
      setNewProdCategory(categories[0]);
    }
  }, [categories, newProdCategory]);

  // Handle prefill trigger from sidebar
  useEffect(() => {
    if (prefillLowStockProducts) {
      setViewMode('supplier-form');
      setDeliveryBranch(currentBranch);

      const lowStockItems = products
        .filter((prod) => {
          const stock = prod.stockByBranch?.[currentBranch] ?? 0;
          return stock <= prod.lowStockThreshold;
        })
        .map((prod) => {
          const currentStock = prod.stockByBranch?.[currentBranch] ?? 0;
          const targetQty = Math.max(10, prod.lowStockThreshold * 2 - currentStock);
          return {
            productId: prod.id,
            quantity: targetQty,
            cost: prod.cost,
          };
        });


      if (lowStockItems.length > 0) {
        setDeliveryItems(lowStockItems);
        setSupplierName('Silang Wholesale Distributor');
      }

      onPrefillConsumed?.();
    }
  }, [prefillLowStockProducts, currentBranch, products, onPrefillConsumed]);

  // Handle device image upload
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageUploadError(null);

    const formData = new FormData();
    formData.append('image', file);

    try {
      const token = localStorage.getItem('silang_auth_token');
      const res = await fetch('/api/products/upload-image', {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error || 'Hindi na-upload ang larawan. Pakisubukan muli.';
        console.error('Image upload failed:', msg);
        setImageUploadError(msg);
        return;
      }
      // TODO: implement cleanup of orphaned uploads if product save fails
      setNewProdImageUrl(data.url);
    } catch (err: any) {
      const msg = err?.message || 'Hindi na-upload ang larawan. Pakisubukan muli.';
      console.error('Image upload error:', err);
      setImageUploadError(msg);
    }
  };

  // Filter items
  const [viewModeState] = useState(0);

  const filteredProducts = products.filter((prod) => {
    const matchesSearch =
      prod.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (prod.tagalogName && prod.tagalogName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      prod.barcode.includes(searchTerm) ||
      prod.shelfLocation.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || prod.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const lowStockProducts = products.filter((prod) => {
    const stock = prod.stockByBranch?.[currentBranch] ?? 0;
    return stock <= prod.lowStockThreshold;
  });


  const overStockProducts = products.filter((prod) => {
    const stock = prod.stockByBranch?.[currentBranch] ?? 0;
    const limit = getProductMaxLimit(prod);
    return stock >= limit;
  });

  const handleOpenStockAdjust = (prod: Product) => {
    setSelectedProduct(prod);
    setStockAdjustmentQty('');
    setAdjustmentType('add');
    setModalOverStockLimit(getProductMaxLimit(prod).toString());
  };

  // Handle stock adjustments
  const handleStockAdjustmentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    const qtyNum = Number.parseInt(stockAdjustmentQty, 10);
    if (!Number.isInteger(qtyNum) || qtyNum < 0) {
      alert('Maglagay ng tamang bilang ng stock.');
      return;
    }

    const currentStock = getBranchStock(selectedProduct, currentBranch);
    const parsedLimit = parseInt(modalOverStockLimit, 10);
    const effectiveLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : getProductMaxLimit(selectedProduct);

    let finalQty = currentStock;
    if (adjustmentType === 'add') {
      finalQty = currentStock + qtyNum;
    } else if (adjustmentType === 'subtract') {
      if (currentStock <= 0) {
        alert(`Hindi puwedeng bawasan ang stock. Ang "${selectedProduct.name}" ay already out of stock.`);
        return;
      }
      finalQty = Math.max(0, currentStock - qtyNum);
      if (currentStock <= selectedProduct.lowStockThreshold && finalQty < currentStock) {
        if (!confirm(`Pansin: Ang "${selectedProduct.name}" ay nasa low stock threshold na. Nais mo pa rin bang magbawas?`)) {
          return;
        }
      }
    } else if (adjustmentType === 'set') {
      finalQty = qtyNum;
    }

    if (finalQty > effectiveLimit) {
      alert(`Hindi puwede ang stock na ${finalQty}. Lalampas ito sa Maximum Stock Limit na ${effectiveLimit}. Maaari mong i-adjust ang Stock Limit sa field sa ibaba kung nais mo itong taasan.`);
      return;
    }

    // Call onUpdateStocks with optional updated overStockThreshold
    const updatedLimit = (Number.isFinite(parsedLimit) && parsedLimit > 0 && parsedLimit !== selectedProduct.overStockThreshold)
      ? parsedLimit
      : undefined;

    onUpdateStocks(selectedProduct.id, currentBranch, finalQty, updatedLimit);
    setSelectedProduct(null);
    setStockAdjustmentQty('');
  };

  const handleSaveDefaultLimit = async () => {
    const num = parseInt(bulkLimitInput, 10);
    if (!Number.isFinite(num) || num <= 0) {
      alert('Maglagay ng tamang limit (dapat mataas sa 0).');
      return;
    }
    setIsSavingBulkLimit(true);
    try {
      const token = localStorage.getItem('silang_auth_token');
      const res = await fetch('/api/settings/default_stock_limit', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(num),
      });
      if (!res.ok) throw new Error('Failed to update setting');
      setDefaultStockLimit(num);
      alert(`Matagumpay na na-save ang default stock limit (${num} pcs) para sa tindahan!`);
    } catch (err: any) {
      alert(`Error sa pag-save: ${err?.message || String(err)}`);
    } finally {
      setIsSavingBulkLimit(false);
    }
  };

  const handleBulkApplyLimits = async () => {
    const num = parseInt(bulkLimitInput, 10);
    if (!Number.isFinite(num) || num <= 0) {
      alert('Maglagay ng tamang limit (dapat mataas sa 0).');
      return;
    }
    const catLabel = bulkLimitCategory === 'All' ? 'lahat ng produkto' : `kategoryang "${bulkLimitCategory}"`;
    if (!confirm(`Sigurado ka ba na nais mong i-apply ang Maximum Stock Limit na ${num} sa ${catLabel}?`)) {
      return;
    }
    setIsSavingBulkLimit(true);
    try {
      const token = localStorage.getItem('silang_auth_token');
      const res = await fetch('/api/products/bulk-stock-limits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ limit: num, category: bulkLimitCategory }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || 'Failed to bulk update');
      }
      setDefaultStockLimit(num);
      alert(`Matagumpay na nai-apply ang limit na ${num} sa ${catLabel}!`);
      onBranchChange(currentBranch);
      setShowStockLimitModal(false);
    } catch (err: any) {
      alert(`Error sa bulk update: ${err?.message || String(err)}`);
    } finally {
      setIsSavingBulkLimit(false);
    }
  };

  // Trigger Edit Form Prefill
  const handleStartEdit = (prod: Product) => {
    setImageUploadError(null);
    setEditingProductId(prod.id);
    setNewProdName(prod.name);
    setNewProdTagalog(prod.tagalogName || '');
    setNewProdCategory(prod.category);
    setNewProdPrice(prod.price.toString());
    setNewProdCost(prod.cost.toString());
    setNewProdBatchNumber(prod.batchNumber || '');
    setNewProdSupplierName(prod.supplierName || '');
    setNewProdExpiryDate(prod.expiryDate?.slice(0, 10) || '');
    setNewProdAuthenticityStatus(prod.authenticityStatus || 'unverified');
    setNewProdShelf(prod.shelfLocation);
    setNewProdBarcode(prod.barcode);
    setNewProdUnit(prod.unit);
    setNewProdThreshold(prod.lowStockThreshold.toString());
    setNewProdOverStockLimit(getProductMaxLimit(prod).toString());

    // Pre-fill existing stocks for each registered branch so stocks are preserved
    const branchStocks: Record<string, string> = {};
    const branches = newProdBranches.length > 0 ? newProdBranches : Object.keys(prod.stockByBranch || {});

    if (prod.stockByBranch) {
      for (const [brName, stockVal] of Object.entries(prod.stockByBranch)) {
        branchStocks[brName] = String(stockVal ?? 0);
      }
    }

    branches.forEach((br, idx) => {
      if (branchStocks[br] === undefined) {
        if (idx === 0 && prod.stockBranchA !== undefined) {
          branchStocks[br] = String(prod.stockBranchA);
        } else if (idx === 1 && prod.stockBranchB !== undefined) {
          branchStocks[br] = String(prod.stockBranchB);
        } else {
          branchStocks[br] = '0';
        }
      }
    });

    setNewProdStockByBranch(branchStocks);
    setNewProdStockA(String(prod.stockBranchA ?? (branchStocks[branches[0]] ?? '0')));
    setNewProdStockB(String(prod.stockBranchB ?? (branchStocks[branches[1]] ?? '0')));

    // Images
    if (prod.images && prod.images.length > 0) {
      const first = prod.images[0];
      if (first.startsWith('http') || first.startsWith('data:image') || first.startsWith('/uploads/')) {
        setNewProdImageUrl(first);
      } else {
        setNewProdImageUrl('');
      }
      const remaining = prod.images.slice(1).filter((img) => !img.startsWith('http') && !img.startsWith('/uploads/') && !img.startsWith('data:image'));
      setNewProdEmojis(remaining.join(', ') || '🛒, 📦, 🛍️, ✨');
    } else {
      setNewProdImageUrl('');
      setNewProdEmojis('🛒, 📦, 🛍️, ✨');
    }

    // Reset variant file inputs for re-upload
    setVariantImages({});

    // Pre-fill existing variant image URLs so they are never lost on edit
    const existingImgs: Partial<Record<VariantType, string>> = {};
    if (prod.variants && prod.variants.length > 0) {
      for (const v of prod.variants) {
        if (v.image && (v.image.startsWith('/uploads/') || v.image.startsWith('http') || v.image.startsWith('data:image'))) {
          existingImgs[v.type] = v.image;
        }
      }
    }
    setExistingVariantImageUrls(existingImgs);

    if (prod.variants && prod.variants.length > 0) {
      const pkg = prod.variants.find((v) => v.type === 'package');
      const box = prod.variants.find((v) => v.type === 'box');
      const ws = prod.variants.find((v) => v.type === 'wholesale');
      const sack = prod.variants.find((v) => v.type === 'sack');
      setNewProdPkgPrice(pkg ? pkg.price.toString() : '');
      setNewProdBoxPrice(box ? box.price.toString() : '');
      setNewProdWholesalePrice(ws ? ws.price.toString() : '');
      setNewProdSackPrice(sack ? sack.price.toString() : '');
      setNewProdSackQty(sack ? sack.qtyPerUnit.toString() : '');
    } else {
      setNewProdPkgPrice('');
      setNewProdBoxPrice('');
      setNewProdWholesalePrice('');
      setNewProdSackPrice('');
      setNewProdSackQty('');
    }

    setViewMode('edit-product');
  };

  // NOTE: InventoryView original emoji inputs are still used for generating fallback images
  const [newProdEmojis, setNewProdEmojis] = useState('🛒, 📦, 🛍️, ✨');

  // Delete product action
  const handleDeleteProductAction = (prodId: string, name: string) => {
    if (confirm(`Sigurado ka ba na nais mong burahin ang produktong "${name}" sa iyong system?`)) {
      onDeleteProduct(prodId);
      alert('Matagumpay na nabura ang produkto!');
    }
  };

  async function uploadVariantImages(productId: string): Promise<Partial<Record<VariantType, string>>> {
    const hasAny =
      variantImages.retail ||
      variantImages.package ||
      variantImages.box ||
      variantImages.wholesale ||
      variantImages.sack;

    if (!hasAny) return {};

    const form = new FormData();
    (['retail', 'package', 'box', 'wholesale', 'sack'] as VariantType[]).forEach((t) => {
      const f = variantImages[t];
      if (f) form.append(t, f);
    });

    const token = localStorage.getItem('silang_auth_token');
    const res = await fetch(`/api/products/${encodeURIComponent(productId)}/variant-images`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: form,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || 'Failed to upload variant images');
    }

    const data = await res.json().catch(() => ({}));
    return (data?.urls || {}) as Partial<Record<VariantType, string>>;
  }

  // Load registered branches for "Bagong Item" dynamic stock inputs
  useEffect(() => {
    let cancelled = false;
    async function loadBranches() {
      try {
        setNewProdBranchesLoading(true);
        const res = await fetch('/api/branches');
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed to load branches');
        const names = (data?.branches || []).map((b: any) => String(b.name));
        if (!cancelled) {
          setNewProdBranches(names);
          // keep existing values; initialize missing keys to ''
          setNewProdStockByBranch((prev) => {
            const next = { ...(prev || {}) };
            for (const n of names) {
              if (next[n] === undefined) next[n] = '';
            }
            return next;
          });
        }
      } catch {
        if (!cancelled) {
          setNewProdBranches([]);
        }
      } finally {
        if (!cancelled) setNewProdBranchesLoading(false);
      }
    }
    loadBranches();
    return () => {
      cancelled = true;
    };
  }, []);

  // Handle Add Product Submit
  const handleAddProductSubmit = async (e: React.FormEvent) => {

    e.preventDefault();
    if (!newProdName || !newProdPrice || !newProdCost || !newProdBarcode) {
      alert('Mangyaring punan ang mga mahahalagang detalye.');
      return;
    }

    const priceNum = parseFloat(newProdPrice);
    const costNum = parseFloat(newProdCost);
    const threshNum = parseInt(newProdThreshold) || 10;
    const overStockLimitNum = parseInt(newProdOverStockLimit, 10) || defaultStockLimit;

    const stockByBranch: Record<string, number> = {};
    // Use DB-driven dynamic stock inputs if present; otherwise keep legacy Poblacion/Bypass values.
    if (newProdBranches.length > 0) {
      for (const branchName of newProdBranches) {
        const raw = newProdStockByBranch?.[branchName];
        const parsed = raw === '' || raw === undefined ? 0 : Number(raw);
        stockByBranch[branchName] = Math.max(0, Math.floor(Number.isFinite(parsed) ? parsed : 0));
      }
    } else {
      stockByBranch['Poblacion'] = Math.max(0, Math.floor(Number(newProdStockA) || 0));
      stockByBranch['Bypass'] = Math.max(0, Math.floor(Number(newProdStockB) || 0));
    }

    if (Object.values(stockByBranch).some((stock) => stock > overStockLimitNum)) {
      alert(`Hindi puwedeng mag-save ng produkto na may stock na higit sa itinakdang limit (${overStockLimitNum}) bawat branch. Dapat bawasan muna ang stock o taasan ang Maximum Stock Limit.`);
      return;
    }

    const colors = ['#fecaca', '#fef08a', '#dcfce7', '#e0f2fe', '#fce7f3', '#ffedd5', '#f3e8ff', '#e2e8f0'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    // Images Array setup (URLs or Emojis)
    let finalImages: string[] = [];
    if (newProdImageUrl) {
      finalImages.push(newProdImageUrl);
    }
    const emojiArray = newProdEmojis.split(',').map((s) => s.trim()).filter(Boolean);
    finalImages = [...finalImages, ...emojiArray];
    if (finalImages.length === 0) {
      finalImages = ['🛒', '📦', '🛍️', '✨'];
    }

    // Fallback variant images from emoji settings
    const emojiFallback = finalImages;

    let variants: PackagingVariant[];
    try {
      variants = buildProductVariants(priceNum, costNum, newProdUnit, finalImages, newProdPkgPrice, newProdBoxPrice, newProdWholesalePrice, newProdSackPrice, newProdSackQty);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'May hindi wastong presyo ng package.');
      return;
    }

    const productId = `prod-${Date.now().toString().slice(-4)}`;

    const newProd: Product = {
      id: productId,
      name: newProdName,
      tagalogName: newProdTagalog || undefined,
      category: newProdCategory || categories[0] || 'Household',
      price: priceNum,
      cost: costNum,
      batchNumber: newProdBatchNumber || undefined,
      supplierName: newProdSupplierName || undefined,
      expiryDate: newProdExpiryDate || undefined,
      authenticityStatus: newProdAuthenticityStatus,
      stockByBranch,
      stockBranchA: Number(stockByBranch['Poblacion'] || 0),
      stockBranchB: Number(stockByBranch['Bypass'] || 0),
      shelfLocation: newProdShelf || 'Estante Bago',

      barcode: newProdBarcode,
      unit: newProdUnit,
      lowStockThreshold: threshNum,
      overStockThreshold: overStockLimitNum,
      imagePlaceholderColor: randomColor,
      images: finalImages,
      variants,
    };

    try {
      await onAddNewProduct(newProd);
    } catch (error) {
      alert(error instanceof Error ? `Hindi naidagdag ang produkto: ${error.message}` : 'Hindi naidagdag ang produkto. Pakisubukan muli.');
      return;
    }
    alert('Matagumpay na naidagdag ang bagong produkto!');

    try {
      await uploadVariantImages(productId);
    } catch (err: any) {
      console.error(err);
      alert(`Nagdagdag ang variant images pero may error: ${err?.message || String(err)}`);
    }

    // Reset Form
    setNewProdName('');
    setNewProdTagalog('');
    setNewProdPrice('');
    setNewProdCost('');
    setNewProdBatchNumber('');
    setNewProdSupplierName('');
    setNewProdExpiryDate('');
    setNewProdAuthenticityStatus('unverified');
    setNewProdStockA('');
    setNewProdStockB('');
    const emptyStocks: Record<string, string> = {};
    newProdBranches.forEach((br) => { emptyStocks[br] = ''; });
    setNewProdStockByBranch(emptyStocks);
    setNewProdShelf('');
    setNewProdBarcode('');
    setNewProdImageUrl('');
    setImageUploadError(null);
    setNewProdEmojis('🛒, 📦, 🛍️, ✨');
    setNewProdPkgPrice('');
    setNewProdBoxPrice('');
    setNewProdWholesalePrice('');
    setNewProdSackPrice('');
    setNewProdSackQty('');
    setVariantImages({});
    setViewMode('list');
  };

  // Handle Edit Product Submit
  const handleEditProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProductId || !newProdName || !newProdPrice || !newProdCost || !newProdBarcode) {
      alert('Mangyaring punan ang mga mahahalagang detalye.');
      return;
    }

    const priceNum = parseFloat(newProdPrice);
    const costNum = parseFloat(newProdCost);
    const threshNum = parseInt(newProdThreshold) || 10;
    const overStockLimitNum = parseInt(newProdOverStockLimit, 10) || defaultStockLimit;

    let finalImages: string[] = [];
    if (newProdImageUrl) {
      finalImages.push(newProdImageUrl);
    }
    const emojiArray = newProdEmojis.split(',').map((s) => s.trim()).filter(Boolean);
    finalImages = [...finalImages, ...emojiArray];
    if (finalImages.length === 0) {
      finalImages = ['🛒', '📦', '🛍️', '✨'];
    }

    // 1. Upload any newly selected variant image files first
    let newlyUploadedUrls: Partial<Record<VariantType, string>> = {};
    try {
      newlyUploadedUrls = await uploadVariantImages(editingProductId);
    } catch (err: any) {
      console.error('Failed to upload variant images:', err);
    }

    // Combine existing variant images with newly uploaded ones
    const combinedVariantImages: Partial<Record<VariantType, string>> = {
      ...existingVariantImageUrls,
      ...newlyUploadedUrls,
    };

    let variants: PackagingVariant[];
    try {
      variants = buildProductVariants(
        priceNum,
        costNum,
        newProdUnit,
        finalImages,
        newProdPkgPrice,
        newProdBoxPrice,
        newProdWholesalePrice,
        newProdSackPrice,
        newProdSackQty,
        combinedVariantImages
      );
    } catch (error) {
      alert(error instanceof Error ? error.message : 'May hindi wastong presyo ng package.');
      return;
    }

    const existingProd = products.find((p) => p.id === editingProductId);

    const productStockMap: Record<string, number> = {};
    if (newProdBranches.length > 0) {
      for (const branchName of newProdBranches) {
        const raw = newProdStockByBranch?.[branchName];
        if (raw !== undefined && raw !== '') {
          const parsed = Number(raw);
          productStockMap[branchName] = Math.max(0, Math.floor(Number.isFinite(parsed) ? parsed : 0));
        } else if (existingProd?.stockByBranch && existingProd.stockByBranch[branchName] !== undefined) {
          // Preserve existing stock if field was left blank
          productStockMap[branchName] = existingProd.stockByBranch[branchName];
        } else {
          productStockMap[branchName] = 0;
        }
      }
    } else {
      const rawA = newProdStockByBranch?.[Object.keys(newProdStockByBranch)[0]] ?? newProdStockA;
      const rawB = newProdStockByBranch?.[Object.keys(newProdStockByBranch)[1]] ?? newProdStockB;
      const parsedA = rawA !== '' && rawA !== undefined ? Number(rawA) : (existingProd?.stockBranchA ?? 0);
      const parsedB = rawB !== '' && rawB !== undefined ? Number(rawB) : (existingProd?.stockBranchB ?? 0);
      productStockMap['Poblacion'] = Math.max(0, Math.floor(Number.isFinite(parsedA) ? parsedA : 0));
      productStockMap['Bypass'] = Math.max(0, Math.floor(Number.isFinite(parsedB) ? parsedB : 0));
    }

    if (Object.values(productStockMap).some((stock) => Number(stock) > overStockLimitNum)) {
      alert(`Hindi puwedeng mag-save ng produkto na may stock na higit sa itinakdang limit (${overStockLimitNum}) bawat branch. Dapat bawasan muna ang stock o taasan ang Maximum Stock Limit.`);
      return;
    }

    const branchA = newProdBranches[0] || 'Poblacion';
    const branchB = newProdBranches[1] || 'Bypass';
    const finalStockA = productStockMap[branchA] ?? (existingProd?.stockBranchA ?? 0);
    const finalStockB = productStockMap[branchB] ?? (existingProd?.stockBranchB ?? 0);

    const updatedProd: Product = {
      id: editingProductId,
      name: newProdName,
      tagalogName: newProdTagalog || undefined,
      category: newProdCategory,
      price: priceNum,
      cost: costNum,
      batchNumber: newProdBatchNumber || undefined,
      supplierName: newProdSupplierName || undefined,
      expiryDate: newProdExpiryDate || undefined,
      authenticityStatus: newProdAuthenticityStatus,
      stockByBranch: {
        ...productStockMap,
      },
      stockBranchA: finalStockA,
      stockBranchB: finalStockB,
      shelfLocation: newProdShelf,
      barcode: newProdBarcode,
      unit: newProdUnit,
      lowStockThreshold: threshNum,
      overStockThreshold: overStockLimitNum,
      images: finalImages,
      variants,
    };

    try {
      await onUpdateProduct(updatedProd);
    } catch (error) {
      console.error('Failed to update product:', error);
      alert(error instanceof Error ? `Hindi na-save ang produkto: ${error.message}` : 'Hindi na-save ang produkto. Pakisubukan muli.');
      return;
    }
    alert('Matagumpay na nai-update ang detalye ng produkto!');

    // Reset Form
    setEditingProductId(null);
    setExistingVariantImageUrls({});
    setVariantImages({});
    setNewProdName('');
    setNewProdTagalog('');
    setNewProdPrice('');
    setNewProdCost('');
    setNewProdBatchNumber('');
    setNewProdSupplierName('');
    setNewProdExpiryDate('');
    setNewProdAuthenticityStatus('unverified');
    setNewProdStockA('');
    setNewProdStockB('');
    setNewProdShelf('');
    setNewProdBarcode('');
    setNewProdImageUrl('');
    setImageUploadError(null);
    setNewProdEmojis('🛒, 📦, 🛍️, ✨');
    setNewProdPkgPrice('');
    setNewProdBoxPrice('');
    setNewProdWholesalePrice('');
    setNewProdSackPrice('');
    setNewProdSackQty('');
    setVariantImages({});
    setViewMode('list');
  };

  // Add Item to Supplier Delivery List
  const addSupplierDeliveryItem = (productId: string) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    const exists = deliveryItems.some((item) => item.productId === productId);
    if (exists) return;

    setDeliveryItems([...deliveryItems, { productId, quantity: 10, cost: prod.cost }]);
  };

  // Submit Supplier Delivery
  const handleSupplierDeliverySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName || deliveryItems.length === 0) {
      alert('Maglagay ng pangalan ng Supplier at magdagdag ng mga produkto.');
      return;
    }

    const totalCost = deliveryItems.reduce((sum, item) => sum + item.cost * item.quantity, 0);

    const invalidOverstockItem = deliveryItems.find((item) => {
      const prod = products.find((p) => p.id === item.productId);
      if (!prod) return false;
      const currentStock = prod.stockByBranch?.[deliveryBranch] ?? 0;
      const limit = getProductMaxLimit(prod);
      return currentStock >= limit || currentStock + item.quantity > limit;
    });

    if (invalidOverstockItem) {
      const prod = products.find((p) => p.id === invalidOverstockItem.productId);
      const limit = getProductMaxLimit(prod);
      alert(`Bawal maglagay ng dagdag na stock. Ang "${prod?.name || 'produkto'}" ay lalampas sa itinakdang Maximum Stock Limit na ${limit} ${prod?.unit || ''} (Kasalukuyang stock: ${prod?.stockByBranch?.[deliveryBranch] ?? 0}). Maaaring taasan ang Stock Limit sa Edit Product.`);
      return;
    }

    const delivery: SupplierDelivery = {
      id: `SUP-${Date.now().toString().slice(-4)}`,
      supplierName,
      branch: deliveryBranch,
      deliveryDate: new Date().toISOString().split('T')[0],
      items: deliveryItems.map((item) => {
        const prod = products.find((p) => p.id === item.productId);
        return {
          productId: item.productId,
          productName: prod ? prod.name : 'Unknown Product',
          quantity: item.quantity,
          cost: item.cost,
        };
      }),
      totalCost,
      status: 'Received',
      receivedBy: 'Manager Active',
    };

    deliveryItems.forEach((item) => {
      const prod = products.find((p) => p.id === item.productId);
      if (prod) {
        const curStock = prod.stockByBranch?.[deliveryBranch] ?? 0;
        onUpdateStocks(item.productId, deliveryBranch, curStock + item.quantity);
      }
    });

    onAddSupplierDelivery(delivery);
    alert('Matagumpay na natanggap at na-update ang stock mula sa supplier delivery!');

    setSupplierName('');
    setDeliveryItems([]);
    setViewMode('deliveries');
  };

  const filterCategories = ['All', ...categories];

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _viewModeState = viewModeState;

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100 bg-slate-50/75 flex flex-col lg:flex-row gap-4 justify-between items-stretch lg:items-center">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="inline-flex rounded-lg bg-slate-200 p-0.5 text-xs font-bold">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${viewMode === 'list' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
            >
              📋 Stocks sa Estante
            </button>
            <button
              onClick={() => setViewMode('deliveries')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${viewMode === 'deliveries' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
            >
              🚚 Supplier Deliveries ({supplierDeliveries.length})
            </button>
            <button
              onClick={() => setViewMode('manage-categories')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${viewMode === 'manage-categories' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
            >
              🗂️ Manage Categories
            </button>
          </div>

          <div className="flex items-center gap-1.5 bg-blue-50 px-2.5 py-1 rounded text-xs font-semibold text-silang-blue border border-blue-100">
            <span>Tindahan:</span>
            <select
              value={currentBranch}
              onChange={(e) => onBranchChange(e.target.value as Branch)}
              className="bg-transparent font-bold outline-none cursor-pointer text-silang-blue"
            >
              {(branches.length > 0 ? branches.map((b) => b.name) : ['Poblacion', 'Bypass']).map((branchName) => (
                <option key={branchName} value={branchName} className="text-slate-800">
                  {branchName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowStockLimitModal(true)}
            className="px-3 py-1.5 text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Pamahalaan ang Stock Limits"
          >
            <Sliders className="h-3.5 w-3.5 text-amber-700" />
            <span>Stock Limits</span>
          </button>
          <button
            onClick={() => setViewMode('supplier-form')}
            className="px-3.5 py-1.5 text-xs font-bold bg-silang-green hover:bg-silang-green-dark text-white rounded-lg shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Tanggap Delibery</span>
          </button>
          <button
            onClick={() => {
              setEditingProductId(null);
              setNewProdName('');
              setNewProdTagalog('');
              setNewProdPrice('');
              setNewProdCost('');
              setNewProdStockA('');
              setNewProdStockB('');
              const emptyStocks: Record<string, string> = {};
              newProdBranches.forEach((br) => { emptyStocks[br] = ''; });
              setNewProdStockByBranch(emptyStocks);
              setNewProdShelf('');
              setNewProdBarcode('');
              setNewProdImageUrl('');
              setImageUploadError(null);
              setNewProdEmojis('🛒, 📦, 🛍️, ✨');
              setNewProdPkgPrice('');
              setNewProdBoxPrice('');
              setNewProdWholesalePrice('');
              setNewProdSackPrice('');
              setNewProdSackQty('');
              setNewProdOverStockLimit(defaultStockLimit.toString());
              setVariantImages({});
              setViewMode('add-product');
            }}
            className="px-3.5 py-1.5 text-xs font-bold bg-silang-blue hover:bg-silang-blue-dark text-white rounded-lg shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Bagong Item</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 min-h-[450px]">
        {viewMode === 'list' && (
          <div className="space-y-4">
            {lowStockProducts.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-start gap-2.5 text-orange-800">
                <ShieldAlert className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-xs sm:text-sm">Babala: May {lowStockProducts.length} Produkto na Low Stock!</h4>
                  <p className="text-[11px] text-orange-700 mt-0.5">Kailangan nang mag-order mula sa mga supplier upang hindi mawalan ng stock sa estante.</p>
                </div>
              </div>
            )}

            {overStockProducts.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5 text-amber-800">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-xs sm:text-sm">Babala: May {overStockProducts.length} Produkto na Overstock!</h4>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    Ang mga produktong ito ay umabot o lumagpas sa kanilang itinakdang Maximum Stock Limit. Bahala ang store admin na mag-adjust ng stock o taasan ang limitasyon ayon sa pangangailangan ng tindahan.
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 justify-between items-stretch">
              <div className="flex gap-1 overflow-x-auto pb-1 max-w-full no-scrollbar">
                {filterCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap transition-colors cursor-pointer ${selectedCategory === cat ? 'bg-slate-800 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
                  >
                    {cat === 'All' ? 'Lahat' : cat}
                  </button>
                ))}
              </div>

              <div className="relative max-w-xs shrink-0">
                <Search className="absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="I-filter ang inventory..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-silang-blue"
                />
              </div>
            </div>

            <div className="border border-slate-100 rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100 uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="p-3">Barcode / Item</th>
                      <th className="p-3">Kategorya</th>
                      <th className="p-3">Presyo sa Customer / Variants</th>
                      <th className="p-3 text-center">Puhunan sa Supplier</th>
                      <th className="p-3 text-center">Kasalukuyang Stock</th>
                      <th className="p-3">Lokasyon sa Estante</th>
                      <th className="p-3 text-right">Aksyon</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredProducts.map((prod) => {
                      const stock = getBranchStock(prod, currentBranch);
                      const prodLimit = getProductMaxLimit(prod);
                      const isLow = stock <= prod.lowStockThreshold;
                      const isOverStock = stock >= prodLimit;
                      const stockStatus = getStockStatusLabel(stock, prod.lowStockThreshold, prodLimit);

                      const productDisplayImages = getProductImages(prod);
                      const firstImg = productDisplayImages[0];
                      const hasRealImage = firstImg && (firstImg.startsWith('http') || firstImg.startsWith('data:image') || firstImg.startsWith('/uploads/'));

                      return (
                        <tr key={prod.id} className={`hover:bg-slate-50/80 transition-colors ${isLow ? 'bg-orange-50/20' : ''} ${isOverStock ? 'bg-amber-50/40' : ''}`}>
                          <td className="p-3">
                            <div className="flex items-center gap-2.5">
                              {hasRealImage ? (
                                <img src={firstImg} alt={prod.name} className="w-9 h-9 object-cover rounded-lg shrink-0 border border-slate-100" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-lg shrink-0" style={{ backgroundColor: prod.imagePlaceholderColor || '#e2e8f0' }}>
                                  {firstImg || '📦'}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="font-bold text-slate-800 truncate max-w-[160px]">{prod.name}</div>
                                <div className="text-[10px] text-slate-500">{prod.barcode || 'No barcode'}</div>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold ${
                                    prod.authenticityStatus === 'verified'
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : prod.authenticityStatus === 'rejected'
                                        ? 'bg-red-100 text-red-700'
                                        : 'bg-slate-100 text-slate-600'
                                  }`}>
                                    {prod.authenticityStatus === 'verified' ? 'Supplier/lot verified' : prod.authenticityStatus === 'rejected' ? 'Rejected' : 'Unverified'}
                                  </span>
                                  {prod.supplierName && <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[8px] text-indigo-700">{prod.supplierName}</span>}
                                  {prod.batchNumber && <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[8px] font-mono text-blue-700">Lot {prod.batchNumber}</span>}
                                  {prod.expiryDate && (() => {
                                    const expiry = getProductExpiryStatus(prod.expiryDate);
                                    return (
                                      <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold ${
                                        expiry === 'expired' ? 'bg-red-100 text-red-700'
                                          : expiry === 'expiring' ? 'bg-amber-100 text-amber-700'
                                            : 'bg-emerald-100 text-emerald-700'
                                      }`}>
                                        {expiry === 'expired' ? 'Expired' : expiry === 'expiring' ? 'Expiring soon' : 'Not expired'} · {prod.expiryDate.slice(0, 10)}
                                      </span>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-slate-600">{prod.category}</td>
                          <td className="p-3">
                            <div className="flex flex-col gap-1">
                              <span className="font-semibold text-slate-800">₱{prod.price.toFixed(2)}</span>
                              <span className="text-[10px] text-slate-500">{prod.unit}</span>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <div className="text-[10px] text-slate-500">₱{prod.cost.toFixed(2)}</div>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span className={`font-bold text-sm ${stock <= 0 ? 'text-red-600' : isLow ? 'text-orange-600' : isOverStock ? 'text-amber-600' : 'text-slate-700'}`}>
                                {stock}
                              </span>
                              <div className="flex items-center gap-1">
                                {stock <= 0 && (
                                  <span className="inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-700 uppercase tracking-wide">Out</span>
                                )}
                                {stock > 0 && stock <= prod.lowStockThreshold && (
                                  <span className="inline-flex items-center rounded-full bg-orange-100 px-1.5 py-0.5 text-[9px] font-bold text-orange-700 uppercase tracking-wide">Low</span>
                                )}
                                {isOverStock && (
                                  <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 uppercase tracking-wide">Overstock</span>
                                )}
                              </div>
                            </div>
                            <div className="mt-1 flex items-center justify-center gap-1.5 text-[10px] text-slate-500 font-mono">
                              <span title="Low Stock Warning Threshold">Min: ≤{prod.lowStockThreshold}</span>
                              <span>•</span>
                              <span className="font-semibold text-slate-700" title="Maximum Stock Capacity Limit">Limit: {prodLimit}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleOpenStockAdjust(prod)}
                              className="mt-1 text-[10px] text-silang-blue hover:text-silang-blue-dark font-bold hover:underline cursor-pointer inline-flex items-center gap-1"
                              title="I-adjust ang stock at stock limit para sa produktong ito"
                            >
                              <span>I-adjust Stock / Limit</span>
                            </button>
                          </td>
                          <td className="p-3 text-slate-600">{prod.shelfLocation || 'N/A'}</td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button type="button" onClick={() => handleStartEdit(prod)} className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer" title="Edit">
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button type="button" onClick={() => handleDeleteProductAction(prod.id, prod.name)} className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 cursor-pointer" title="Delete">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {viewMode === 'deliveries' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Mga Natanggap na Supplier Deliveries</h3>
            {supplierDeliveries.length === 0 ? (
              <div className="text-center py-12 text-slate-400 border border-dashed rounded-xl">Walang nakatalang supplier deliveries.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {supplierDeliveries.map((del) => (
                  <div key={del.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 hover:bg-slate-50 transition-colors space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-silang-green bg-green-50 border border-green-100 px-2 py-0.5 rounded">{del.status}</span>
                        <h4 className="font-bold text-slate-800 text-sm mt-1">{del.supplierName}</h4>
                        <p className="text-[10px] text-slate-400">Petsa: {del.deliveryDate}</p>
                      </div>
                      <span className="text-xs font-mono font-bold text-slate-500 bg-white border border-slate-100 px-1.5 py-0.5 rounded shadow-sm">{del.id}</span>
                    </div>
                    <div className="border-t border-slate-200/60 pt-2 text-xs space-y-1">
                      <div className="flex justify-between font-medium text-slate-500">
                        <span>Bagsak sa Branch:</span>
                        <span className="font-bold text-slate-700">{del.branch}</span>

                      </div>
                      <div className="flex justify-between font-medium text-slate-500 pb-1 border-b border-slate-100">
                        <span>Natanggap ni:</span>
                        <span className="text-slate-600">{del.receivedBy || 'Manager'}</span>
                      </div>
                      <div className="mt-2 space-y-1 font-mono text-[11px] text-slate-600 max-h-[80px] overflow-y-auto">
                        {del.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between">
                            <span>• {item.productName}</span>
                            <span className="font-bold text-slate-800">+{item.quantity} pcs</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-100 font-bold">
                      <span className="text-xs text-slate-400 uppercase">Kabuuang Puhunan</span>
                      <span className="text-silang-blue text-sm">₱{del.totalCost.toFixed(2)}</span>
                    </div>
                    {del.status === 'Pending' && (
                      <button
                        type="button"
                        onClick={async () => {
                          const token = localStorage.getItem('silang_auth_token') || '';
                          const response = await fetch(`/api/supplier-deliveries/${encodeURIComponent(del.id)}/receive`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } });
                          if (response.ok) window.location.reload();
                          else alert((await response.json()).error || 'Unable to receive delivery');
                        }}
                        className="w-full mt-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white py-2 text-xs font-black uppercase"
                      >
                        Receive Delivery & Update Stock
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {viewMode === 'manage-categories' && (
          <div className="max-w-md mx-auto bg-slate-50/50 p-6 rounded-2xl border border-slate-200 space-y-6 text-xs">
            <div className="flex items-center gap-2">
              <FolderEdit className="h-5 w-5 text-silang-blue" />
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Category Manager (Mga Kategorya)</h3>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = newCategoryInput.trim();
                if (!trimmed) return;
                if (categories.includes(trimmed)) {
                  alert('Mayroon nang ganitong kategorya!');
                  return;
                }
                onAddCategory(trimmed);
                setNewCategoryInput('');
                alert(`Matagumpay na naidagdag ang kategoryang "${trimmed}"!`);
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                placeholder="Mag-add ng kategorya (e.g. Frozen Foods)..."
                value={newCategoryInput}
                onChange={(e) => setNewCategoryInput(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-lg bg-white text-xs outline-none focus:border-silang-blue"
                required
              />
              <button type="submit" className="px-4 py-2 bg-silang-blue hover:bg-silang-blue-dark text-white rounded-lg text-xs font-bold cursor-pointer transition-colors">
                Magdagdag
              </button>
            </form>

            <div className="space-y-2">
              <span className="font-semibold text-slate-500 text-[10px] uppercase tracking-wider block">Kasalukuyan mga Kategorya:</span>
              <div className="border rounded-xl bg-white divide-y overflow-hidden max-h-[280px] overflow-y-auto shadow-sm">
                {categories.map((cat) => {
                  const prodCount = products.filter((p) => p.category === cat).length;
                  const isEditing = editingCategory === cat;
                  return (
                    <div key={cat} className="p-3 flex justify-between items-center hover:bg-slate-50 transition-colors">
                      {isEditing ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const trimmed = editCategoryName.trim();
                            if (!trimmed) return;
                            if (trimmed !== cat && categories.includes(trimmed)) {
                              alert('Mayroon nang ganitong kategorya!');
                              return;
                            }
                            if (trimmed !== cat) onRenameCategory(cat, trimmed);
                            setEditingCategory(null);
                            setEditCategoryName('');
                          }}
                          className="flex-1 flex gap-1.5 items-center mr-2"
                        >
                          <input
                            type="text"
                            value={editCategoryName}
                            onChange={(e) => setEditCategoryName(e.target.value)}
                            className="flex-1 px-2 py-1 border rounded-lg bg-white text-xs outline-none focus:border-silang-blue font-bold"
                            autoFocus
                            required
                          />
                          <button type="submit" className="text-silang-green font-bold text-[11px] cursor-pointer hover:underline">
                            I-save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCategory(null);
                              setEditCategoryName('');
                            }}
                            className="text-slate-400 font-bold text-[11px] cursor-pointer hover:underline"
                          >
                            Kansel
                          </button>
                        </form>
                      ) : (
                        <div>
                          <span className="font-bold text-slate-800 text-xs">{cat}</span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">{prodCount} item(s) sa estante</span>
                        </div>
                      )}

                      {!isEditing && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setEditingCategory(cat);
                              setEditCategoryName(cat);
                            }}
                            className="text-silang-blue font-bold hover:underline cursor-pointer p-1 text-[11px]"
                          >
                            I-edit
                          </button>
                          <button
                            onClick={() => {
                              if (prodCount > 0) {
                                alert(`Hindi pwedeng burahin ang kategoryang "${cat}" dahil mayroon itong ${prodCount} mga produkto sa loob. Mangyaring ilipat o burahin muna ang mga ito.`);
                                return;
                              }
                              if (confirm(`Sigurado ka ba na nais mong burahin ang kategoryang "${cat}"?`)) onDeleteCategory(cat);
                            }}
                            className="text-red-500 font-bold hover:underline cursor-pointer p-1 text-[11px]"
                          >
                            Bura
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              onClick={() => setViewMode('list')}
              className="w-full py-2 border rounded-lg text-xs font-bold hover:bg-slate-100 cursor-pointer text-center text-slate-600 transition-colors block"
            >
              Bumalik sa Inventory List
            </button>
          </div>
        )}

        {viewMode === 'add-product' && (
          <div className="max-w-xl mx-auto bg-slate-50/50 p-6 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-2 mb-4">
              <PlusCircle className="h-5 w-5 text-silang-blue" />
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Magdagdag ng Bagong Produkto sa Estante</h3>
            </div>

            <form onSubmit={handleAddProductSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="col-span-2">
                  <label className="block text-slate-500 font-semibold mb-1">Pangalan ng Produkto (Ingles) *</label>
                  <input
                    type="text"
                    required
                    placeholder="E.g. Argentina Corned Beef 150g"
                    value={newProdName}
                    onChange={(e) => setNewProdName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-white"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-slate-500 font-semibold mb-1">Tagalog na Pangalan (Opsyonal)</label>
                  <input
                    type="text"
                    placeholder="E.g. Argentina Corned Beef"
                    value={newProdTagalog}
                    onChange={(e) => setNewProdTagalog(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Kategorya</label>
                  <select value={newProdCategory} onChange={(e) => setNewProdCategory(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white">
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Barcode / Code ID *</label>
                  <input
                    type="text"
                    required
                    placeholder="E.g. 48000111244"
                    value={newProdBarcode}
                    onChange={(e) => setNewProdBarcode(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Presyo sa Customer (₱) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="E.g. 45"
                    value={newProdPrice}
                    onChange={(e) => setNewProdPrice(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Puhunan sa Supplier (₱) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="E.g. 37"
                    value={newProdCost}
                    onChange={(e) => setNewProdCost(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Unit</label>
                  <select
                    value={newProdUnit}
                    onChange={(e) => setNewProdUnit(e.target.value as Product['unit'])}
                    className="w-full px-3 py-2 border rounded-lg bg-white"
                  >
                    <option value="pc">pc (Piraso)</option>
                    <option value="can">can (Lata)</option>
                    <option value="pack">pack (Pakete)</option>
                    <option value="bottle">bottle (Bote)</option>
                    <option value="kg">kg (Kilo)</option>
                    <option value="bag">bag (Supot)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Low Stock Warning Limit</label>
                  <input
                    type="number"
                    required
                    value={newProdThreshold}
                    onChange={(e) => setNewProdThreshold(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-white"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Babala kapag bumaba rito ang stock.</p>
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1 flex items-center justify-between">
                    <span>Maximum Stock Limit (Kapasidad)</span>
                    <span className="text-[10px] text-silang-blue font-bold">Admin Managed</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={newProdOverStockLimit}
                    onChange={(e) => setNewProdOverStockLimit(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-white font-medium"
                    placeholder="Hal. 200, 500, 1000"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Pinakamataas na bilang bago ituring na Overstock (Bahala ang admin kung ilan ang kailangan).</p>
                </div>

                <div className="col-span-2">
                  <label className="block text-slate-500 font-semibold mb-2">Panimulang Stock per Registered Branch</label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {newProdBranchesLoading ? (
                      <div className="w-full rounded-lg border border-slate-200 bg-white p-3 text-[11px] text-slate-500">
                        Loading registered branches...
                      </div>
                    ) : (
                      newProdBranches.map((br) => (
                        <div key={br}>
                          <label className="block text-[10px] text-slate-500 font-semibold mb-1">
                            Panimulang Stock - {br}
                          </label>
                          <input
                            type="number"
                            placeholder="E.g. 50"
                            value={String(newProdStockByBranch?.[br] ?? '')}
                            onChange={(e) => {
                              const val = e.target.value;
                              setNewProdStockByBranch((prev) => ({
                                ...(prev || {}),
                                [br]: val === '' ? '' : String(val),
                              }));
                            }}
                            className="w-full px-3 py-2 border rounded-lg bg-white"
                          />
                        </div>
                      ))
                    )}
                  </div>
                </div>



                <div className="col-span-2">
                  <label className="block text-slate-500 font-semibold mb-1">Lokasyon sa Estante</label>
                  <input
                    type="text"
                    placeholder="E.g. Aisle 1 - Shelf A"
                    value={newProdShelf}
                    onChange={(e) => setNewProdShelf(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-white"
                  />
                </div>

                <ProductTraceabilityFields
                  batchNumber={newProdBatchNumber}
                  setBatchNumber={setNewProdBatchNumber}
                  supplierName={newProdSupplierName}
                  setSupplierName={setNewProdSupplierName}
                  expiryDate={newProdExpiryDate}
                  setExpiryDate={setNewProdExpiryDate}
                  authenticityStatus={newProdAuthenticityStatus}
                  setAuthenticityStatus={setNewProdAuthenticityStatus}
                />

                {/* PRODUCT IMAGE MANAGEMENT SECTION */}
                <div className="col-span-2 border-t border-slate-200/80 pt-3 mt-1 space-y-2">
                  <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-1 text-silang-blue">📸 Litrato at Larawan ng Produkto (Device upload / URL)</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-1">Upload mula sa Device:</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                      />
                      {imageUploadError && <p className="text-[10px] text-red-600 mt-1">{imageUploadError}</p>}
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-1">O Litrato Link URL:</span>
                      <input
                        type="text"
                        placeholder="E.g. https://images.unsplash.com/photo..."
                        value={newProdImageUrl}
                        onChange={(e) => setNewProdImageUrl(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg bg-white"
                      />
                    </div>
                  </div>
                  {newProdImageUrl && (
                    <div className="flex items-center gap-3 p-2.5 bg-slate-100/50 rounded-xl border">
                      <img
                        src={newProdImageUrl}
                        alt="Preview"
                        className="w-12 h-12 object-cover rounded-lg border border-slate-200"
                        referrerPolicy="no-referrer"
                      />
                      <div>
                        <span className="font-bold text-slate-800 text-xs block">Litrato Live Preview</span>
                        <button
                          type="button"
                          onClick={() => setNewProdImageUrl('')}
                          className="text-red-500 font-bold text-[10px] hover:underline"
                        >
                          Tanggalin
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="col-span-2 border-t border-slate-200/80 pt-3">
                  <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2 text-silang-blue flex items-center gap-1">
                    <span>✨ Litrato at Pakete Settings (Images & Packaging Variants)</span>
                  </h4>
                  <p className="text-[10px] text-slate-400 mb-3">Ang mga presyo sa ibaba ay opsyonal. Kapag walang inilagay na presyo, hindi ito ipapakita o magagamit sa POS.</p>

                  <InventoryVariantImagesFields
                    variantImages={variantImages}
                    setVariantImages={(next) => setVariantImages(next)}
                    onClearVariantImages={() => setVariantImages({})}
                  />

                  <div className="mt-4">
                    <label className="block text-slate-500 font-semibold mb-1">Multiple Product Images / Emojis (Hatiin gamit ang kuwit ",")</label>
                    <input
                      type="text"
                      placeholder="E.g. 🌾, 📦, 🛍️, 🍚"
                      value={newProdEmojis}
                      onChange={(e) => setNewProdEmojis(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg bg-white text-sm"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Maglagay ng emoji para sa Tingi, Balot, Karton, Pakyaw, at Sako.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                    <div>
                      <label className="block text-slate-500 font-semibold mb-1">Presyo ng Balot / Package (₱) - Opsyonal</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Ilagay ang presyo"
                        value={newProdPkgPrice}
                        onChange={(e) => setNewProdPkgPrice(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 font-semibold mb-1">Presyo ng Karton / Box (₱) - Opsyonal</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Ilagay ang presyo"
                        value={newProdBoxPrice}
                        onChange={(e) => setNewProdBoxPrice(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg bg-white"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-slate-500 font-semibold mb-1">Presyo ng Pakyaw / Wholesale (₱) - Opsyonal</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Ilagay ang presyo"
                        value={newProdWholesalePrice}
                        onChange={(e) => setNewProdWholesalePrice(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 font-semibold mb-1">Presyo ng Isang Sako (₱) - Opsyonal</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Ilagay ang presyo"
                        value={newProdSackPrice}
                        onChange={(e) => setNewProdSackPrice(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 font-semibold mb-1">{newProdUnit === 'kg' ? 'Ilang kilo ang laman ng isang sako?' : `Quantity bawat sako (${newProdUnit})`}</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        placeholder={newProdUnit === 'kg' ? 'Hal. 50 kg' : 'Ilagay ang quantity'}
                        value={newProdSackQty}
                        onChange={(e) => setNewProdSackQty(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg bg-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-3 text-xs font-bold">
                <button type="button" onClick={() => setViewMode('list')} className="px-4 py-2 border rounded-lg hover:bg-slate-100 cursor-pointer">
                  Bumalik
                </button>
                <button type="submit" className="px-5 py-2 bg-silang-blue hover:bg-silang-blue-dark text-white rounded-lg shadow cursor-pointer">
                  I-save ang Produkto
                </button>
              </div>
            </form>
          </div>
        )}

        {viewMode === 'edit-product' && (
          <div className="max-w-xl mx-auto bg-slate-50/50 p-6 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-2 mb-4">
              <PlusCircle className="h-5 w-5 text-silang-blue" />
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">I-edit ang Detalye ng Produkto sa Estante</h3>
            </div>

            <form onSubmit={handleEditProductSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="col-span-2">
                  <label className="block text-slate-500 font-semibold mb-1">Pangalan ng Produkto (Ingles) *</label>
                  <input
                    type="text"
                    required
                    placeholder="E.g. Argentina Corned Beef 150g"
                    value={newProdName}
                    onChange={(e) => setNewProdName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-white"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-slate-500 font-semibold mb-1">Tagalog na Pangalan (Opsyonal)</label>
                  <input
                    type="text"
                    placeholder="E.g. Argentina Corned Beef"
                    value={newProdTagalog}
                    onChange={(e) => setNewProdTagalog(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Kategorya</label>
                  <select value={newProdCategory} onChange={(e) => setNewProdCategory(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white">
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Barcode / Code ID *</label>
                  <input
                    type="text"
                    required
                    placeholder="E.g. 48000111244"
                    value={newProdBarcode}
                    onChange={(e) => setNewProdBarcode(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Presyo sa Customer (₱) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="E.g. 45"
                    value={newProdPrice}
                    onChange={(e) => setNewProdPrice(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Puhunan sa Supplier (₱) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="E.g. 37"
                    value={newProdCost}
                    onChange={(e) => setNewProdCost(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Unit</label>
                  <select
                    value={newProdUnit}
                    onChange={(e) => setNewProdUnit(e.target.value as Product['unit'])}
                    className="w-full px-3 py-2 border rounded-lg bg-white"
                  >
                    <option value="pc">pc (Piraso)</option>
                    <option value="can">can (Lata)</option>
                    <option value="pack">pack (Pakete)</option>
                    <option value="bottle">bottle (Bote)</option>
                    <option value="kg">kg (Kilo)</option>
                    <option value="bag">bag (Supot)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Low Stock Warning Limit</label>
                  <input
                    type="number"
                    required
                    value={newProdThreshold}
                    onChange={(e) => setNewProdThreshold(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-white"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Babala kapag bumaba rito ang stock.</p>
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1 flex items-center justify-between">
                    <span>Maximum Stock Limit (Kapasidad)</span>
                    <span className="text-[10px] text-silang-blue font-bold">Admin Managed</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={newProdOverStockLimit}
                    onChange={(e) => setNewProdOverStockLimit(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-white font-medium"
                    placeholder="Hal. 200, 500, 1000"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Pinakamataas na bilang bago ituring na Overstock (Bahala ang admin kung ilan ang kailangan).</p>
                </div>

                <div className="col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-500 font-semibold">Kasalukuyang Stock - Per Registered Branch</label>
                    <span className="text-[10px] text-emerald-600 font-semibold">Preserved existing stock</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mb-2">
                    Naka-load ang kasalukuyang bilang ng stock. Maaari mong baguhin o iwanan lang gaya ng dati.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(newProdBranchesLoading || newProdBranches.length === 0) ? (
                      <div className="w-full rounded-lg border border-slate-200 bg-white p-3 text-[11px] text-slate-500">
                        Loading registered branches...
                      </div>
                    ) : (
                      newProdBranches.map((br) => (
                        <div key={br}>
                          <label className="block text-[10px] text-slate-500 font-semibold mb-1">
                            {`Stock - ${br}`}
                          </label>
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={String(newProdStockByBranch?.[br] ?? '')}
                            onChange={(e) => {
                              const val = e.target.value;
                              setNewProdStockByBranch((prev) => ({ ...(prev || {}), [br]: val === '' ? '' : String(val) }));
                            }}
                            className="w-full px-3 py-2 border rounded-lg bg-white font-bold text-slate-800"
                          />
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="block text-slate-500 font-semibold mb-1">Lokasyon sa Estante</label>
                  <input
                    type="text"
                    placeholder="E.g. Aisle 1 - Shelf A"
                    value={newProdShelf}
                    onChange={(e) => setNewProdShelf(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-white"
                  />
                </div>

                <ProductTraceabilityFields
                  batchNumber={newProdBatchNumber}
                  setBatchNumber={setNewProdBatchNumber}
                  supplierName={newProdSupplierName}
                  setSupplierName={setNewProdSupplierName}
                  expiryDate={newProdExpiryDate}
                  setExpiryDate={setNewProdExpiryDate}
                  authenticityStatus={newProdAuthenticityStatus}
                  setAuthenticityStatus={setNewProdAuthenticityStatus}
                />

                {/* PRODUCT IMAGE MANAGEMENT SECTION */}
                <div className="col-span-2 border-t border-slate-200/80 pt-3 mt-1 space-y-2">
                  <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-1 text-silang-blue">📸 Litrato at Larawan ng Produkto (Device upload / URL)</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-1">Upload mula sa Device:</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                      />
                      {imageUploadError && <p className="text-[10px] text-red-600 mt-1">{imageUploadError}</p>}
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-1">O Litrato Link URL:</span>
                      <input
                        type="text"
                        placeholder="E.g. https://images.unsplash.com/photo..."
                        value={newProdImageUrl}
                        onChange={(e) => setNewProdImageUrl(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg bg-white"
                      />
                    </div>
                  </div>
                  {newProdImageUrl && (
                    <div className="flex items-center gap-3 p-2.5 bg-slate-100/50 rounded-xl border">
                      <img
                        src={newProdImageUrl}
                        alt="Preview"
                        className="w-12 h-12 object-cover rounded-lg border border-slate-200"
                        referrerPolicy="no-referrer"
                      />
                      <div>
                        <span className="font-bold text-slate-800 text-xs block">Litrato Live Preview</span>
                        <button
                          type="button"
                          onClick={() => setNewProdImageUrl('')}
                          className="text-red-500 font-bold text-[10px] hover:underline"
                        >
                          Tanggalin
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="col-span-2 border-t border-slate-200/80 pt-3">
                  <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2 text-silang-blue flex items-center gap-1">
                    <span>✨ Litrato at Pakete Settings (Images & Packaging Variants)</span>
                  </h4>
                  <p className="text-[10px] text-slate-400 mb-3">Ang mga presyo sa ibaba ay opsyonal. Kapag walang inilagay na presyo, hindi ito ipapakita o magagamit sa POS.</p>

                  <InventoryVariantImagesFields
                    variantImages={variantImages}
                    setVariantImages={(next) => setVariantImages(next)}
                    onClearVariantImages={() => setVariantImages({})}
                    existingVariantImages={existingVariantImageUrls}
                    onRemoveExistingImage={(type) => {
                      setExistingVariantImageUrls((prev) => {
                        const next = { ...prev };
                        delete next[type];
                        return next;
                      });
                    }}
                  />

                  <div className="mt-4">
                    <label className="block text-slate-500 font-semibold mb-1">Multiple Product Images / Emojis (Hatiin gamit ang kuwit ",")</label>
                    <input
                      type="text"
                      placeholder="E.g. 🌾, 📦, 🛍️, 🍚"
                      value={newProdEmojis}
                      onChange={(e) => setNewProdEmojis(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg bg-white text-sm"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Maglagay ng emoji para sa Tingi, Balot, Karton, Pakyaw, at Sako.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                    <div>
                      <label className="block text-slate-500 font-semibold mb-1">Presyo ng Balot / Package (₱) - Opsyonal</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Ilagay ang presyo"
                        value={newProdPkgPrice}
                        onChange={(e) => setNewProdPkgPrice(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 font-semibold mb-1">Presyo ng Karton / Box (₱) - Opsyonal</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Ilagay ang presyo"
                        value={newProdBoxPrice}
                        onChange={(e) => setNewProdBoxPrice(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg bg-white"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-slate-500 font-semibold mb-1">Presyo ng Pakyaw / Wholesale (₱) - Opsyonal</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Ilagay ang presyo"
                        value={newProdWholesalePrice}
                        onChange={(e) => setNewProdWholesalePrice(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 font-semibold mb-1">Presyo ng Isang Sako (₱) - Opsyonal</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Ilagay ang presyo"
                        value={newProdSackPrice}
                        onChange={(e) => setNewProdSackPrice(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 font-semibold mb-1">{newProdUnit === 'kg' ? 'Ilang kilo ang laman ng isang sako?' : `Quantity bawat sako (${newProdUnit})`}</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        placeholder={newProdUnit === 'kg' ? 'Hal. 50 kg' : 'Ilagay ang quantity'}
                        value={newProdSackQty}
                        onChange={(e) => setNewProdSackQty(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg bg-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-3 text-xs font-bold">
                <button type="button" onClick={() => setViewMode('list')} className="px-4 py-2 border rounded-lg hover:bg-slate-100 cursor-pointer">
                  Bumalik
                </button>
                <button type="submit" className="px-5 py-2 bg-silang-blue hover:bg-silang-blue-dark text-white rounded-lg shadow cursor-pointer">
                  I-save ang Produkto
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Quick Stock Adjustment & Limit Modal */}
        {selectedProduct && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-150">
              <div className="p-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm">I-adjust ang Stock & Limit</h3>
                  <p className="text-[11px] text-slate-300 truncate max-w-[280px]">
                    {selectedProduct.name} ({currentBranch} Branch)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleStockAdjustmentSubmit} className="p-5 space-y-4 text-xs">
                {/* Stats cards */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Kasalukuyan</span>
                    <span className="text-base font-bold text-slate-800">
                      {getBranchStock(selectedProduct, currentBranch)}
                    </span>
                    <span className="text-[9px] text-slate-400 block">{selectedProduct.unit}</span>
                  </div>

                  <div className="p-2.5 bg-orange-50/60 rounded-xl border border-orange-100">
                    <span className="text-[10px] text-orange-600 uppercase font-semibold block">Mababa (Min)</span>
                    <span className="text-base font-bold text-orange-700">
                      {selectedProduct.lowStockThreshold}
                    </span>
                    <span className="text-[9px] text-orange-500 block">≤ babala</span>
                  </div>

                  <div className="p-2.5 bg-amber-50/60 rounded-xl border border-amber-100">
                    <span className="text-[10px] text-amber-600 uppercase font-semibold block">Limit (Max)</span>
                    <span className="text-base font-bold text-amber-700">
                      {modalOverStockLimit || getProductMaxLimit(selectedProduct)}
                    </span>
                    <span className="text-[9px] text-amber-500 block">≥ overstock</span>
                  </div>
                </div>

                {/* Adjustment Type Selector */}
                <div>
                  <label className="block text-slate-600 font-semibold mb-1.5">Aksyon sa Stock:</label>
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setAdjustmentType('add')}
                      className={`py-1.5 px-2 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                        adjustmentType === 'add'
                          ? 'bg-silang-green text-white shadow-xs'
                          : 'text-slate-600 hover:bg-white'
                      }`}
                    >
                      + Magdagdag
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjustmentType('subtract')}
                      className={`py-1.5 px-2 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                        adjustmentType === 'subtract'
                          ? 'bg-orange-600 text-white shadow-xs'
                          : 'text-slate-600 hover:bg-white'
                      }`}
                    >
                      - Magbawas
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjustmentType('set')}
                      className={`py-1.5 px-2 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                        adjustmentType === 'set'
                          ? 'bg-silang-blue text-white shadow-xs'
                          : 'text-slate-600 hover:bg-white'
                      }`}
                    >
                      = Direktang Itakda
                    </button>
                  </div>
                </div>

                {/* Quantity Input */}
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    {adjustmentType === 'add'
                      ? 'Dami ng Idaragdag (Quantity):'
                      : adjustmentType === 'subtract'
                      ? 'Dami ng Ibabawas (Quantity):'
                      : 'Eksaktong Bilang ng Stock:'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    autoFocus
                    value={stockAdjustmentQty}
                    onChange={(e) => setStockAdjustmentQty(e.target.value)}
                    placeholder="Ilagay ang bilang..."
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl font-bold bg-white focus:outline-none focus:border-silang-blue"
                  />
                </div>

                {/* Live Preview */}
                {stockAdjustmentQty && Number.isInteger(Number(stockAdjustmentQty)) && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-medium">Resultang Bagong Stock:</span>
                    <span className="font-bold text-sm text-slate-800">
                      {adjustmentType === 'add'
                        ? getBranchStock(selectedProduct, currentBranch) + Number(stockAdjustmentQty)
                        : adjustmentType === 'subtract'
                        ? Math.max(0, getBranchStock(selectedProduct, currentBranch) - Number(stockAdjustmentQty))
                        : Number(stockAdjustmentQty)}{' '}
                      {selectedProduct.unit}
                    </span>
                  </div>
                )}

                {/* Product Maximum Stock Limit Field */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-600 font-semibold flex items-center gap-1">
                      <Sliders className="h-3 w-3 text-amber-600" />
                      <span>Maximum Stock Limit (Kapasidad)</span>
                    </label>
                    <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-bold">
                      Store Admin Setting
                    </span>
                  </div>
                  <input
                    type="number"
                    min="1"
                    value={modalOverStockLimit}
                    onChange={(e) => setModalOverStockLimit(e.target.value)}
                    placeholder="Hal. 200, 500, 1000"
                    className="w-full px-3 py-1.5 text-xs border border-amber-200 rounded-lg bg-amber-50/20 font-bold focus:outline-none focus:border-amber-400"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Maaari mong baguhin dito ang stock limit kung nais mong palakihin ang pinapayagang imbakan para sa item na ito.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(null)}
                    className="px-4 py-2 border rounded-xl hover:bg-slate-100 font-bold text-slate-600 cursor-pointer"
                  >
                    Kanselahin
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-silang-blue hover:bg-silang-blue-dark text-white rounded-xl font-bold shadow-sm transition-colors cursor-pointer"
                  >
                    I-save ang Adjustment
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Store-wide Stock Limits Manager Modal */}
        {showStockLimitModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-150">
              <div className="p-4 bg-gradient-to-r from-amber-600 to-orange-600 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sliders className="h-5 w-5" />
                  <div>
                    <h3 className="font-bold text-sm">Pamamahala ng Stock Limit & Kapasidad</h3>
                    <p className="text-[11px] text-amber-100">
                      Store Admin Management (Walang default na 100 limit restriction)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowStockLimitModal(false)}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-amber-100 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-5 space-y-5 text-xs max-h-[80vh] overflow-y-auto">
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 leading-relaxed text-[11px]">
                  <strong>✨ Buong Kalayaan ng Store Admin:</strong> Bahala ka bilang store admin kung gaano karaming stock ang kailangan ng bawat produkto o ng buong tindahan. Hindi ito naka-lock sa 100 piraso. Maaari kang maglagay ng 200, 500, 1000, 5000, o kahit anong bilang ayon sa sukat ng inyong estante at bodega.
                </div>

                {/* Section 1: Default Store-wide Limit */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wide">
                        1. Store Default Stock Limit
                      </h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Ito ang awtomatikong magiging limitasyon para sa mga bagong produkto.
                      </p>
                    </div>
                    <span className="text-xs font-bold text-silang-blue bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                      Kasalukuyan: {defaultStockLimit}
                    </span>
                  </div>

                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      min="1"
                      value={bulkLimitInput}
                      onChange={(e) => setBulkLimitInput(e.target.value)}
                      placeholder="Hal. 500"
                      className="flex-1 px-3 py-2 border rounded-xl bg-white font-bold text-slate-800 text-sm focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      disabled={isSavingBulkLimit}
                      onClick={handleSaveDefaultLimit}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer whitespace-nowrap"
                    >
                      {isSavingBulkLimit ? 'Sine-save...' : 'I-save Bilang Default'}
                    </button>
                  </div>
                </div>

                {/* Section 2: Bulk Update */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div>
                    <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wide">
                      2. Maramihang Pag-apply (Bulk Update Limits)
                    </h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      I-apply ang itinakdang limitasyon ({bulkLimitInput || '500'}) sa maramihang mga produkto nang sabay-sabay.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-slate-600 font-semibold">Pumili ng Saklaw (Scope):</label>
                    <select
                      value={bulkLimitCategory}
                      onChange={(e) => setBulkLimitCategory(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl bg-white text-xs font-medium focus:outline-none focus:border-amber-500"
                    >
                      <option value="All">Lahat ng Produkto ({products.length} kabuuang items)</option>
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          Kategorya: {c} ({products.filter((p) => p.category === c).length} items)
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    disabled={isSavingBulkLimit}
                    onClick={handleBulkApplyLimits}
                    className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-sm transition-colors cursor-pointer"
                  >
                    {isSavingBulkLimit ? 'Inia-apply...' : `I-apply ang Limit na ${bulkLimitInput || 500} sa mga Napili`}
                  </button>
                </div>

                {/* Section 3: Summary stats */}
                <div className="grid grid-cols-3 gap-2 text-center pt-2">
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Kabuuang Produkto</span>
                    <span className="text-base font-bold text-slate-800">{products.length}</span>
                  </div>
                  <div className="p-2.5 bg-orange-50 rounded-xl border border-orange-200">
                    <span className="text-[10px] text-orange-600 uppercase font-semibold block">Low Stock</span>
                    <span className="text-base font-bold text-orange-700">{lowStockProducts.length}</span>
                  </div>
                  <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200">
                    <span className="text-[10px] text-amber-600 uppercase font-semibold block">Overstock</span>
                    <span className="text-base font-bold text-amber-700">{overStockProducts.length}</span>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowStockLimitModal(false)}
                    className="px-5 py-2 bg-slate-200 hover:bg-slate-300 font-bold text-slate-700 rounded-xl cursor-pointer"
                  >
                    Isara
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
