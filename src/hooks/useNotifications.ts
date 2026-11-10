/**
 * useNotifications — React hook for the full notification system
 * Handles SSE real-time push, CRUD, sound, preferences, and offline recovery.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { AppNotification, NotificationPreferences } from '../types';
import { initAudio, playSound, getSoundLevel, isAudioReady } from '../utils/soundManager';
import { resolveApiUrl } from '../utils/fetchInterceptor';

interface UseNotificationsOptions {
  userId: string;
  role: 'admin' | 'customer' | 'rider' | 'supplier';
  token: string;
  enabled: boolean;
}

interface UseNotificationsReturn {
  notifications: AppNotification[];
  unreadCount: number;
  preferences: NotificationPreferences;
  audioEnabled: boolean;
  audioPromptDismissed: boolean;
  activeToasts: AppNotification[];
  isConnected: boolean;

  enableAudio: () => void;
  dismissAudioPrompt: () => void;
  markAsRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  dismissToast: (id: string) => void;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => Promise<void>;
  refreshNotifications: () => Promise<void>;
}

export function useNotifications({
  userId,
  role,
  token,
  enabled,
}: UseNotificationsOptions): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [activeToasts, setActiveToasts] = useState<AppNotification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    userId,
    role,
    notificationsOn: true,
    soundsOn: true,
    newOrderSound: true,
    deliverySound: true,
    paymentSound: true,
    inventorySound: true,
    criticalSound: true,
  });
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [audioPromptDismissed, setAudioPromptDismissed] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const sseRef = useRef<EventSource | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seenIds = useRef<Set<string>>(new Set());

  const authHeaders = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }), [token]);

  // ─── Fetch existing notifications ─────────────────────────────────────────
  const refreshNotifications = useCallback(async () => {
    if (!enabled || !token) return;
    try {
      const res = await fetch('/api/notifications', { headers: authHeaders() });
      if (!res.ok) throw new Error(`Notification refresh failed (${res.status}).`);
      const data = await res.json();
      const notifs: AppNotification[] = data.notifications || [];
      setNotifications(previous => {
        const merged = new Map(notifs.map(notification => [notification.id, notification]));
        previous.forEach(notification => {
          if (!merged.has(notification.id)) merged.set(notification.id, notification);
        });
        return [...merged.values()].sort(
          (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
        );
      });
      // Seed seenIds so we don't show toasts for existing ones
      notifs.forEach(n => seenIds.current.add(n.id));
    } catch (error) {
      console.warn('[Notifications] Refresh failed; will retry:', error);
    }
  }, [enabled, token, authHeaders]);

  // ─── Fetch preferences ────────────────────────────────────────────────────
  const fetchPreferences = useCallback(async () => {
    if (!enabled || !token) return;
    try {
      const res = await fetch('/api/notifications/preferences', { headers: authHeaders() });
      if (!res.ok) throw new Error(`Notification preferences failed (${res.status}).`);
      const data = await res.json();
      if (data.preferences) setPreferences(data.preferences);
    } catch (error) {
      console.warn('[Notifications] Could not load preferences:', error);
    }
  }, [enabled, token, authHeaders]);

  // ─── Handle incoming SSE notification ────────────────────────────────────
  const handleIncomingNotification = useCallback((notif: AppNotification, priority?: string) => {
    // Skip if already seen (reconnection dedup)
    if (seenIds.current.has(notif.id)) return;
    seenIds.current.add(notif.id);

    if (!preferences.notificationsOn) return;

    // Add to notifications list
    setNotifications(prev => [notif, ...prev]);

    // Show toast
    setActiveToasts(prev => [...prev.slice(-4), notif]); // max 5 toasts

    // Play sound
    if (preferences.soundsOn && audioEnabled) {
      const soundLevel = getSoundLevel(notif.category, priority || notif.priority);

      // Respect category-specific sound prefs
      const shouldPlay =
        (notif.category === 'orders' && preferences.newOrderSound) ||
        (notif.category === 'delivery' && preferences.deliverySound) ||
        (notif.category === 'payment' && preferences.paymentSound) ||
        (notif.category === 'inventory' && preferences.inventorySound) ||
        ((notif.category === 'system' || notif.category === 'security') && preferences.criticalSound) ||
        !['orders','delivery','payment','inventory','system','security'].includes(notif.category);

      if (shouldPlay) {
        playSound(soundLevel);
      }
    }
  }, [preferences, audioEnabled]);

  // ─── SSE Connection ───────────────────────────────────────────────────────
  const connectSSE = useCallback(() => {
    if (!enabled || !token) return;
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }

    const url = resolveApiUrl(`/api/notifications/stream?token=${encodeURIComponent(token)}`);
    const es = new EventSource(url);
    sseRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === 'connected') {
          setIsConnected(true);
          void refreshNotifications();
        } else if (data.event === 'new_notification' && data.notification) {
          handleIncomingNotification(data.notification, data.priority);
        }
      } catch (error) {
        console.warn('[Notifications] Ignored malformed stream event:', error);
      }
    };

    es.onerror = () => {
      setIsConnected(false);
      es.close();
      sseRef.current = null;
      // Auto-reconnect after 5 seconds
      if (!reconnectTimer.current) {
        reconnectTimer.current = setTimeout(() => {
          reconnectTimer.current = null;
          connectSSE();
        }, 5000);
      }
    };
  }, [enabled, token, handleIncomingNotification, refreshNotifications]);

  // ─── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !token) return;
    seenIds.current.clear();
    refreshNotifications();
    fetchPreferences();
    connectSSE();
    const recoveryPoll = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshNotifications();
    }, 20000);

    return () => {
      sseRef.current?.close();
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      clearInterval(recoveryPoll);
    };
  }, [enabled, userId, role, token, refreshNotifications, fetchPreferences, connectSSE]);

  // ─── Audio unlock ─────────────────────────────────────────────────────────
  const enableAudio = useCallback(() => {
    initAudio();
    setAudioEnabled(true);
    setAudioPromptDismissed(true);
    // Store preference
    try { localStorage.setItem('silang_audio_enabled', '1'); } catch { /* ignore */ }
  }, []);

  const dismissAudioPrompt = useCallback(() => {
    setAudioPromptDismissed(true);
    try { localStorage.setItem('silang_audio_prompt_dismissed', '1'); } catch { /* ignore */ }
  }, []);

  // Restore audio preference on mount
  useEffect(() => {
    const saved = localStorage.getItem('silang_audio_enabled');
    const dismissed = localStorage.getItem('silang_audio_prompt_dismissed');
    if (saved === '1') {
      initAudio();
      setAudioEnabled(true);
      setAudioPromptDismissed(true);
    } else if (dismissed === '1') {
      setAudioPromptDismissed(true);
    }
  }, []);

  // ─── CRUD Operations ──────────────────────────────────────────────────────
  const markAsRead = useCallback(async (id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n)
    );
    try {
      const response = await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ read: true }),
      });
      if (!response.ok) throw new Error(`Mark notification read failed (${response.status}).`);
    } catch (error) {
      console.warn('[Notifications] Could not mark notification read:', error);
    }
  }, [authHeaders]);

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString();
    setNotifications(prev =>
      prev.map(n => ({ ...n, isRead: true, readAt: now }))
    );
    try {
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
        headers: authHeaders(),
      });
      if (!response.ok) throw new Error(`Mark all notifications read failed (${response.status}).`);
    } catch (error) {
      console.warn('[Notifications] Could not mark all notifications read:', error);
    }
  }, [authHeaders]);

  const deleteNotification = useCallback(async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    setActiveToasts(prev => prev.filter(n => n.id !== id));
    try {
      const response = await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!response.ok) throw new Error(`Delete notification failed (${response.status}).`);
    } catch (error) {
      console.warn('[Notifications] Could not delete notification:', error);
    }
  }, [authHeaders]);

  const clearAll = useCallback(async () => {
    setNotifications([]);
    setActiveToasts([]);
    seenIds.current.clear();
    try {
      const response = await fetch('/api/notifications/clear-all', {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!response.ok) throw new Error(`Clear notifications failed (${response.status}).`);
    } catch (error) {
      console.warn('[Notifications] Could not clear notifications:', error);
    }
  }, [authHeaders]);

  const dismissToast = useCallback((id: string) => {
    setActiveToasts(prev => prev.filter(n => n.id !== id));
    // Mark as read when toast dismissed
    markAsRead(id);
  }, [markAsRead]);

  const updatePreferences = useCallback(async (partial: Partial<NotificationPreferences>) => {
    const updated = { ...preferences, ...partial };
    setPreferences(updated);
    try {
      const response = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          notificationsOn: updated.notificationsOn,
          soundsOn: updated.soundsOn,
          newOrderSound: updated.newOrderSound,
          deliverySound: updated.deliverySound,
          paymentSound: updated.paymentSound,
          inventorySound: updated.inventorySound,
          criticalSound: updated.criticalSound,
        }),
      });
      if (!response.ok) throw new Error(`Save notification preferences failed (${response.status}).`);
    } catch (error) {
      console.warn('[Notifications] Could not save preferences:', error);
    }
  }, [preferences, authHeaders]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return {
    notifications,
    unreadCount,
    preferences,
    audioEnabled,
    audioPromptDismissed,
    activeToasts,
    isConnected,
    enableAudio,
    dismissAudioPrompt,
    markAsRead,
    markAllRead,
    deleteNotification,
    clearAll,
    dismissToast,
    updatePreferences,
    refreshNotifications,
  };
}
