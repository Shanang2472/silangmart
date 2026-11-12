/**
 * NotificationCenter — Full notification bell, dropdown, and settings panel
 * Integrates with useNotifications hook for admin, customer, and rider roles.
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bell, X, Check, Trash2, CheckCheck, Settings,
  ShoppingCart, Truck, CreditCard, Package,
  Shield, AlertTriangle, Info, User, Volume2, VolumeX,
  Wifi, WifiOff, ChevronDown, Eye
} from 'lucide-react';
import { AppNotification, NotificationPreferences, NotificationCategory, NotificationRole } from '../types';

// ─── Category Icons & Colors ──────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<NotificationCategory, {
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  label: string;
}> = {
  orders: { icon: ShoppingCart, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', label: 'Orders' },
  delivery: { icon: Truck, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', label: 'Delivery' },
  payment: { icon: CreditCard, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Payment' },
  inventory: { icon: Package, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', label: 'Inventory' },
  account: { icon: User, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', label: 'Account' },
  system: { icon: Info, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200', label: 'System' },
  security: { icon: Shield, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', label: 'Security' },
};

const TYPE_ACCENT: Record<string, string> = {
  info: 'bg-blue-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
};

function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function groupByDate(notifications: AppNotification[]): { label: string; items: AppNotification[] }[] {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);

  const groups: { label: string; items: AppNotification[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Older', items: [] },
  ];

  for (const n of notifications) {
    const d = new Date(n.createdAt); d.setHours(0, 0, 0, 0);
    if (d.getTime() === today.getTime()) groups[0].items.push(n);
    else if (d.getTime() === yesterday.getTime()) groups[1].items.push(n);
    else groups[2].items.push(n);
  }

  return groups.filter(g => g.items.length > 0);
}

// ─── Individual Notification Item ─────────────────────────────────────────────

interface NotifItemProps {
  notif: AppNotification;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
  onAction?: (notif: AppNotification) => void;
}

function NotificationItem({ notif, onMarkRead, onDelete, onAction }: NotifItemProps) {
  const catConfig = CATEGORY_CONFIG[notif.category] || CATEGORY_CONFIG.system;
  const CatIcon = catConfig.icon;
  const accentClass = TYPE_ACCENT[notif.type] || 'bg-blue-500';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 30 }}
      transition={{ duration: 0.2 }}
      className={`relative flex gap-3 p-3.5 transition-colors group ${
        !notif.isRead ? 'bg-orange-50/40' : 'hover:bg-slate-50/80'
      }`}
    >
      {/* Type accent stripe */}
      <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${accentClass} rounded-full`} />

      {/* Unread dot */}
      {!notif.isRead && (
        <div className="absolute top-3.5 right-3 w-2 h-2 bg-orange-500 rounded-full shadow-sm" />
      )}

      {/* Category icon */}
      <div className={`shrink-0 mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center border ${catConfig.bg} ${catConfig.border}`}>
        <CatIcon className={`w-4 h-4 ${catConfig.color}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pr-5">
        <p className={`text-[11px] font-black uppercase tracking-wide leading-none ${
          notif.type === 'danger' ? 'text-red-700'
          : notif.type === 'warning' ? 'text-amber-700'
          : notif.type === 'success' ? 'text-emerald-700'
          : 'text-slate-800'
        }`}>
          {notif.title}
        </p>
        <p className="text-[11px] text-slate-600 mt-1 leading-snug">{notif.message}</p>

        <div className="flex items-center gap-3 mt-2">
          <span className="text-[9px] text-slate-400 font-bold font-mono">
            {formatRelativeTime(notif.createdAt)}
          </span>

          {/* Action button */}
          {notif.actionUrl && onAction && (
            <button
              onClick={() => { onAction(notif); onMarkRead(notif.id); }}
              className={`text-[9px] font-black uppercase tracking-wide ${catConfig.color} hover:underline cursor-pointer transition-colors`}
            >
              {notif.category === 'orders' || notif.category === 'delivery' ? 'View →' :
               notif.category === 'inventory' ? 'Restock →' :
               notif.category === 'payment' ? 'Details →' : 'View →'}
            </button>
          )}

          <button
            onClick={() => onMarkRead(notif.id)}
            className="text-[9px] text-slate-400 hover:text-slate-600 font-bold uppercase cursor-pointer hidden group-hover:inline"
          >
            {notif.isRead ? '' : 'Mark read'}
          </button>
        </div>
      </div>

      {/* Delete button */}
      <button
        onClick={() => onDelete(notif.id)}
        className="shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-red-400 cursor-pointer p-0.5"
        title="Delete notification"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}

// ─── Sound Enable Prompt ──────────────────────────────────────────────────────

interface SoundPromptProps {
  onEnable: () => void;
  onDismiss: () => void;
}

