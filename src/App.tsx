/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Branch, BranchRecord, Product, Transaction, Delivery, ServiceTransaction, SupplierDelivery, SystemNotification, AppNotification } from './types';
import BranchManagerPanel from './components/BranchManagerPanel';
import StaffManagerPanel from './components/StaffManagerPanel';

import POSView from './components/POSView';
import InventoryView from './components/InventoryView';
import DeliveryTracker from './components/DeliveryTracker';
import ValueAddedServices from './components/ValueAddedServices';
import BranchAnalytics from './components/BranchAnalytics';
import CustomerPortal from './components/CustomerPortal';
import RiderDashboard from './components/RiderDashboard';
import SupplierDashboard from './components/SupplierDashboard';
import LandingPage from './components/LandingPage';
import LandingAuthModal from './components/LandingAuthModal';
import DashboardOverview from './components/DashboardOverview';
import CustomerManagementView from './components/CustomerManagementView';

import AIAssistant from './components/AIAssistant';
import DeliveryMap from './components/DeliveryMap';
import { ToastItem } from './components/SystemNotificationToast';
import { AppToastItem } from './components/AppNotificationToast';
import NotificationCenter from './components/NotificationCenter';
import { AnimatePresence, motion } from 'motion/react';
import { useNotifications } from './hooks/useNotifications';
import { initAudio } from './utils/soundManager';

import { 
  Store, 
  Layers, 
  MapPin, 
  Smartphone, 
  BarChart, 
  User, 
  Users,
  LayoutDashboard,
  RefreshCw, 
  Clock,
  HelpCircle,
  Database,
  Menu,
  X,
  ChevronRight,
  TrendingUp,
  Lock,
  Shield,
  LogOut,
  Truck,
  Settings,
  Bell,
  Check,
  Trash2,
  AlertTriangle,
  Info
} from 'lucide-react';

interface LoggedInUser {
  username: string;
  role: 'admin' | 'customer' | 'rider' | 'supplier';
  name: string;
}

