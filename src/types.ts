/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Branch = string;

export interface BranchRecord {
  id: number;
  name: string;
  address: string;
  lat: number;
  lng: number;
  is_active: boolean;
}

export interface PackagingVariant {
  type: 'retail' | 'wholesale' | 'box' | 'package' | 'sack';
  label: string;      // e.g., "Retail (Per piece)", "Sako (50 kg)", "Box (Karton of 24)"
  qtyPerUnit: number; // e.g. 1 for retail, 24 for box, etc.
  price: number;      // Selling price for this variant in PHP
  cost: number;       // Cost price for this variant in PHP
  unitName: string;   // e.g., "pc", "box", "pack"
  image?: string;     // specific image URL or emoji representation for this variant
}

export interface Product {
  id: string;
  name: string;
  tagalogName?: string;
  category: string;
  price: number; // Retail price to customer (PHP)
  cost: number; // Supplier cost (PHP)
  batchNumber?: string;
  expiryDate?: string;
  supplierName?: string;
  authenticityStatus?: 'unverified' | 'verified' | 'rejected';

  // Dynamic stock per registered branch name
  stockByBranch: Record<string, number>; // { [branchName]: stock }
  stockBranchA: number;
  stockBranchB: number;

  shelfLocation: string; // Shelf assignment
  barcode: string;
  unit: 'kg' | 'can' | 'pack' | 'bottle' | 'pc' | 'bag';
  lowStockThreshold: number;
  overStockThreshold?: number; // Maximum stock capacity before overstock warning (managed by admin)
  imagePlaceholderColor?: string; // Pastel colors for beautiful UI placeholders
  images?: string[]; // Array of multiple product images (URLs, emojis, or descriptions)
  variants?: PackagingVariant[]; // Array of wholesale, box, retail, package options
}


export interface CartItem {
  product: Product;
  quantity: number;
  selectedVariant?: PackagingVariant; // Chosen packaging option
}

export interface Transaction {
  id: string;
  branch: Branch;
  items: {
    productId: string;
    name: string;
    price: number;
    quantity: number;
    unit: string;
  }[];
  subtotal: number;
  discountType: 'none' | 'senior' | 'pwd' | 'percentage';
  discountAmount: number;
  vatAmount?: number;
  total: number;
  paymentMethod: 'Cash' | 'GCash' | 'Maya';
  amountPaid: number;
  change_amount: number;
  timestamp: string;
  cashier: string;
}

export interface Delivery {
  id: string;
  branch: Branch;
  customerName: string;
  customerPhone: string;
  address: string;
  barangay: string;
  coordinates: [number, number]; // [lat, lng]
  status: 'Pending' | 'Preparing' | 'Out for Delivery' | 'Delivered' | 'Cancelled';
  items: {
    productId: string;
    name: string;
    quantity: number;
    price: number;
    batchNumber?: string;
    expiryDate?: string;
    supplierName?: string;
    authenticityStatus?: Product['authenticityStatus'];
  }[];
  deliveryFee: number;
  totalAmount: number;
  driverName: string;
  driverCoordinates: [number, number]; // Last GPS coordinates; may be a branch placeholder before the first fix
  driverLocationUpdatedAt?: string | null;
  driverLocationAccuracyMeters?: number | null;
  etaMinutes: number;
  notes?: string;
  timestamp: string;
  paymentMethod?: 'Cash' | 'GCash' | 'Maya';
  paymentStatus?: string;
  paymentReference?: string | null;
  paymentAmount?: number | null;
  paymentProofUrl?: string | null;
  // Proof of Delivery fields
  podPhotoUrl?: string;
  podUploadedBy?: string;
  podUploadedAt?: string;
  deliveredAt?: string;
  handoverConfirmed?: boolean;
  archivedAt?: string | null;
  deletedAt?: string | null;
}

export interface ServiceTransaction {
  id: string;
  branch: Branch;
  type: 'E-Load' | 'Bills Payment' | 'Remittance';
  provider: string; // GCash Cash-in, Smart Load, Meralco, Bayad Center, Cebuana Lhuillier, Palawan Express
  recipient: string; // Phone number, Account number, Name
  senderOrAccountName: string; // Customer name
  amount: number;
  serviceFee: number;
  totalAmount: number;
  status: 'Completed' | 'Pending' | 'Failed';
  timestamp: string;
}

export interface SupplierDelivery {
  id: string;
  supplierName: string;
  branch: Branch;
  deliveryDate: string;
  items: {
    productId: string;
    productName: string;
    quantity: number;
    cost: number;
  }[];
  totalCost: number;
  status: 'Pending' | 'Received';
  receivedBy?: string;
}

export interface SystemNotification {
  id: string;
  type: 'info' | 'warning' | 'success' | 'danger';
  title: string;
  message: string;
  timestamp: string; // ISO string for backward compat
  productId?: string;
  branch?: Branch;
  read?: boolean;
}

// Full role-scoped notification (new system)
export type NotificationCategory = 'orders' | 'delivery' | 'payment' | 'inventory' | 'account' | 'system' | 'security';
export type NotificationPriority = 'normal' | 'important' | 'critical';
export type NotificationRole = 'admin' | 'customer' | 'rider' | 'supplier';

export interface AppNotification {
  id: string;
  userId: string;
  role: NotificationRole;
  type: 'info' | 'warning' | 'success' | 'danger';
  category: NotificationCategory;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
  priority?: NotificationPriority;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
}

export interface NotificationPreferences {
  userId: string;
  role: string;
  notificationsOn: boolean;
  soundsOn: boolean;
  newOrderSound: boolean;
  deliverySound: boolean;
  paymentSound: boolean;
  inventorySound: boolean;
  criticalSound: boolean;
}
