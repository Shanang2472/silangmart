/**
 * AppNotificationToast — Role-aware toast for real-time notification alerts
 * Supports action buttons, category icons, priorities, and auto-dismiss.
 */

import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import {
  X, ShoppingCart, Truck, CreditCard, Package,
  Shield, Info, AlertTriangle, CheckCircle, Bell
} from 'lucide-react';
import { AppNotification, NotificationCategory } from '../types';

const CATEGORY_ICON: Record<NotificationCategory, React.ElementType> = {
  orders:    ShoppingCart,
  delivery:  Truck,
  payment:   CreditCard,
  inventory: Package,
  security:  Shield,
  system:    Info,
  account:   Bell,
};

const CATEGORY_COLOR: Record<NotificationCategory, { stripe: string; icon: string; iconBg: string; action: string }> = {
  orders:    { stripe: 'bg-blue-500',    icon: 'text-blue-600',    iconBg: 'bg-blue-50 border-blue-200',    action: 'text-blue-600' },
  delivery:  { stripe: 'bg-orange-500',  icon: 'text-orange-600',  iconBg: 'bg-orange-50 border-orange-200', action: 'text-orange-600' },
  payment:   { stripe: 'bg-emerald-500', icon: 'text-emerald-600', iconBg: 'bg-emerald-50 border-emerald-200', action: 'text-emerald-600' },
  inventory: { stripe: 'bg-amber-500',   icon: 'text-amber-600',   iconBg: 'bg-amber-50 border-amber-200',   action: 'text-amber-600' },
  security:  { stripe: 'bg-red-500',     icon: 'text-red-600',     iconBg: 'bg-red-50 border-red-200',       action: 'text-red-600' },
  system:    { stripe: 'bg-slate-400',   icon: 'text-slate-600',   iconBg: 'bg-slate-50 border-slate-200',   action: 'text-slate-600' },
  account:   { stripe: 'bg-indigo-500',  icon: 'text-indigo-600',  iconBg: 'bg-indigo-50 border-indigo-200', action: 'text-indigo-600' },
};

const TYPE_ICON: Record<string, React.ElementType> = {
  success: CheckCircle,
  danger:  AlertTriangle,
  warning: AlertTriangle,
  info:    Info,
};

const DISMISS_TIMEOUT: Record<string, number> = {
  normal:    6000,
  important: 8000,
  critical:  12000,
};

interface AppToastItemProps {
  toast: AppNotification;
  onDismiss: (id: string) => void;
  onActionClick?: (notif: AppNotification) => void;
}

export function AppToastItem({ toast, onDismiss, onActionClick }: AppToastItemProps) {
  const timeout = DISMISS_TIMEOUT[toast.priority || 'normal'] || 6000;

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), timeout);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss, timeout]);

  const cat = toast.category || 'system';
  const colors = CATEGORY_COLOR[cat as NotificationCategory] || CATEGORY_COLOR.system;
  const CatIcon = CATEGORY_ICON[cat as NotificationCategory] || Bell;
  const TypeIcon = TYPE_ICON[toast.type] || Info;

  const actionLabel =
    cat === 'orders' ? 'View Order' :
    cat === 'delivery' ? 'View Delivery' :
    cat === 'payment' ? 'View Details' :
    cat === 'inventory' ? 'Restock Now' : 'View';

  return (
    <div className="max-w-sm w-full bg-white shadow-2xl rounded-2xl border border-slate-150 overflow-hidden pointer-events-auto relative flex transition-all hover:shadow-2xl hover:-translate-y-0.5">
      {/* Left color stripe */}
      <div className={`w-1 shrink-0 ${colors.stripe}`} />

      {/* Category icon */}
      <div className="pl-3 pr-1 flex items-start pt-3.5">
        <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${colors.iconBg}`}>
          <CatIcon className={`w-4 h-4 ${colors.icon}`} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 p-3 pl-2">
        <div className="flex items-center gap-1.5 mb-0.5">
          <TypeIcon className={`w-3 h-3 shrink-0 ${
            toast.type === 'success' ? 'text-emerald-500' :
            toast.type === 'danger'  ? 'text-red-500' :
            toast.type === 'warning' ? 'text-amber-500' : 'text-blue-500'
          }`} />
          <p className="text-[11px] font-black uppercase tracking-wide text-slate-800 truncate leading-none">
            {toast.title}
          </p>
          {toast.priority === 'critical' && (
            <span className="shrink-0 text-[8px] font-black bg-red-100 text-red-600 px-1.5 py-0.5 rounded uppercase tracking-wide">
              URGENT
            </span>
          )}
        </div>

        <p className="text-[11px] text-slate-600 leading-snug mt-1 line-clamp-2">{toast.message}</p>

        {/* Action button */}
        {toast.actionUrl && onActionClick && (
          <button
            onClick={() => { onActionClick(toast); onDismiss(toast.id); }}
            className={`mt-2 text-[10px] font-black uppercase tracking-wide ${colors.action} hover:underline cursor-pointer transition-colors flex items-center gap-1`}
          >
            {actionLabel} →
          </button>
        )}
      </div>

      {/* Dismiss */}
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 p-2 pt-2.5 text-slate-300 hover:text-slate-500 cursor-pointer transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      {/* Auto-dismiss progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-100">
        <div
          className={`h-full ${colors.stripe} opacity-40`}
          style={{
            animation: `shrink ${timeout}ms linear forwards`,
          }}
        />
      </div>
    </div>
  );
}