export default function App() {
  // --- CORE SYSTEM STATES ---
  const [categories, setCategories] = useState<string[]>(['Rice & Grains', 'Canned Goods', 'Noodles & Instant', 'Milk & Dairy', 'Bread & Bakery', 'Beverages', 'Snacks', 'Toiletries', 'Household']);
  const [products, setProducts] = useState<Product[]>([]);
  const [currentBranch, setCurrentBranch] = useState<Branch>(
    () => (localStorage.getItem('silang_branch') as Branch) || 'Poblacion'
  );
  const [branches, setBranches] = useState<BranchRecord[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [services, setServices] = useState<ServiceTransaction[]>([]);
  const [supplierDeliveries, setSupplierDeliveries] = useState<SupplierDelivery[]>([]);
  
  const [activeTab, setActiveTab] = useState<'Dashboard' | 'POS' | 'Inventory' | 'Deliveries' | 'Customers' | 'Services' | 'Analytics' | 'Settings'>('Dashboard');
  const [userRole, setUserRole] = useState<'admin' | 'customer' | 'rider' | 'supplier'>('admin');
  const [activeCashier, setActiveCashier] = useState('Ate Lorna (Cashier)');
  const [localTime, setLocalTime] = useState(new Date());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [prefillLowStockProducts, setPrefillLowStockProducts] = useState(false);

  // --- NOTIFICATION & TOAST STATES (legacy admin-only system, kept for backward compat) ---
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [activeToasts, setActiveToasts] = useState<SystemNotification[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Customers state with dynamic signup support
  const [customers, setCustomers] = useState<{
    name: string;
    phone: string;
    barangay: string;
    address: string;
    coordinates: [number, number];
  }[]>([]);

  // Configurable Branch GPS Coordinates (must be dynamic per registered branch)
  const [branchCoordinates, setBranchCoordinates] = useState<Record<string, [number, number]>>({});

  const [selectedSettingsBranch, setSelectedSettingsBranch] = useState<string>('');

  // Calculate low stock count for current active branch
  const lowStockCount = products.filter((prod) => {
    // Branch names are dynamic; map branch -> product stock column
    // Convention: use stockBranchA for the first registered branch, stockBranchB for the second.
    // If only one branch exists, fallback to stockBranchA.
    const allBranches = branches.map(b => b.name);
    const branchAName = allBranches[0];
    const stock = currentBranch === branchAName ? prod.stockBranchA : prod.stockBranchB;
    return stock <= prod.lowStockThreshold;
  }).length;

  // Authentication State
  const [loggedInUser, setLoggedInUser] = useState<LoggedInUser | null>(null);

  // Staff list fetched from database (replaces hardcoded cashier options)
  const [staffList, setStaffList] = useState<{ id: number; name: string; role: string }[]>([]);

  // --- NEW ROLE-SCOPED NOTIFICATION SYSTEM ---
  const appNotifications = useNotifications({
    userId: loggedInUser && ['customer', 'rider'].includes(loggedInUser.role)
      ? loggedInUser.name
      : loggedInUser?.username || '',
    role: loggedInUser?.role || 'customer',
    token: localStorage.getItem('silang_auth_token') || '',
    enabled: !!loggedInUser,
  });

  // --- AUTH UTILS & DATA SYNCHRONIZATION ---
  const getAuthHeaders = () => {
    const token = localStorage.getItem('silang_auth_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };
  };

  /**
   * clearSession — wipes all auth-related localStorage keys and resets React state.
   * Call this on logout, on 401 responses, or when token validation fails on startup.
   */
  const clearSession = () => {
    localStorage.removeItem('silang_auth_token');
    localStorage.removeItem('silang_logged_in_user');
    setLoggedInUser(null);
    setUserRole('customer');
    setDeliveries([]);
    setServices([]);
    setTransactions([]);
    setSupplierDeliveries([]);
  };

  /**
   * authFetch — a thin fetch wrapper that auto-logs-out on 401 HTTP responses.
   * Use this for all authenticated API calls so session expiry is caught globally.
   */
  const authFetch = async (input: RequestInfo, init?: RequestInit): Promise<Response> => {
    const res = await fetch(input, init);
    if (res.status === 401) {
      console.warn('[Auth] 401 received — clearing session and forcing re-login.');
      clearSession();
    }
    return res;
  };

  // Listen for global session expiration (dispatched by fetchInterceptor on any 401)
  useEffect(() => {
    const handleUnauthorized = () => {
      console.warn('[Auth] Session expired or invalid — resetting frontend session.');
      clearSession();
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const refreshData = async (branch: Branch, role?: 'admin' | 'customer' | 'rider' | 'supplier') => {
    const headers = getAuthHeaders();
    const currentRole = role || userRole;

    try {
      // 1. Fetch public datasets (always run)
      const [prodRes, custRes, settingsRes, notifRes, branchesRes] = await Promise.all([
        fetch(`/api/products?branch=${encodeURIComponent(branch)}`),
        fetch(`/api/customers`),
        fetch(`/api/settings`),
        currentRole === 'admin' && headers.Authorization
          ? fetch(`/api/notifications/system`, { headers })
          : Promise.resolve(null),
        fetch(`/api/branches`),
      ]);

      if (prodRes.ok) {
        const pData = await prodRes.json();
        setProducts(pData.products || []);
      }
      if (custRes.ok) {
        const cData = await custRes.json();
        setCustomers(cData.customers || []);
      }
      if (settingsRes.ok) {
        const sData = await settingsRes.json();
        if (sData.categories) setCategories(JSON.parse(sData.categories));
        // NOTE: We intentionally do NOT load branch_coordinates from system_settings.
        // The branches table is the single source of truth for branch lat/lng.
      }
      if (notifRes?.ok) {
        const nData = await notifRes.json();
        setNotifications(Array.isArray(nData) ? nData : (Array.isArray(nData?.notifications) ? nData.notifications : []));
      }
      if (branchesRes.ok) {
        const bData = await branchesRes.json();
        const fetchedBranches = bData.branches || [];
        setBranches(fetchedBranches);

        // Always derive branchCoordinates directly from the branches table (source of truth).
        // This ensures the delivery map always reflects what is registered in the DB.
        const derived: Record<string, [number, number]> = {};
        for (const b of fetchedBranches) {
          derived[b.name] = [Number(b.lat) || 0, Number(b.lng) || 0];
        }
        setBranchCoordinates(derived);
      }

      // 2. Fetch authenticated datasets if token exists
      const token = localStorage.getItem('silang_auth_token');
      if (token) {
        const delivRes = await authFetch(`/api/deliveries?branch=${encodeURIComponent(branch)}`, { headers });
        if (delivRes.ok) {
          const dData = await delivRes.json();
          const fetchedDeliveries: Delivery[] = dData.deliveries || [];

          setDeliveries((prev) => {
            if (currentRole === 'admin' || currentRole === 'rider') {
              const existingIds = new Set(prev.map((d) => d.id));
              const newlyAdded = fetchedDeliveries.filter((d) => !existingIds.has(d.id));
              if (newlyAdded.length > 0 && prev.length > 0) {
                newlyAdded.forEach((nd) => {
                  addNotification(
                    'info',
                    '⚡ Bagong Customer Delivery Order!',
                    `May bagong order si ${nd.customerName} (${nd.items.length} items, ₱${nd.totalAmount.toFixed(2)}).`,
                    undefined,
                    nd.branch
                  );
                });
              }
            }
            return fetchedDeliveries;
          });
        }

        if (currentRole === 'admin') {
          const [servRes, txnRes, supRes] = await Promise.all([
            authFetch(`/api/services?branch=${encodeURIComponent(branch)}`, { headers }),
            authFetch(`/api/pos/transactions?branch=${encodeURIComponent(branch)}`, { headers }),
            authFetch(`/api/supplier-deliveries?branch=${encodeURIComponent(branch)}`, { headers }),
          ]);

          if (servRes.ok) {
            const sData = await servRes.json();
            setServices(sData.services || []);
          }
          if (txnRes.ok) {
            const tData = await txnRes.json();
            setTransactions(tData.transactions || []);
          }
          if (supRes.ok) {
            const sdData = await supRes.json();
            setSupplierDeliveries(sdData.supplierDeliveries || []);
          }
        }
      }
    } catch (err) {
      console.error("Error refreshing data:", err);
    }
  };

  // Fetch active staff list from database
  const fetchStaffList = async () => {
    try {
      const res = await fetch('/api/users/staff');
      if (res.ok) {
        const data = await res.json();
        setStaffList(data.staff || []);
      }
    } catch (e) {
      console.error('Failed to fetch staff list:', e);
    }
  };

  // --- APP BOOTSTRAP (MySQL-backed API) ---
  useEffect(() => {
    async function loadInitial() {
      const cachedToken = localStorage.getItem('silang_auth_token');
      const cachedUserStr = localStorage.getItem('silang_logged_in_user');
      let role: 'admin' | 'customer' | 'rider' | 'supplier' = 'customer';

      // If either token or user profile is missing, clear both immediately to prevent partial/zombie sessions
      if (!cachedToken || !cachedUserStr) {
        localStorage.removeItem('silang_auth_token');
        localStorage.removeItem('silang_logged_in_user');
        setLoggedInUser(null);
      } else {
        // Verify token with the server before trusting it (prevents stale sessions after server restarts)
        try {
          const verifyRes = await fetch('/api/auth/verify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${cachedToken}`,
            },
          });

          if (verifyRes.ok) {
            const verifyData = await verifyRes.json();
            if (verifyData.ok && verifyData.user) {
              const verifiedUser: LoggedInUser = verifyData.user;
              setLoggedInUser(verifiedUser);
              setUserRole(verifiedUser.role);
              role = verifiedUser.role;
              if (verifiedUser.role === 'admin' || (verifiedUser.role as any) === 'cashier') {
                setActiveCashier(verifiedUser.name);
              }
              localStorage.setItem('silang_logged_in_user', JSON.stringify(verifiedUser));
            } else {
              console.warn('[Auth] Server rejected stored session token — clearing.');
              clearSession();
            }
          } else {
            console.warn('[Auth] Token verification failed (status', verifyRes.status, ') — clearing session.');
            clearSession();
          }
        } catch (verifyErr) {
          console.warn('[Auth] Could not reach server to verify token — clearing session to prevent ghost state:', verifyErr);
          clearSession();
        }
      }

      const branch = ((localStorage.getItem('silang_branch') as Branch) || currentBranch) as Branch;
      setCurrentBranch(branch);

      await Promise.all([
        refreshData(branch, role),
        fetchStaffList(),
      ]);
    }

    loadInitial().catch((e) => {
      console.error(e);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // Sync loggedInUser and role
  useEffect(() => {
    if (loggedInUser) {
      localStorage.setItem('silang_logged_in_user', JSON.stringify(loggedInUser));
      setUserRole(loggedInUser.role);
      if (loggedInUser.role === 'admin') {
        setActiveCashier(loggedInUser.name);
      }
    } else {
      localStorage.removeItem('silang_logged_in_user');
      localStorage.removeItem('silang_auth_token');
    }
  }, [loggedInUser]);

  // Sync ONLY UI preferences + session to LocalStorage (business datasets are fetched from backend)
  // - Keep: branch + user session + UI settings
  // - Remove: products, transactions, deliveries, services, supplierDeliveries persistence


  // Persist branch selection so customer portal loads correct stock/availability.
  // IMPORTANT: customer ordering depends on `currentBranch` being set to a registered branch name.
  useEffect(() => {
    localStorage.setItem('silang_branch', currentBranch);
  }, [currentBranch]);

  // If currentBranch does not match any DB-registered branch name, snap to the
  // first registered branch. This applies to ALL roles (admin, cashier, customer).
  useEffect(() => {
    if (branches.length === 0) return;

    const branchNames = branches.map((b) => b.name);
    if (!branchNames.includes(currentBranch)) {
      const fallback = branchNames[0];
      if (fallback) {
        setCurrentBranch(fallback as Branch);
        refreshData(fallback as Branch, loggedInUser?.role);
      }
    }
  }, [branches]);




  // Clock tick
  useEffect(() => {
    const timer = setInterval(() => setLocalTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- REAL-TIME DATA POLLING (Auto-sync customer orders & status updates) ---
  useEffect(() => {
    if (!loggedInUser) return;

    // Poll every 5 seconds for real-time order updates
    const pollInterval = setInterval(() => {
      refreshData(currentBranch, loggedInUser.role);
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [currentBranch, loggedInUser]);

  // --- STATE MUTATION HANDLERS ---
  
  // System Notifications Helpers
  const addNotification = async (
    type: 'info' | 'warning' | 'success' | 'danger',
    title: string,
    message: string,
    productId?: string,
    branch?: Branch
  ) => {
    const newNotif: SystemNotification = {
      id: Math.random().toString(36).substring(2, 9),
      type,
      title,
      message,
      timestamp: new Date().toISOString(),
      productId,
      branch,
      read: false
    };
    
    // Optimistic UI update
    setNotifications((prev) => [newNotif, ...(Array.isArray(prev) ? prev : [])]);
    setActiveToasts((prev) => [...(Array.isArray(prev) ? prev : []), newNotif]);

    // Send to backend
    try {
      await fetch('/api/notifications/system', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(newNotif)
      });
    } catch (e) {
      console.error('Failed to save notification', e);
    }
  };

  const handleDismissToast = (id: string) => {
    setActiveToasts((prev) => (Array.isArray(prev) ? prev.filter((t) => t.id !== id) : []));
  };

  const handleMarkAllNotificationsRead = async () => {
    setNotifications((prev) => (Array.isArray(prev) ? prev.map((n) => ({ ...n, read: true })) : []));
    try {
      await fetch('/api/notifications/system/mark-all-read', { method: 'POST', headers: getAuthHeaders() });
    } catch (e) {
      console.error('Failed to mark all read', e);
    }
  };

  const handleClearAllNotifications = async () => {
    setNotifications([]);
    try {
      await fetch('/api/notifications/system/clear-all', { method: 'DELETE', headers: getAuthHeaders() });
    } catch (e) {
      console.error('Failed to clear notifications', e);
    }
  };

  const handleToggleReadNotification = async (id: string) => {
    const notif = Array.isArray(notifications) ? notifications.find(n => n.id === id) : undefined;
    if (!notif) return;
    
    const newReadState = !notif.read;
    setNotifications((prev) =>
      Array.isArray(prev) ? prev.map((n) => (n.id === id ? { ...n, read: newReadState } : n)) : []
    );
    
    try {
      await fetch(`/api/notifications/system/${id}/read`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ read: newReadState })
      });
    } catch (e) {
      console.error('Failed to toggle read state', e);
    }
  };

  // Changing current branch
  const handleBranchChange = (branch: Branch) => {
    setCurrentBranch(branch);
    refreshData(branch, userRole);
  };

  // Process POS checkout
  const handlePOSCheckout = async (newTxn: Transaction) => {

    // Check for low stock trigger
    newTxn.items.forEach((item) => {
      const p = products.find((prod) => prod.id === item.productId);
      if (p) {
        const oldStock = newTxn.branch === 'Poblacion' ? p.stockBranchA : p.stockBranchB;
        const newStock = Math.max(0, oldStock - item.quantity);
        if (oldStock >= p.lowStockThreshold && newStock < p.lowStockThreshold) {
          addNotification(
            'warning',
            'Mababang Stock Alert!',
            `Ang stock ng "${p.name}" sa ${newTxn.branch === 'Poblacion' ? 'Poblacion Branch' : 'Bypass Branch'} ay bumaba sa ${newStock} ${p.unit} (Threshold: ${p.lowStockThreshold} ${p.unit}).`,
            p.id,
            newTxn.branch
          );
        }
      }
    });

    // Persist transaction + decrement stock on the server (single source of truth)
    const res = await authFetch('/api/pos/checkout', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(newTxn),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || 'POS checkout failed');
    }

    await refreshData(currentBranch);
  };

  // Adjust stocks directly (or via supplier delivery)
  const handleUpdateStocks = async (productId: string, branch: Branch, newStock: number, overStockThreshold?: number) => {
    const res = await authFetch('/api/inventory/adjust', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ productId, branch, newStock, overStockThreshold }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err?.error || 'Failed to adjust stock');
      return;
    }

    const p = products.find((prod) => prod.id === productId);
    if (p) {
      const oldStock = branch === 'Poblacion' ? p.stockBranchA : p.stockBranchB;
      if (oldStock >= p.lowStockThreshold && newStock < p.lowStockThreshold) {
        addNotification(
          'warning',
          'Mababang Stock Alert!',
          `In-adjust ang stock ng "${p.name}" sa ${branch === 'Poblacion' ? 'Poblacion Branch' : 'Bypass Branch'} at bumaba sa ${newStock} ${p.unit} (Threshold: ${p.lowStockThreshold} ${p.unit}).`,
          p.id,
          branch
        );
      } else if (oldStock < p.lowStockThreshold && newStock >= p.lowStockThreshold) {
        addNotification(
          'success',
          'Na-restock na Product!',
          `Matagumpay na na-restock ang "${p.name}" sa ${branch === 'Poblacion' ? 'Poblacion Branch' : 'Bypass Branch'} (Bagong Stock: ${newStock} ${p.unit}).`,
          p.id,
          branch
        );
      }
    }

    await refreshData(currentBranch);
  };

  // Create new inventory product
  const handleAddNewProduct = async (newProduct: Product) => {
    const res = await authFetch('/api/products', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(newProduct),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || 'Failed to create product');
    }

    await refreshData(currentBranch);
  };

  // Update a product
  const handleUpdateProduct = async (updated: Product) => {
    const res = await authFetch(`/api/products/${updated.id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(updated),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || 'Failed to update product');
    }

    const p = products.find((prod) => prod.id === updated.id);
    if (p) {
      const oldLowA = p.stockBranchA < p.lowStockThreshold;
      const newLowA = updated.stockBranchA < updated.lowStockThreshold;
      const oldLowB = p.stockBranchB < p.lowStockThreshold;
      const newLowB = updated.stockBranchB < updated.lowStockThreshold;

      if (!oldLowA && newLowA) {
        addNotification(
          'warning',
          'Mababang Stock Alert!',
          `Ang stock ng "${updated.name}" sa Poblacion Branch ay mababa (Stock: ${updated.stockBranchA} ${updated.unit}, Threshold: ${updated.lowStockThreshold} ${updated.unit}).`,
          updated.id,
          'Poblacion'
        );
      }
      if (!oldLowB && newLowB) {
        addNotification(
          'warning',
          'Mababang Stock Alert!',
          `Ang stock ng "${updated.name}" sa Bypass Branch ay mababa (Stock: ${updated.stockBranchB} ${updated.unit}, Threshold: ${updated.lowStockThreshold} ${updated.unit}).`,
          updated.id,
          'Bypass'
        );
      }
    }

    await refreshData(currentBranch);
  };

  // Delete a product
  const handleDeleteProduct = async (productId: string) => {
    const res = await authFetch(`/api/products/${productId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || 'Failed to delete product');
    }

    await refreshData(currentBranch);
  };

  // Receive supplier delivery
  const handleAddSupplierDelivery = async (delivery: SupplierDelivery) => {
    const res = await authFetch('/api/supplier-deliveries', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(delivery),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || 'Failed to add supplier delivery');
    }

    await refreshData(currentBranch);
  };

  // Update a delivery order in tracker (driver pos, eta, status)
  const handleUpdateDelivery = async (updated: Delivery) => {
    // Match existing delivery using either id or deliveryId
    const existing = deliveries.find(
      (d) => d.id === updated.id || (d as any).deliveryId === updated.id || d.id === (updated as any).deliveryId
    );

    // OPTIMISTIC LOCAL UPDATE: immediately reflect changes in the UI
    setDeliveries((prev) =>
      prev.map((d) =>
        d.id === updated.id || (d as any).deliveryId === updated.id || d.id === (updated as any).deliveryId
          ? { ...d, ...updated }
          : d
      )
    );

    const body: any = {
      driverName: updated.driverName,
      etaMinutes: updated.etaMinutes,
    };
    // Only send status if it actually changed (to avoid transition validation errors)
    if (!existing || existing.status !== updated.status) {
      body.status = updated.status;
    }

    try {
      const res = await authFetch(`/api/deliveries/${updated.id}/status`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Failed to update delivery status');
      }

      await refreshData(currentBranch);
    } catch (error: any) {
      // ROLLBACK on failure: revert to the original delivery state
      if (existing) {
        setDeliveries(prev => prev.map(d => d.id === updated.id ? existing : d));
      }
      throw error; // re-throw so the caller can handle the error
    }
  };

  const handleVerifyDeliveryPayment = async (delivery: Delivery, verification: 'Successful' | 'Failed') => {
    const res = await authFetch(`/api/deliveries/${delivery.id}/payment`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        paymentMethod: delivery.paymentMethod,
        paymentReference: delivery.paymentReference,
        paymentAmount: delivery.paymentAmount ?? delivery.totalAmount,
        paymentGatewayStatus: verification,
        ...(verification === 'Failed' ? { paymentFailedReason: 'Hindi nakita o hindi tugma ang transfer sa official merchant account.' } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Hindi na-verify ang digital payment.');
    await refreshData(currentBranch, 'admin');
  };

  // Add new delivery order (persist on server, then refetch)
  const handleAddNewDelivery = async (newDelivery: Delivery, paymentProof?: File) => {
    const orderPayload = {
      id: newDelivery.id,
      branch: newDelivery.branch,
      customerName: newDelivery.customerName,
      customerPhone: newDelivery.customerPhone,
      address: newDelivery.address,
      barangay: newDelivery.barangay,
      coordinates: newDelivery.coordinates,
      items: newDelivery.items,
      deliveryFee: newDelivery.deliveryFee,
      totalAmount: newDelivery.totalAmount,
      driverName: newDelivery.driverName,
      driverCoordinates: newDelivery.driverCoordinates,
      etaMinutes: newDelivery.etaMinutes,
      notes: newDelivery.notes,
      timestamp: newDelivery.timestamp,
      paymentMethod: newDelivery.paymentMethod,
      paymentReference: newDelivery.paymentReference,
      paymentAmount: newDelivery.paymentAmount,
    };
    const token = localStorage.getItem('silang_auth_token');
    const formData = paymentProof ? new FormData() : null;
    if (formData) {
      formData.append('payload', JSON.stringify(orderPayload));
      formData.append('paymentProof', paymentProof);
    }

    const res = await authFetch('/api/deliveries', {
      method: 'POST',
      headers: formData
        ? (token ? { Authorization: 'Bearer ' + token } : {})
        : getAuthHeaders(),
      body: formData || JSON.stringify(orderPayload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || 'Failed to place delivery order');
    }

    newDelivery.items.forEach((item) => {
      const p = products.find((prod) => prod.id === item.productId);
      if (p) {
        const oldStock = newDelivery.branch === 'Poblacion' ? p.stockBranchA : p.stockBranchB;
        const ns = Math.max(0, oldStock - item.quantity);
        if (oldStock >= p.lowStockThreshold && ns < p.lowStockThreshold) {
          addNotification(
            'warning',
            'Mababang Stock Alert!',
            `Bumaba ang stock ng "${p.name}" sa ${newDelivery.branch === 'Poblacion' ? 'Poblacion Branch' : 'Bypass Branch'} gawa ng Delivery Order. Kasalukuyang stock: ${ns} ${p.unit}.`,
            p.id,
            newDelivery.branch
          );
        }
      }
    });

    await refreshData(currentBranch);
  };

  // Add new service transaction (e-load, bills, etc)
  const handleAddServiceTransaction = async (txn: ServiceTransaction) => {
    const res = await authFetch('/api/services', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(txn),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || 'Failed to add service transaction');
    }

    await refreshData(currentBranch);
  };

  // Rename a category and migrate its products
  const handleRenameCategory = (oldName: string, newName: string) => {
    setCategories((prev) => prev.map((c) => (c === oldName ? newName : c)));
    setProducts((prev) => prev.map((p) => {
      if (p.category === oldName) {
        return { ...p, category: newName };
      }
      return p;
    }));
  };

  // Register a new customer (now persisted in backend)
  const handleRegisterCustomer = async (newCustomer: {
    name: string;
    phone: string;
    barangay: string;
    address: string;
    coordinates: [number, number];
    pin?: string;
    storeImage?: string | null;
  }) => {
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCustomer.name,
          phone: newCustomer.phone,
          barangay: newCustomer.barangay,
          address: newCustomer.address,
          lat: newCustomer.coordinates[0],
          lng: newCustomer.coordinates[1],
          pin: newCustomer.pin || '',
          storeImage: newCustomer.storeImage || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Failed to register customer');
      }

      const data = await res.json();
      const listRes = await fetch('/api/customers');
      const listJson = await listRes.json();
      setCustomers(listJson.customers || []);

      return data;
    } catch (e: any) {
      alert(e?.message || 'Magka-error sa pag-register ng customer');
      return null;
    }
  };

  // Update customer default coordinate pin and address
  const handleUpdateCustomerCoordinates = async (name: string, coords: [number, number], address?: string) => {
    // 1. Optimistic update
    setCustomers((prev) => prev.map(c => {
      if (c.name === name) {
        return {
          ...c,
          coordinates: coords,
          ...(address ? { address } : {})
        };
      }
      return c;
    }));

    // 2. Persist to backend if logged in as customer
    if (loggedInUser && loggedInUser.role === 'customer' && loggedInUser.name === name) {
      try {
        const activeCust = customers.find(c => c.name === name);
        if (activeCust) {
          await authFetch('/api/customers/profile', {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({
              phone: activeCust.phone,
              barangay: activeCust.barangay,
              address: address || activeCust.address,
              lat: coords[0],
              lng: coords[1],
              storeImage: (activeCust as any).storeImage || null,
              pin: (activeCust as any).pin || null
            })
          });
        }
      } catch (e) {
        console.error("Failed to persist customer coordinates:", e);
      }
    }
  };

  // Reset entire system to fresh presets (backend seed)
  const resetSystem = async () => {
    if (
      !confirm(
        'Sigurado ka ba na nais mong i-reset ang buong POS at Inventory system? Mabubura ang lahat ng benta, supplier delivery, at custom products.'
      )
    ) {
      return;
    }

    try {
      await fetch('/api/admin/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      clearSession();
      await refreshData(currentBranch);

      alert('Matagumpay na nai-reset ang system sa factory settings!');
    } catch (e: any) {
      alert(e?.message || 'Reset failed');
    }
  };

  // Math for real-time daily sales calculation to display on header

  const totalRetailRevenue = transactions.reduce((sum, t) => sum + t.total, 0);
  const completedDeliveries = deliveries.filter((d) => d.status === 'Delivered');
  const totalDeliveryRevenue = completedDeliveries.reduce((sum, d) => sum + d.totalAmount, 0);
  const totalServicesFees = services.filter((s) => s.status === 'Completed').reduce((sum, s) => sum + s.serviceFee, 0);
  const totalGrossRevenue = totalRetailRevenue + totalDeliveryRevenue + totalServicesFees;

  const menuItems = [
    { id: 'Dashboard', label: 'Overview Dashboard', desc: 'Retail Summary & Metrics', icon: LayoutDashboard },
    { id: 'POS', label: 'Cash Register / POS', desc: 'Benta sa Cashier', icon: Store },
    { id: 'Inventory', label: 'Stocks & Inventory', desc: 'Suriin at Ayusin Estante', icon: Layers },
    { id: 'Deliveries', label: 'GPS Delivery Tracker', desc: 'GPS Hatid sa Silang', icon: MapPin },
    { id: 'Customers', label: 'Customer Directory', desc: 'Accounts & History', icon: Users },
    { id: 'Services', label: 'Load, Bills & Padala', desc: 'Value-Added Services', icon: Smartphone },
    { id: 'Analytics', label: 'Reports & Analytics', desc: 'Kita ng 2 Branch', icon: BarChart },
    ...(userRole === 'admin' ? [{ id: 'Settings', label: 'System Settings', desc: 'Lokasyon ng Store', icon: Settings }] : [])
  ];

  // --- SESSION HANDLERS ---
  const handleLogout = () => {
    // Clear ALL session-related keys from localStorage and state
    clearSession();
    setNotifications([]);
    setActiveToasts([]);
  };

  const handleLoginSuccess = (user: LoggedInUser) => {
    // Persist immediately so a page refresh after login restores the session
    const token = localStorage.getItem('silang_auth_token');
    if (token) {
      localStorage.setItem('silang_logged_in_user', JSON.stringify(user));
    }
    setLoggedInUser(user);
    setUserRole(user.role);
    if (user.role === 'admin' || (user.role as string) === 'cashier') {
      setActiveCashier(user.name);
      setActiveTab('POS');
    } else if (user.role === 'rider') {
      // Rider goes to their dedicated dashboard (handled by role check in render)
    }
    refreshData(currentBranch, user.role);
  };

  // ROUTING BYPASS BASED ON USER ROLE
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginModalDefaults, setLoginModalDefaults] = useState<{ defaultTab: 'admin' | 'customer' | 'rider' | 'supplier'; defaultMode?: 'login' | 'register' } | null>(null);

  const openLoginModal = (defaults: { defaultTab: 'admin' | 'customer' | 'rider' | 'supplier'; defaultMode?: 'login' | 'register' }) => {
    setLoginModalDefaults(defaults);
    setLoginModalOpen(true);
  };

  const closeLoginModal = () => {
    setLoginModalOpen(false);
  };

  // If not logged in, show a clean landing page with login/register modal capability.
  if (!loggedInUser) {
    return (
      <>
        <LandingPage onOpenLogin={openLoginModal} />

        <LandingAuthModal
          open={loginModalOpen}
          onClose={closeLoginModal}
          defaultTab={loginModalDefaults?.defaultTab || 'customer'}
          defaultMode={loginModalDefaults?.defaultMode}
          customers={customers}
          onRegisterCustomer={handleRegisterCustomer}
          branchCoordinates={branchCoordinates}
          onLoginSuccess={handleLoginSuccess}
        />
      </>
    );
  }







  if (loggedInUser.role === 'supplier') {
    return (
      <SupplierDashboard
        supplierName={loggedInUser.name}
        branches={branches}
        onLogout={handleLogout}
      />
    );
  }

  if (loggedInUser.role === 'rider') {
    return (
      <div className="min-h-screen bg-slate-50 font-sans">
        <RiderDashboard
          riderName={loggedInUser.name}
          deliveries={deliveries}
          branchCoordinates={branchCoordinates}
          onUpdateDelivery={handleUpdateDelivery}
          onLogout={handleLogout}
          customers={customers}
        />
      </div>
    );
  }

  if (loggedInUser.role === 'customer') {
    return (
      <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8 font-sans">
        <div className="max-w-7xl mx-auto">
          <CustomerPortal
            products={products}
            deliveries={deliveries}
            branchCoordinates={branchCoordinates}
            onAddNewDelivery={handleAddNewDelivery}
            authenticatedCustomerName={loggedInUser.name}
            onLogout={handleLogout}
            categories={categories}
            customers={customers}
            onUpdateCustomerCoordinates={handleUpdateCustomerCoordinates}
            onUpdateDelivery={handleUpdateDelivery}
            onRefreshData={() => refreshData(currentBranch, 'customer')}
          />
        </div>
        {/* AI Chatbot for Customers */}
        <AIAssistant
          loggedInUser={loggedInUser}
          categories={categories}
          products={products}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-800 antialiased font-sans overflow-hidden">
      
      {/* MOBILE DRAWERS BACKDROP */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 md:hidden animate-fade-in"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* LEFT SIDEBAR NAVIGATION: GEOMETRIC BALANCE DESIGN */}
      <aside className={`
        fixed inset-y-0 left-0 w-64 bg-slate-900 text-white flex flex-col z-50 transform transition-transform duration-300 ease-in-out shrink-0 h-screen border-r border-slate-800
        md:relative md:transform-none md:z-auto
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Sidebar Header Brand block */}
        <div className="p-5 flex items-center gap-3 border-b border-slate-800 shrink-0">
          <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center font-black text-xl text-white shadow-md shadow-orange-500/20 tracking-tighter shrink-0 select-none">
            S
          </div>
          <div>
            <h1 className="text-xs font-black font-display tracking-tight text-white leading-none">
              SILANG MINI MART
            </h1>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">
              Digital Portal
            </p>
          </div>
        </div>

        {/* Portal Switching Panel */}
        <div className="px-5 py-3 border-b border-slate-800 bg-slate-950/40 shrink-0">
          <div className="text-[9px] text-slate-500 font-extrabold uppercase tracking-widest mb-1.5">ACTIVE PORTAL VIEW:</div>
          <div className="grid grid-cols-2 gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => {
                setUserRole('admin');
                setActiveTab('POS');
              }}
              className={`py-1 text-[9px] font-black uppercase rounded tracking-wide cursor-pointer transition-all ${
                userRole === 'admin'
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Staff / POS
            </button>
            <button
              onClick={() => {
                setUserRole('customer');
              }}
              className={`py-1 text-[9px] font-black uppercase rounded tracking-wide cursor-pointer transition-all ${
                userRole === 'customer'
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Customer
            </button>
          </div>
        </div>

        {/* Close button for mobile inside sidebar */}
        <button
          onClick={() => setIsSidebarOpen(false)}
          className="absolute top-5 right-5 p-1 hover:bg-slate-800 rounded text-slate-400 md:hidden cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
        
        {/* Sidebar Navigation Items */}
        <nav className="flex-1 py-4 overflow-y-auto no-scrollbar">
          <div className="px-6 py-2.5 text-[10px] text-slate-500 uppercase font-black tracking-widest">
            {userRole === 'admin' ? 'Main Menu (Staff)' : 'Customer Portal'}
          </div>
          
          <div className="space-y-0.5">
            {userRole === 'customer' ? (
              <button
                onClick={() => {
                  setUserRole('customer');
                  setIsSidebarOpen(false);
                }}
                className="w-full flex items-center gap-3 px-6 py-3.5 text-left border-l-4 border-orange-500 bg-slate-800 text-white font-bold cursor-pointer relative"
              >
                <Store className="w-5 h-5 shrink-0 text-orange-500" />
                <div className="flex-1 min-w-0">
                  <span className="block text-sm font-bold leading-tight">Customer Portal</span>
                  <span className="text-[10px] font-medium block mt-0.5 text-slate-300">
                    Online Ordering & Live GPS
                  </span>
                </div>
              </button>
            ) : (
              menuItems.map((item) => {
                const isActive = activeTab === item.id;
                const Icon = item.icon;
                const showBadge = item.id === 'Inventory' && lowStockCount > 0;
                return (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setActiveTab(item.id as any);
                      setIsSidebarOpen(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        setActiveTab(item.id as any);
                        setIsSidebarOpen(false);
                      }
                    }}
                    className={`w-full flex items-center gap-3 px-6 py-3 text-left transition-all border-l-4 cursor-pointer relative group outline-none select-none ${
                      isActive
                        ? 'bg-slate-800 text-white border-orange-500 font-bold'
                        : 'text-slate-400 border-transparent hover:bg-slate-800/40 hover:text-white'
                    }`}
                  >
                    <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-orange-500' : 'text-slate-400'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="block text-sm font-bold leading-tight truncate">{item.label}</span>
                        {showBadge && (
                          <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[9px] font-black leading-none text-white bg-red-500 rounded-full animate-pulse shadow-xs shrink-0">
                            {lowStockCount}
                          </span>
                        )}
                      </div>
                      {item.id === 'Inventory' && lowStockCount > 0 ? (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-bold text-red-400 animate-pulse shrink-0">
                            ⚠️ Kulang stock!
                          </span>
                          <span className="text-slate-600 text-[10px]">•</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setActiveTab('Inventory');
                              setPrefillLowStockProducts(true);
                              setIsSidebarOpen(false);
                            }}
                            className="text-[10px] text-orange-400 hover:text-orange-350 font-black underline cursor-pointer shrink-0 transition-colors animate-pulse"
                          >
                            Quick Restock
                          </button>
                        </div>
                      ) : (
                        <span className={`text-[10px] font-medium block mt-0.5 truncate ${isActive ? 'text-slate-300' : 'text-slate-500'}`}>
                          {item.desc}
                        </span>
                      )}
                    </div>
                    <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${
                      isActive ? 'text-orange-500 translate-x-1' : 'text-slate-600 opacity-0 group-hover:opacity-100'
                    }`} />
                  </div>
                );
              })
            )}
          </div>
        </nav>

        {/* Sidebar Cashier selector panel */}
        <div className="p-5 bg-slate-950 border-t border-slate-800 shrink-0 space-y-3">
          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Active Staff</div>
          <div className="flex items-center gap-3 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
            <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-black flex items-center justify-center text-xs shadow-inner shrink-0">
              {activeCashier.substring(0, 1)}
            </div>
            <div className="flex-1 min-w-0">
              {staffList.length > 0 ? (
                <select
                  value={activeCashier}
                  onChange={(e) => {
                    setActiveCashier(e.target.value);
                    if (loggedInUser) {
                      setLoggedInUser({
                        ...loggedInUser,
                        name: e.target.value
                      });
                    }
                  }}
                  className="w-full bg-transparent text-white font-bold text-xs outline-none cursor-pointer border-none p-0 focus:ring-0 truncate font-sans"
                >
                  {staffList.map((s) => (
                    <option key={s.id} value={s.name} className="text-slate-800">
                      {s.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-white font-bold text-xs truncate block">{activeCashier}</span>
              )}
              <span className="text-[9px] text-slate-400 uppercase tracking-widest font-semibold block mt-0.5">
                {staffList.find(s => s.name === activeCashier)?.role === 'admin' ? 'Level: Admin' : 'Level: Staff'}
              </span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full bg-red-600/10 hover:bg-red-600/20 hover:text-white border border-red-900/30 text-red-400 font-black py-2.5 rounded-xl text-xs uppercase tracking-wide cursor-pointer transition-all flex items-center justify-center gap-1.5 active:scale-95"
          >
            <LogOut className="h-3.5 w-3.5 text-red-500" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* RIGHT MAIN WORKSPACE CONTAINER */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50">
        
        {/* Top Header Section matching the design */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            {/* Mobile Toggle Menu button */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 md:hidden cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Branch Selector Dropdown */}
            <div className="flex items-center gap-1.5 sm:gap-3">
              <span className="text-[10px] sm:text-xs text-slate-400 font-extrabold uppercase tracking-widest hidden sm:inline">BRANCH:</span>
              <select
                value={currentBranch}
                onChange={(e) => handleBranchChange(e.target.value as Branch)}
                className="bg-slate-100 border-none rounded-lg px-3 py-1.5 text-xs sm:text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                {branches.length > 0 ? (
                  branches.map(b => (
                    <option key={b.id} value={b.name}>{b.name}</option>
                  ))
                ) : (
                  <option value={currentBranch}>{currentBranch}</option>
                )}
              </select>
            </div>

            <span className="text-slate-300 hidden md:inline">|</span>
            
            {/* Online Status Pulser */}
            <div className="hidden md:flex items-center gap-2 text-[11px] sm:text-xs text-slate-500 font-extrabold tracking-wider uppercase">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
              <span>SYSTEM ONLINE</span>
            </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            {/* Dynamic Daily Gross Revenue displayed on top-right */}
            <div className="text-right">
              <p className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-black tracking-widest leading-none">Daily Sales</p>
              <p className="text-sm sm:text-base font-black text-slate-800 mt-1 font-mono">
                ₱{totalGrossRevenue.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>

            {/* Time Indicator */}
            <div className="hidden lg:flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 font-mono text-xs text-slate-600">
              <Clock className="h-3.5 w-3.5 text-orange-500" />
              <span>{localTime.toLocaleTimeString('en-PH', { hour12: true })}</span>
                    {/* Real-time System Notification Center — new role-scoped system */}
            <NotificationCenter
              role={loggedInUser?.role || 'customer'}
              notifications={appNotifications.notifications}
              unreadCount={appNotifications.unreadCount}
              preferences={appNotifications.preferences}
              audioEnabled={appNotifications.audioEnabled}
              audioPromptDismissed={appNotifications.audioPromptDismissed}
              isConnected={appNotifications.isConnected}
              onMarkRead={appNotifications.markAsRead}
              onMarkAllRead={appNotifications.markAllRead}
              onDelete={appNotifications.deleteNotification}
              onClearAll={appNotifications.clearAll}
              onEnableAudio={appNotifications.enableAudio}
              onDismissAudioPrompt={appNotifications.dismissAudioPrompt}
              onUpdatePreferences={appNotifications.updatePreferences}
              onActionClick={(notif: AppNotification) => {
                // Deep-link routing based on category/actionUrl
                if (notif.category === 'inventory') {
                  setActiveTab('Inventory');
                  setPrefillLowStockProducts(true);
                } else if (notif.category === 'delivery' || notif.category === 'orders') {
                  setActiveTab('Deliveries');
                } else if (notif.category === 'payment') {
                  setActiveTab('Deliveries');
                }
                setIsNotificationsOpen(false);
              }}
            />
       </div>

            {/* Fast actions header trigger */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('POS')}
                className="bg-orange-500 text-white px-3.5 py-2 rounded-lg text-xs font-black shadow-sm hover:bg-orange-600 transition-colors uppercase cursor-pointer tracking-wider shrink-0"
              >
                New Order
              </button>

              <button
                onClick={resetSystem}
                title="I-reset ang lahat ng data sa default presets"
                className="p-1.5 sm:p-2 bg-slate-100 hover:bg-red-50 hover:text-red-600 border border-slate-200 hover:border-red-200 text-slate-400 rounded-lg transition-colors cursor-pointer shrink-0"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </header>

        {/* Dynamic Inner Tab Content area with beautiful, smooth scrolling */}
        <div className="flex-1 overflow-y-auto bg-slate-50">
          <div className="max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
            {userRole === 'customer' ? (
              <CustomerPortal
                products={products}
                deliveries={deliveries}
                branchCoordinates={branchCoordinates}
                onAddNewDelivery={handleAddNewDelivery}
                authenticatedCustomerName={loggedInUser ? loggedInUser.name : 'Pedro Penduko'}
                onLogout={handleLogout}
                categories={categories}
              />
            ) : (
              <>
                {activeTab === 'Dashboard' && (
                  <DashboardOverview
                    products={products}
                    transactions={transactions}
                    deliveries={deliveries}
                    currentBranch={currentBranch}
                    onNavigateToTab={(tab) => setActiveTab(tab)}
                    onQuickRestock={() => {
                      setActiveTab('Inventory');
                      setPrefillLowStockProducts(true);
                    }}
                  />
                )}

                {activeTab === 'POS' && (
                  <POSView
                    products={products}
                    currentBranch={currentBranch}
                    onBranchChange={handleBranchChange}
                    onCheckout={handlePOSCheckout}
                    activeCashier={activeCashier}
                    categories={categories}
                  />
                )}

                {activeTab === 'Inventory' && (
                  <InventoryView
                    products={products}
                    currentBranch={currentBranch}
                    branches={branches}
                    onBranchChange={handleBranchChange}
                    onUpdateStocks={handleUpdateStocks}
                    onAddNewProduct={handleAddNewProduct}
                    onAddSupplierDelivery={handleAddSupplierDelivery}
                    supplierDeliveries={supplierDeliveries}
                    categories={categories}
                    onAddCategory={(cat) => setCategories(prev => [...prev, cat])}
                    onDeleteCategory={(cat) => setCategories(prev => prev.filter(c => c !== cat))}
                    onRenameCategory={handleRenameCategory}
                    onUpdateProduct={handleUpdateProduct}
                    onDeleteProduct={handleDeleteProduct}
                    prefillLowStockProducts={prefillLowStockProducts}
                    onPrefillConsumed={() => setPrefillLowStockProducts(false)}
                  />
                )}

                {activeTab === 'Deliveries' && (
                  <DeliveryTracker
                    deliveries={deliveries}
                    products={products}
                    branchCoordinates={branchCoordinates}
                    onUpdateDelivery={handleUpdateDelivery}
                    onVerifyPayment={handleVerifyDeliveryPayment}
                    onAddNewDelivery={handleAddNewDelivery}
                    staffList={staffList}
                  />
                )}

                {activeTab === 'Customers' && (
                  <CustomerManagementView
                    customers={customers}
                    deliveries={deliveries}
                  />
                )}

                {activeTab === 'Services' && (
                  <ValueAddedServices
                    currentBranch={currentBranch}
                    onBranchChange={handleBranchChange}
                    serviceTransactions={services}
                    onAddServiceTransaction={handleAddServiceTransaction}
                  />
                )}

                {activeTab === 'Analytics' && (
                  <BranchAnalytics
                    transactions={transactions}
                    deliveries={deliveries}
                    services={services}
                    products={products}
                  />
                )}

                {activeTab === 'Settings' && (
                  <div className="space-y-6">
                    {/* Branch Manager Panel */}
                    <BranchManagerPanel
                      branches={branches}
                      onBranchesChanged={() => refreshData(currentBranch)}
                    />
                    {/* Staff & Rider Manager Panel */}
                    <StaffManagerPanel
                      onStaffListChanged={fetchStaffList}
                    />
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                      <div className="border-b border-slate-100 pb-4 mb-4">
                        <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                          <Settings className="h-5 w-5 text-orange-500" />
                          <span>GPS Coordinates Configurator</span>
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                          I-pin ang tamang GPS coordinates ng inyong mga sangay para sa tamang kalkulasyon ng delivery route.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Branch Selector */}
                        <div className="space-y-4">
                          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                            <label className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mb-2">
                              Piliin ang Branch na I-aadjust ang Lokasyon:
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                              {(branches.length > 0 ? branches : []).map(b => (
                                <button
                                  key={b.id}
                                  type="button"
                                  onClick={() => setSelectedSettingsBranch(b.name)}
                                  className={`py-2 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                    selectedSettingsBranch === b.name
                                      ? 'bg-orange-500 text-white shadow'
                                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                  }`}
                                >
                                  🏪 {b.name}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div>
                              <span className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mb-1.5">
                                Kasalukuyang Coordinates ({selectedSettingsBranch}):
                              </span>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-[9px] text-slate-400 font-extrabold mb-1">LATITUDE:</label>
                                  <input
                                    type="number"
                                    step="0.0001"
                                    value={branchCoordinates[selectedSettingsBranch]?.[0] ?? ''}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value);
                                      setBranchCoordinates(prev => ({
                                        ...prev,
                                        [selectedSettingsBranch]: [
                                          Number.isFinite(val) ? val : 0,
                                          prev[selectedSettingsBranch]?.[1] ?? 0,
                                        ]
                                      }));
                                    }}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono font-bold font-sans"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[9px] text-slate-400 font-extrabold mb-1">LONGITUDE:</label>
                                  <input
                                    type="number"
                                    step="0.0001"
                                    value={branchCoordinates[selectedSettingsBranch]?.[1] ?? ''}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value);
                                      setBranchCoordinates(prev => ({
                                        ...prev,
                                        [selectedSettingsBranch]: [
                                          prev[selectedSettingsBranch]?.[0] ?? 0,
                                          Number.isFinite(val) ? val : 0,
                                        ]
                                      }));
                                    }}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono font-bold font-sans"
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="p-3 bg-orange-50 rounded-lg border border-orange-100 text-[11px] text-orange-800 leading-relaxed font-sans">
                              💡 <strong>Paraan ng Pagpili:</strong> I-click lamang ang mapa sa kanang bahagi sa eksaktong kinalalagyan ng {selectedSettingsBranch} Branch upang awtomatikong mabago ang coordinates nito.
                            </div>

                            {/* Save button — persists to branches table */}
                            {selectedSettingsBranch && (
                              <button
                                type="button"
                                onClick={async () => {
                                  const branch = branches.find(b => b.name === selectedSettingsBranch);
                                  if (!branch) return;
                                  const [lat, lng] = branchCoordinates[selectedSettingsBranch] ?? [0, 0];
                                  try {
                                    const res = await fetch(`/api/branches/${branch.id}`, {
                                      method: 'PUT',
                                      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ lat, lng }),
                                    });
                                    if (res.ok) {
                                      await refreshData(currentBranch);
                                      alert(`✅ Nai-save na ang lokasyon ng ${selectedSettingsBranch} branch sa database!`);
                                    } else {
                                      const err = await res.json();
                                      alert(`❌ Error: ${err.error || 'Hindi nai-save.'}`);
                                    }
                                  } catch (e) {
                                    alert('❌ Network error. Subukan muli.');
                                  }
                                }}
                                className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow"
                              >
                                💾 I-save ang Lokasyon ng {selectedSettingsBranch} Branch
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Interactive Admin Map Pinning */}
                        <div className="flex flex-col space-y-2">
                          <label className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-widest leading-none">
                            I-click sa Mapa upang I-pin ang Lokasyon ng {selectedSettingsBranch} Branch:
                          </label>
                          <div className="h-[220px] rounded-xl overflow-hidden border border-slate-200 shadow-sm relative bg-slate-100">
                            <DeliveryMap
                              activeDelivery={null}
                              branchCoordinates={branchCoordinates}
                              onMapClick={(lat, lng) => {
                                setBranchCoordinates(prev => ({
                                  ...prev,
                                  [selectedSettingsBranch]: [lat, lng]
                                }));
                              }}
                              height="100%"
                              showSearch={true}
                              onLocationSelected={(lat, lng) => {
                                setBranchCoordinates(prev => ({
                                  ...prev,
                                  [selectedSettingsBranch]: [lat, lng]
                                }));
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Registered Customers Directory Panel */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                      <div className="border-b border-slate-100 pb-3 mb-4 flex items-center justify-between">
                        <div>
                          <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">
                            👤 Rehistradong Customer Accounts Directory ({customers.length})
                          </h3>
                          <p className="text-[10px] text-slate-400">
                            Listahan ng mga nag-register na customer kasama ang kanilang mga isinave na GPS location pins.
                          </p>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left text-slate-500">
                          <thead className="text-[10px] uppercase font-black tracking-widest text-slate-400 bg-slate-50/75 border-b border-slate-200">
                            <tr>
                              <th className="px-4 py-3">Pangalan</th>
                              <th className="px-4 py-3">Telepono</th>
                              <th className="px-4 py-3">Barangay</th>
                              <th className="px-4 py-3">Address</th>
                              <th className="px-4 py-3">Coordinates (GPS PIN)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {customers.map((c, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                <td className="px-4 py-3 font-extrabold text-slate-800">{c.name}</td>
                                <td className="px-4 py-3 font-mono font-bold">{c.phone}</td>
                                <td className="px-4 py-3 font-medium text-slate-600">{c.barangay}</td>
                                <td className="px-4 py-3 max-w-xs truncate" title={c.address}>{c.address}</td>
                                <td className="px-4 py-3 font-mono text-[10px] font-black text-orange-600">
                                  [{c.coordinates[0].toFixed(5)}, {c.coordinates[1].toFixed(5)}]
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Adaptively styled floating AI Assistant co-pilot */}
        <AIAssistant
          loggedInUser={loggedInUser}
          categories={categories}
          products={products}
        />

        {/* Status bar footer matching the design */}
        <footer className="h-8 bg-white border-t border-slate-200 flex items-center justify-between px-4 sm:px-8 text-[10px] font-bold text-slate-400 shrink-0">
          <div className="flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5 text-blue-600" />
            <span>SILANG MINI MART • DIGI-GROCER V1.0.4</span>
          </div>
          <div className="flex gap-4">
            <span className="hidden sm:inline">POS: CONNECTED</span>
            <span>INVENTORY: SYNCHRONIZED</span>
            <span className="hidden md:inline">SERVER: PHP-SEA-1</span>
          </div>
        </footer>

        {/* Real-time System Toast Alerts — New Role-Scoped Notifications */}
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none max-w-sm w-full">
          <AnimatePresence mode="popLayout">
            {appNotifications.activeToasts.map((toast) => (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, x: 100, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 60, scale: 0.9, transition: { duration: 0.2 } }}
                transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              >
                <AppToastItem
                  toast={toast}
                  onDismiss={appNotifications.dismissToast}
                  onActionClick={(notif) => {
                    if (notif.category === 'inventory') {
                      setActiveTab('Inventory');
                      setPrefillLowStockProducts(true);
                    } else if (notif.category === 'delivery' || notif.category === 'orders') {
                      setActiveTab('Deliveries');
                    } else if (notif.category === 'payment') {
                      setActiveTab('Deliveries');
                    }
                    appNotifications.dismissToast(notif.id);
                  }}
                />
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Legacy system toast (for backward compat — low stock inline alerts from POSView) */}
          <AnimatePresence mode="popLayout">
            {activeToasts.map((toast) => (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, y: 30, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.9, transition: { duration: 0.2 } }}
                transition={{ type: 'spring', stiffness: 350, damping: 25 }}
              >
                <ToastItem
                  toast={toast}
                  onDismiss={handleDismissToast}
                  onActionClick={() => {
                    setActiveTab('Inventory');
                    setPrefillLowStockProducts(true);
                    setIsSidebarOpen(false);
                    handleDismissToast(toast.id);
                  }}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

      </main>

    </div>
  );
}
