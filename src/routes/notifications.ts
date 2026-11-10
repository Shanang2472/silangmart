/**
 * Notifications API — Role-scoped, authenticated endpoints
 * /api/notifications/*
 */
import express from 'express';
import { getPool } from '../db/mysql';
import { requireAuth, requireRole, AuthenticatedRequest } from '../utils/authMiddleware';

const router = express.Router();

// Helper to resolve the userId for the current user
function resolveUserId(req: AuthenticatedRequest): string {
  return ['customer', 'rider'].includes(req.user!.role)
    ? req.user!.name
    : req.user!.username;
}

// ─── GET /api/notifications ──────────────────────────────────────────────────
// Returns the current user's notifications (role-scoped)
router.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = resolveUserId(req);
    const role = req.user!.role;
    const pool = getPool();
    const limit = Math.min(Number(req.query.limit) || 100, 200);

    const [rows]: any = await pool.query(
      `SELECT id, user_id, role, type, category, title, message,
              entity_type, entity_id, action_url,
              is_read, read_at, created_at, updated_at
       FROM notifications
       WHERE user_id = ? AND role = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [userId, role, limit]
    );

    const notifications = (rows as any[]).map(mapRow);
    res.json({ ok: true, notifications });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// ─── GET /api/notifications/unread-count ─────────────────────────────────────
router.get('/unread-count', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = resolveUserId(req);
    const role = req.user!.role;
    const pool = getPool();
    const [rows]: any = await pool.query(
      `SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND role = ? AND is_read = 0`,
      [userId, role]
    );
    res.json({ ok: true, count: Number(rows[0]?.count) || 0 });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// ─── PATCH /api/notifications/:id/read ──────────────────────────────────────
router.patch('/:id/read', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = resolveUserId(req);
    const role = req.user!.role;
    const { id } = req.params;
    const pool = getPool();

    // Ensure ownership
    const [check]: any = await pool.query(
      `SELECT id FROM notifications WHERE id = ? AND user_id = ? AND role = ?`,
      [id, userId, role]
    );
    if (!check || check.length === 0) {
      return res.status(404).json({ ok: false, error: 'Notification not found.' });
    }

    const isRead = req.body.read !== false; // default to marking as read
    await pool.query(
      `UPDATE notifications SET is_read = ?, read_at = ? WHERE id = ?`,
      [isRead ? 1 : 0, isRead ? new Date() : null, id]
    );
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// ─── POST /api/notifications/mark-all-read ──────────────────────────────────
router.post('/mark-all-read', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = resolveUserId(req);
    const role = req.user!.role;
    const pool = getPool();
    await pool.query(
      `UPDATE notifications SET is_read = 1, read_at = NOW() WHERE user_id = ? AND role = ? AND is_read = 0`,
      [userId, role]
    );
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// ─── DELETE /api/notifications/:id ──────────────────────────────────────────
router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = resolveUserId(req);
    const role = req.user!.role;
    const { id } = req.params;
    const pool = getPool();

    // Only skip validation for clear-all route (handled separately)
    if (id === 'clear-all') {
      await pool.query(
        `DELETE FROM notifications WHERE user_id = ? AND role = ?`,
        [userId, role]
      );
      return res.json({ ok: true });
    }

    const [check]: any = await pool.query(
      `SELECT id FROM notifications WHERE id = ? AND user_id = ? AND role = ?`,
      [id, userId, role]
    );
    if (!check || check.length === 0) {
      return res.status(404).json({ ok: false, error: 'Notification not found.' });
    }
    await pool.query(`DELETE FROM notifications WHERE id = ?`, [id]);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// ─── DELETE /api/notifications/clear-all ────────────────────────────────────
router.delete('/clear-all', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = resolveUserId(req);
    const role = req.user!.role;
    const pool = getPool();
    await pool.query(
      `DELETE FROM notifications WHERE user_id = ? AND role = ?`,
      [userId, role]
    );
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// ─── GET /api/notifications/preferences ─────────────────────────────────────
router.get('/preferences', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = resolveUserId(req);
    const role = req.user!.role;
    const pool = getPool();
    const [rows]: any = await pool.query(
      `SELECT * FROM notification_preferences WHERE user_id = ? AND role = ? LIMIT 1`,
      [userId, role]
    );
    if (rows && rows.length > 0) {
      res.json({ ok: true, preferences: mapPrefs(rows[0]) });
    } else {
      // Return defaults
      res.json({ ok: true, preferences: defaultPrefs(userId, role) });
    }
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// ─── PUT /api/notifications/preferences ─────────────────────────────────────
router.put('/preferences', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = resolveUserId(req);
    const role = req.user!.role;
    const pool = getPool();
    const {
      notificationsOn = 1,
      soundsOn = 1,
      newOrderSound = 1,
      deliverySound = 1,
      paymentSound = 1,
      inventorySound = 1,
      criticalSound = 1,
    } = req.body;

    await pool.query(
      `INSERT INTO notification_preferences
         (user_id, role, notifications_on, sounds_on, new_order_sound, delivery_sound, payment_sound, inventory_sound, critical_sound)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         role = VALUES(role),
         notifications_on = VALUES(notifications_on),
         sounds_on = VALUES(sounds_on),
         new_order_sound = VALUES(new_order_sound),
         delivery_sound = VALUES(delivery_sound),
         payment_sound = VALUES(payment_sound),
         inventory_sound = VALUES(inventory_sound),
         critical_sound = VALUES(critical_sound),
         updated_at = NOW()`,
      [userId, role, notificationsOn ? 1 : 0, soundsOn ? 1 : 0,
       newOrderSound ? 1 : 0, deliverySound ? 1 : 0,
       paymentSound ? 1 : 0, inventorySound ? 1 : 0, criticalSound ? 1 : 0]
    );
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// ─── Legacy system_notifications routes (backward compat) ───────────────────
// These support the old admin-only inventory notification system

router.get('/system', requireAuth, requireRole(['admin']), async (_req, res) => {
  try {
    const pool = getPool();
    const [rows]: any = await pool.query('SELECT * FROM system_notifications ORDER BY created_at DESC LIMIT 100');
    const notifications = rows.map((row: any) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      message: row.message,
      timestamp: row.timestamp,
      product_id: row.product_id,
      branch: row.branch,
      read: Boolean(row.is_read)
    }));
    res.json(notifications);
  } catch (e: any) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

router.post('/system', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const { id, type, title, message, timestamp, productId, branch } = req.body;
    const pool = getPool();
    await pool.query(
      'INSERT INTO system_notifications (id, type, title, message, timestamp, product_id, branch, is_read) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, type, title, message, timestamp, productId || null, branch || null, false]
    );
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

router.patch('/system/:id/read', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { read } = req.body;
    const pool = getPool();
    await pool.query('UPDATE system_notifications SET is_read = ? WHERE id = ?', [read ? 1 : 0, id]);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

router.post('/system/mark-all-read', requireAuth, requireRole(['admin']), async (_req, res) => {
  try {
    const pool = getPool();
    await pool.query('UPDATE system_notifications SET is_read = 1');
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

router.delete('/system/clear-all', requireAuth, requireRole(['admin']), async (_req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM system_notifications');
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
function mapRow(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    role: row.role,
    type: row.type,
    category: row.category,
    title: row.title,
    message: row.message,
    entityType: row.entity_type,
    entityId: row.entity_id,
    actionUrl: row.action_url,
    isRead: Boolean(row.is_read),
    readAt: row.read_at ? String(row.read_at) : null,
    createdAt: row.created_at ? String(row.created_at) : new Date().toISOString(),
  };
}

function mapPrefs(row: any) {
  return {
    userId: row.user_id,
    role: row.role,
    notificationsOn: Boolean(row.notifications_on),
    soundsOn: Boolean(row.sounds_on),
    newOrderSound: Boolean(row.new_order_sound),
    deliverySound: Boolean(row.delivery_sound),
    paymentSound: Boolean(row.payment_sound),
    inventorySound: Boolean(row.inventory_sound),
    criticalSound: Boolean(row.critical_sound),
  };
}

function defaultPrefs(userId: string, role: string) {
  return {
    userId,
    role,
    notificationsOn: true,
    soundsOn: true,
    newOrderSound: true,
    deliverySound: true,
    paymentSound: true,
    inventorySound: true,
    criticalSound: true,
  };
}

export default router;
