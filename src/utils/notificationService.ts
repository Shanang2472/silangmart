/**
 * Centralized Notification Service — Silang Mini Mart
 * Handles notification creation, SSE broadcasting, and event dispatch.
 */

import { getPool } from '../db/mysql';
import { Response } from 'express';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationRole = 'admin' | 'customer' | 'rider' | 'supplier';
export type NotificationType = 'info' | 'warning' | 'success' | 'danger';
export type NotificationCategory = 'orders' | 'delivery' | 'payment' | 'inventory' | 'account' | 'system' | 'security';
export type NotificationPriority = 'normal' | 'important' | 'critical';

export interface NotificationPayload {
  userId: string;       // username or customer name
  role: NotificationRole;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  entityType?: string;  // 'delivery', 'product', etc.
  entityId?: string;    // delivery_id, product_id, etc.
  actionUrl?: string;   // hint for frontend deep-link
  priority?: NotificationPriority;
}

export interface StoredNotification extends NotificationPayload {
  id: string;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
}

// ─── SSE Registry ─────────────────────────────────────────────────────────────
// Key: `${userId}:${role}`, Value: array of SSE Response objects

const sseClients = new Map<string, Set<Response>>();

export function registerSseClient(userId: string, role: NotificationRole, res: Response) {
  const key = `${userId}:${role}`;
  if (!sseClients.has(key)) {
    sseClients.set(key, new Set());
  }
  sseClients.get(key)!.add(res);
}

export function unregisterSseClient(userId: string, role: NotificationRole, res: Response) {
  const key = `${userId}:${role}`;
  const clients = sseClients.get(key);
  if (clients) {
    clients.delete(res);
    if (clients.size === 0) sseClients.delete(key);
  }
}

function broadcastToUser(userId: string, role: NotificationRole, data: object) {
  const key = `${userId}:${role}`;
  const clients = sseClients.get(key);
  if (clients) {
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    for (const res of clients) {
      try { res.write(payload); } catch { /* client disconnected */ }
    }
  }
}

// ─── Duplicate Prevention ─────────────────────────────────────────────────────

async function hasDuplicateRecent(
  userId: string,
  entityType: string | undefined,
  entityId: string | undefined,
  category: NotificationCategory,
  role: NotificationRole,
  windowMinutes = 5
): Promise<boolean> {
  if (!entityType || !entityId) return false;
  const pool = getPool();
  try {
    const [rows]: any = await pool.query(
      `SELECT id FROM notifications
       WHERE user_id = ?
         AND role = ?
         AND entity_type = ?
         AND entity_id = ?
         AND category = ?
         AND created_at > DATE_SUB(NOW(), INTERVAL ? MINUTE)
       LIMIT 1`,
      [userId, role, entityType, entityId, category, windowMinutes]
    );
    return rows && rows.length > 0;
  } catch {
    return false;
  }
}

// ─── Core Create Function ─────────────────────────────────────────────────────

export async function createNotification(payload: NotificationPayload): Promise<StoredNotification | null> {
  const {
    userId, role, type, category, title, message,
    entityType, entityId, actionUrl, priority = 'normal'
  } = payload;

  // Duplicate prevention for inventory/low-stock (60 min window)
  const windowMin = category === 'inventory' ? 60 : 5;
  const isDuplicate = await hasDuplicateRecent(userId, entityType, entityId, category, role, windowMin);
  if (isDuplicate) return null;

  const id = `ntf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const pool = getPool();

  try {
    await pool.query(
      `INSERT INTO notifications
         (id, user_id, role, type, category, title, message, entity_type, entity_id, action_url, is_read)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [id, userId, role, type, category, title, message,
       entityType || null, entityId || null, actionUrl || null]
    );
  } catch (err: any) {
    console.error('[NotificationService] DB insert error:', err?.message);
    return null;
  }

  const notif: StoredNotification = {
    id,
    userId,
    role,
    type,
    category,
    title,
    message,
    entityType,
    entityId,
    actionUrl,
    priority,
    isRead: false,
    readAt: null,
    createdAt: new Date().toISOString(),
  };

  // SSE push
  broadcastToUser(userId, role, { event: 'new_notification', notification: notif, priority });

  return notif;
}

// ─── Admin Event Helpers ──────────────────────────────────────────────────────