function SoundEnablePrompt({ onEnable, onDismiss }: SoundPromptProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-3 right-3 z-[110] overflow-hidden rounded-2xl border border-orange-200 bg-white p-4 text-slate-900 shadow-2xl sm:left-auto sm:right-4 sm:max-w-sm"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500 text-white shadow-lg shadow-orange-950/20">
            <Volume2 className="h-4.5 w-4.5" />
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-orange-600">Live alerts sa device</p>
            <p className="text-[11px] font-bold text-slate-900">I-on ang tunog ng notification?</p>
          </div>
        </div>
        <button onClick={onDismiss} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer" aria-label="Isara">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="text-[10px] leading-relaxed text-slate-600">Makakarinig ka ng alert kapag may bagong order, delivery update, o mahalagang abiso para sa account mo.</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-orange-100 pt-3">
        <span className="text-[9px] font-semibold text-slate-500">Local prompt · hindi ito system-wide</span>
        <div className="flex items-center gap-2">
          <button
            onClick={onEnable}
            className="rounded-lg bg-orange-500 px-3 py-1.5 text-[9px] font-black uppercase tracking-wide text-white transition-colors hover:bg-orange-600 cursor-pointer"
          >
            I-on
          </button>
          <button
            onClick={onDismiss}
            className="text-[9px] font-bold uppercase text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            Mamaya
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Preferences Panel ────────────────────────────────────────────────────────

interface PrefsPanelProps {
  prefs: NotificationPreferences;
  audioEnabled: boolean;
  onUpdate: (p: Partial<NotificationPreferences>) => void;
  onEnableAudio: () => void;
}

function PreferencesPanel({ prefs, audioEnabled, onUpdate, onEnableAudio }: PrefsPanelProps) {
  const ToggleRow = ({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) => (
    <div className="flex items-center justify-between py-2">
      <span className="text-xs text-slate-600 font-semibold">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${value ? 'bg-orange-500' : 'bg-slate-200'}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${value ? 'left-5.5' : 'left-0.5'}`} />
      </button>
    </div>
  );

  return (
    <div className="px-4 pb-4 space-y-1">
      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 pt-2">Notification Preferences</div>
      <div className="divide-y divide-slate-100">
        <div className="flex items-center justify-between py-2">
          <span className="text-xs text-slate-600 font-semibold">🔊 Notification Sounds</span>
          {audioEnabled ? (
            <button
              onClick={() => onUpdate({ soundsOn: !prefs.soundsOn })}
              className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${prefs.soundsOn ? 'bg-orange-500' : 'bg-slate-200'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${prefs.soundsOn ? 'left-5.5' : 'left-0.5'}`} />
            </button>
          ) : (
            <button
              onClick={onEnableAudio}
              className="text-[10px] font-black text-orange-500 hover:text-orange-600 border border-orange-200 px-2 py-1 rounded-lg cursor-pointer transition-colors"
            >
              Enable Audio
            </button>
          )}
        </div>
        {prefs.soundsOn && audioEnabled && (
          <>
            <ToggleRow label="🛒 New Order Alerts" value={prefs.newOrderSound} onChange={v => onUpdate({ newOrderSound: v })} />
            <ToggleRow label="🚚 Delivery Alerts" value={prefs.deliverySound} onChange={v => onUpdate({ deliverySound: v })} />
            <ToggleRow label="💰 Payment Alerts" value={prefs.paymentSound} onChange={v => onUpdate({ paymentSound: v })} />
            <ToggleRow label="📦 Inventory Alerts" value={prefs.inventorySound} onChange={v => onUpdate({ inventorySound: v })} />
            <ToggleRow label="⚠️ Critical Alerts" value={prefs.criticalSound} onChange={v => onUpdate({ criticalSound: v })} />
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main NotificationCenter Component ───────────────────────────────────────

interface NotificationCenterProps {
  role: NotificationRole;
  notifications: AppNotification[];
  unreadCount: number;
  preferences: NotificationPreferences;
  audioEnabled: boolean;
  audioPromptDismissed: boolean;
  isConnected: boolean;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  onEnableAudio: () => void;
  onDismissAudioPrompt: () => void;
  onUpdatePreferences: (p: Partial<NotificationPreferences>) => void;
  onActionClick?: (notif: AppNotification) => void;
}

type FilterTab = 'all' | 'unread' | NotificationCategory;

export default function NotificationCenter({
  role,
  notifications,
  unreadCount,
  preferences,
  audioEnabled,
  audioPromptDismissed,
  isConnected,
  onMarkRead,
  onMarkAllRead,
  onDelete,
  onClearAll,
  onEnableAudio,
  onDismissAudioPrompt,
  onUpdatePreferences,
  onActionClick,
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowPrefs(false);
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  // Filter logic
  const filtered = notifications.filter(n => {
    if (activeTab === 'all') return true;
    if (activeTab === 'unread') return !n.isRead;
    return n.category === activeTab;
  });

  const groups = groupByDate(filtered);

  // Tab pills — show only categories that have notifications
  const presentCategories = [...new Set(notifications.map(n => n.category))];

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        id="notification-bell-btn"
        onClick={() => { setIsOpen(o => !o); setShowPrefs(false); }}
        className={`relative p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-center ${
          isOpen
            ? 'bg-orange-50 border-orange-300 text-orange-600'
            : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700 hover:bg-slate-50'
        }`}
        title="Notifications"
      >
        <Bell className={`h-4 w-4 ${unreadCount > 0 ? 'animate-[wiggle_1s_ease-in-out]' : ''}`} />

        {/* Unread badge */}
        {unreadCount > 0 && (
          <motion.span
            key={unreadCount}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white shadow"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </motion.span>
        )}

        {/* Connection indicator */}
        <span className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-white ${
          isConnected ? 'bg-green-500' : 'bg-red-400'
        }`} />
      </button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="absolute right-0 mt-2.5 w-[360px] sm:w-[400px] bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden origin-top-right"
          >
            {/* Header */}
            <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-orange-50/30">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-orange-500" />
                <h4 className="font-black text-slate-800 text-[12px] uppercase tracking-wider">Notifications · {role}</h4>
                {unreadCount > 0 && (
                  <span className="text-[9px] bg-orange-500 text-white font-black px-1.5 py-0.5 rounded-full">
                    {unreadCount} new
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {/* Connection status */}
                <span className={`flex items-center gap-1 text-[9px] font-bold ${isConnected ? 'text-green-600' : 'text-red-400'}`}>
                  {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                </span>

                {/* Sound toggle */}
                <button
                  onClick={() => audioEnabled ? onUpdatePreferences({ soundsOn: !preferences.soundsOn }) : onEnableAudio()}
                  className="p-1.5 text-slate-400 hover:text-orange-500 cursor-pointer rounded-lg hover:bg-orange-50 transition-colors"
                  title={audioEnabled ? (preferences.soundsOn ? 'Mute sounds' : 'Unmute sounds') : 'Enable audio'}
                >
                  {audioEnabled && preferences.soundsOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                </button>

                {/* Settings toggle */}
                <button
                  onClick={() => setShowPrefs(p => !p)}
                  className={`p-1.5 cursor-pointer rounded-lg transition-colors ${showPrefs ? 'text-orange-500 bg-orange-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                  title="Notification settings"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-slate-300 hover:text-slate-500 cursor-pointer rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Preferences panel (collapsible) */}
            <AnimatePresence>
              {showPrefs && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-b border-slate-100 bg-slate-50/50"
                >
                  <PreferencesPanel
                    prefs={preferences}
                    audioEnabled={audioEnabled}
                    onUpdate={onUpdatePreferences}
                    onEnableAudio={onEnableAudio}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Quick controls */}
            {notifications.length > 0 && (
              <div className="px-4 py-2 flex items-center justify-between text-[10px] border-b border-slate-100 bg-slate-50/50">
                <button
                  onClick={onMarkAllRead}
                  className="text-slate-500 hover:text-orange-500 font-black flex items-center gap-1 transition-colors uppercase cursor-pointer"
                >
                  <CheckCheck className="h-3 w-3" />
                  Mark all read
                </button>
                <button
                  onClick={onClearAll}
                  className="text-slate-400 hover:text-red-500 font-bold flex items-center gap-1 transition-colors uppercase cursor-pointer"
                >
                  <Trash2 className="h-3 w-3" />
                  Clear all
                </button>
              </div>
            )}

            {/* Category filter tabs */}
            {notifications.length > 0 && (
              <div className="px-4 py-2 flex gap-1.5 overflow-x-auto no-scrollbar border-b border-slate-100">
                {(['all', 'unread', ...presentCategories] as FilterTab[]).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`shrink-0 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide transition-all cursor-pointer ${
                      activeTab === tab
                        ? 'bg-orange-500 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {tab === 'all' ? 'All' : tab === 'unread' ? `Unread (${unreadCount})` : CATEGORY_CONFIG[tab as NotificationCategory]?.label || tab}
                  </button>
                ))}
              </div>
            )}

            {/* Notification list */}
            <div className="max-h-[380px] overflow-y-auto no-scrollbar">
              {filtered.length === 0 ? (
                <div className="p-10 text-center flex flex-col items-center gap-2">
                  <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center">
                    <Bell className="h-5 w-5 text-slate-300" />
                  </div>
                  <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                    {activeTab === 'unread' ? 'All caught up!' : 'No notifications'}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {activeTab === 'unread' ? 'No unread notifications.' : 'Important events will appear here.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100/80">
                  <AnimatePresence initial={false}>
                    {groups.map(group => (
                      <div key={group.label}>
                        <div className="px-4 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-50/70 sticky top-0">
                          {group.label}
                        </div>
                        {group.items.map(notif => (
                          <NotificationItem
                            key={notif.id}
                            notif={notif}
                            onMarkRead={onMarkRead}
                            onDelete={onDelete}
                            onAction={onActionClick}
                          />
                        ))}
                      </div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50 text-center">
                <span className="text-[10px] text-slate-400 font-bold">
                  {notifications.length} total • {unreadCount} unread
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Audio enable prompt (floating, not inside dropdown) */}
      <AnimatePresence>
        {!audioEnabled && !audioPromptDismissed && (
          <SoundEnablePrompt onEnable={onEnableAudio} onDismiss={onDismissAudioPrompt} />
        )}
      </AnimatePresence>
    </div>
  );
}
