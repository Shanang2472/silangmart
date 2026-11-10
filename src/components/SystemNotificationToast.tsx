import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, Check, Info, X } from 'lucide-react';
import { SystemNotification } from '../types';

interface ToastItemProps {
  toast: SystemNotification;
  onDismiss: (id: string) => void;
  onActionClick?: (productId: string) => void;
}

export const ToastItem = ({ toast, onDismiss, onActionClick }: ToastItemProps) => {
  useEffect(() => {
    // Automatically dismiss the toast after 6 seconds
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 6000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const bgColor = {
    info: 'bg-blue-50/95 border-blue-200 text-blue-900',
    warning: 'bg-amber-50/95 border-amber-200 text-amber-900',
    success: 'bg-emerald-50/95 border-emerald-200 text-emerald-900',
    danger: 'bg-rose-50/95 border-rose-200 text-rose-900',
  }[toast.type];

  const iconColor = {
    info: 'text-blue-500',
    warning: 'text-amber-500',
    success: 'text-emerald-500',
    danger: 'text-rose-500',
  }[toast.type];

  return (
    <div
      className={`max-w-sm w-full bg-white shadow-xl rounded-2xl border p-4 flex items-start gap-3 pointer-events-auto relative overflow-hidden backdrop-blur-md border-slate-150 transition-all hover:shadow-2xl`}
    >
      {/* Dynamic left color stripe */}
      <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${
        toast.type === 'warning' ? 'bg-amber-500' :
        toast.type === 'success' ? 'bg-emerald-500' :
        toast.type === 'danger' ? 'bg-rose-500' : 'bg-blue-500'
      }`} />
      
      <div className="shrink-0 pl-1.5">
        {toast.type === 'warning' && <AlertTriangle className={`h-5 w-5 ${iconColor}`} />}
        {toast.type === 'success' && <Check className={`h-5 w-5 ${iconColor}`} />}
        {toast.type === 'info' && <Info className={`h-5 w-5 ${iconColor}`} />}
        {toast.type === 'danger' && <AlertTriangle className={`h-5 w-5 ${iconColor}`} />}
      </div>
      
      <div className="flex-1 min-w-0 pr-2">
        <p className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
          {toast.title}
          {toast.branch && (
            <span className={`text-[8px] font-extrabold uppercase px-1 py-0.2 rounded-md ${
              toast.branch === 'Poblacion' 
                ? 'bg-blue-100 text-blue-700' 
                : 'bg-purple-100 text-purple-700'
            }`}>
              {toast.branch}
            </span>
          )}
        </p>
        <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">{toast.message}</p>
        
        {toast.productId && onActionClick && (
          <button
            onClick={() => onActionClick(toast.productId!)}
            className="text-[10px] text-orange-500 hover:text-orange-600 font-extrabold uppercase mt-2.5 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <span>Suriin sa Inventory</span>
            <span className="font-sans leading-none">→</span>
          </button>
        )}
      </div>
      
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-slate-400 hover:text-slate-600 p-0.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