export async function notifyAllAdmins(payload: Omit<NotificationPayload, 'userId' | 'role'>) {
  // Fetch all active admin users
  const pool = getPool();
  try {
    const [rows]: any = await pool.query(
      `SELECT username, name FROM users WHERE role = 'admin' AND status = 'active'`
    );
    const admins: string[] = rows?.map((r: any) => r.username) || [];
    if (admins.length === 0) {
      // Fallback: create one for 'admin'
      admins.push('admin');
    }
    for (const adminId of admins) {
      await createNotification({ ...payload, userId: adminId, role: 'admin' });
    }
  } catch (err: any) {
    // Fallback
    await createNotification({ ...payload, userId: 'admin', role: 'admin' });
  }
}

export async function notifyCustomer(customerName: string, payload: Omit<NotificationPayload, 'userId' | 'role'>) {
  return createNotification({ ...payload, userId: customerName, role: 'customer' });
}

export async function notifyRider(riderName: string, payload: Omit<NotificationPayload, 'userId' | 'role'>) {
  return createNotification({ ...payload, userId: riderName, role: 'rider' });
}

// ─── Order Event Helpers ──────────────────────────────────────────────────────

interface OrderEventData {
  deliveryId: string;
  orderNumber?: string;
  customerName: string;
  totalAmount: number;
  paymentMethod: string;
  riderName?: string;
  branch?: string;
  items?: { name: string; quantity: number }[];
  address?: string;
  notes?: string;
}

export async function notifyOrderCreated(data: OrderEventData) {
  const orderRef = data.orderNumber || data.deliveryId;
  await Promise.all([
    // Admin
    notifyAllAdmins({
      type: 'info',
      category: 'orders',
      title: '🛒 New Order Received',
      message: `Order #${orderRef} has been placed by ${data.customerName}. Total: ₱${data.totalAmount.toFixed(2)} via ${data.paymentMethod}.`,
      entityType: 'delivery',
      entityId: data.deliveryId,
      actionUrl: '/deliveries',
      priority: 'important',
    }),
    // Customer
    notifyCustomer(data.customerName, {
      type: 'success',
      category: 'orders',
      title: '✅ Order Placed Successfully',
      message: `Your order #${orderRef} has been received and is awaiting confirmation.`,
      entityType: 'delivery',
      entityId: data.deliveryId,
      actionUrl: '/orders',
      priority: 'important',
    }),
  ]);
}

export async function notifyOrderStatusChange(
  status: string,
  data: OrderEventData
) {
  const orderRef = data.orderNumber || data.deliveryId;
  switch (status) {
    case 'Preparing':
      await notifyCustomer(data.customerName, {
        type: 'info',
        category: 'orders',
        title: '👨‍🍳 Order Being Prepared',
        message: `Your order #${orderRef} is now being prepared by our team.`,
        entityType: 'delivery',
        entityId: data.deliveryId,
        actionUrl: '/orders',
        priority: 'normal',
      });
      break;

    case 'Out for Delivery':
      await notifyCustomer(data.customerName, {
        type: 'info',
        category: 'delivery',
        title: '🚚 Order Out for Delivery',
        message: `Your order #${orderRef} is now on its way! ${data.riderName ? `Rider: ${data.riderName}.` : ''}`,
        entityType: 'delivery',
        entityId: data.deliveryId,
        actionUrl: '/orders',
        priority: 'important',
      });
      if (data.riderName) {
        await notifyRider(data.riderName, {
          type: 'info',
          category: 'delivery',
          title: '🚚 Delivery In Progress',
          message: `You are now delivering Order #${orderRef} to ${data.customerName} at ${data.address || 'their location'}.`,
          entityType: 'delivery',
          entityId: data.deliveryId,
          actionUrl: '/rider',
          priority: 'normal',
        });
      }
      break;

    case 'Delivered':
      await Promise.all([
        notifyCustomer(data.customerName, {
          type: 'success',
          category: 'delivery',
          title: '🎉 Order Delivered!',
          message: `Your order #${orderRef} has been successfully delivered. Thank you for shopping at Silang Mini Mart!`,
          entityType: 'delivery',
          entityId: data.deliveryId,
          actionUrl: '/orders',
          priority: 'important',
        }),
        notifyAllAdmins({
          type: 'success',
          category: 'delivery',
          title: '✅ Delivery Completed',
          message: `Order #${orderRef} has been delivered to ${data.customerName}${data.riderName ? ` by ${data.riderName}` : ''}.`,
          entityType: 'delivery',
          entityId: data.deliveryId,
          actionUrl: '/deliveries',
          priority: 'normal',
        }),
      ]);
      break;

    case 'Cancelled':
      const promises = [
        notifyCustomer(data.customerName, {
          type: 'danger',
          category: 'orders',
          title: '❌ Order Cancelled',
          message: `Your order #${orderRef} has been cancelled. If you have questions, please contact us.`,
          entityType: 'delivery',
          entityId: data.deliveryId,
          actionUrl: '/orders',
          priority: 'important',
        }),
        notifyAllAdmins({
          type: 'warning',
          category: 'orders',
          title: '❌ Order Cancelled',
          message: `Order #${orderRef} by ${data.customerName} has been cancelled.`,
          entityType: 'delivery',
          entityId: data.deliveryId,
          actionUrl: '/deliveries',
          priority: 'normal',
        }),
      ];
      if (data.riderName) {
        promises.push(
          notifyRider(data.riderName, {
            type: 'danger',
            category: 'delivery',
            title: '❌ Delivery Cancelled',
            message: `Delivery for Order #${orderRef} (${data.customerName}) has been cancelled. Please return to base.`,
            entityType: 'delivery',
            entityId: data.deliveryId,
            actionUrl: '/rider',
            priority: 'critical',
          }) as any
        );
      }
      await Promise.all(promises);
      break;
  }
}

export async function notifyRiderAssigned(riderName: string, data: OrderEventData) {
  const orderRef = data.orderNumber || data.deliveryId;
  await notifyRider(riderName, {
    type: 'info',
    category: 'delivery',
    title: '📦 New Delivery Assignment',
    message: `Order #${orderRef} has been assigned to you. Customer: ${data.customerName}. Amount: ₱${data.totalAmount.toFixed(2)} (${data.paymentMethod}). Deliver to: ${data.address || 'see details'}.`,
    entityType: 'delivery',
    entityId: data.deliveryId,
    actionUrl: '/rider',
    priority: 'important',
  });
  // Also notify customer that rider has been assigned
  await notifyCustomer(data.customerName, {
    type: 'info',
    category: 'delivery',
    title: '🏍️ Rider Assigned',
    message: `Your order #${orderRef} has been assigned to ${riderName}. Your delivery is being prepared!`,
    entityType: 'delivery',
    entityId: data.deliveryId,
    actionUrl: '/orders',
    priority: 'normal',
  });
}

export async function notifyPaymentReceived(data: OrderEventData & { codAmount?: number }) {
  const orderRef = data.orderNumber || data.deliveryId;
  await Promise.all([
    notifyCustomer(data.customerName, {
      type: 'success',
      category: 'payment',
      title: '💰 Payment Received',
      message: `Payment of ₱${data.totalAmount.toFixed(2)} for Order #${orderRef} has been recorded successfully.`,
      entityType: 'delivery',
      entityId: data.deliveryId,
      actionUrl: '/orders',
      priority: 'important',
    }),
    notifyAllAdmins({
      type: 'success',
      category: 'payment',
      title: data.paymentMethod === 'Cash' ? '💰 COD Payment Received' : `💰 ${data.paymentMethod} Payment Verified`,
      message: `${data.riderName || 'Store admin'} confirmed payment of ₱${(data.codAmount ?? data.totalAmount).toFixed(2)} for Order #${orderRef} (${data.customerName}).`,
      entityType: 'delivery',
      entityId: data.deliveryId,
      actionUrl: '/deliveries',
      priority: 'important',
    }),
  ]);
}

export async function notifyLowStock(productName: string, productId: string, stock: number, branch: string) {
  await notifyAllAdmins({
    type: 'warning',
    category: 'inventory',
    title: '📦 Low Stock Alert',
    message: `"${productName}" is running low at ${branch} branch. Current stock: ${stock}.`,
    entityType: 'product',
    entityId: productId,
    actionUrl: '/inventory',
    priority: 'normal',
  });
}

export async function notifyOutOfStock(productName: string, productId: string, branch: string) {
  await notifyAllAdmins({
    type: 'danger',
    category: 'inventory',
    title: '🚫 Out of Stock',
    message: `"${productName}" is now out of stock at ${branch} branch. Immediate restocking required.`,
    entityType: 'product',
    entityId: productId,
    actionUrl: '/inventory',
    priority: 'critical',
  });
}
