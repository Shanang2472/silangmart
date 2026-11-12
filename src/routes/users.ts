import express from 'express';
import { getPool } from '../db/mysql';
import { requireAuth, requireRole, AuthenticatedRequest } from '../utils/authMiddleware';
import { hashPassword } from '../utils/passwordHash';

const router = express.Router();

// GET /api/users/staff — Public: returns active admin & cashier users (no passwords)
// Used by the sidebar staff dropdown in the admin dashboard
router.get('/staff', async (_req, res) => {
  try {
    const pool = getPool();
    const [rows]: any = await pool.query(
      `SELECT id, name, role FROM users WHERE role IN ('admin', 'cashier', 'rider') AND status = 'active' ORDER BY name ASC`
    );
    res.json({ staff: rows });
  } catch (e: any) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

// List all staff and riders (only for admin)
router.get('/', requireAuth, requireRole(['admin']), async (_req, res) => {
  try {
    const pool = getPool();
    const [rows]: any = await pool.query(
      'SELECT id, name, username, role, status, created_at FROM users ORDER BY role ASC, name ASC'
    );
    res.json({ ok: true, users: rows });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message || String(e) });
  }
});

// Register new cashier/admin/rider user
router.post('/', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const { name, username, password, role } = req.body;

    if (!name || !username || !password || !role) {
      return res.status(400).json({ ok: false, error: 'Missing required fields (name, username, password, role).' });
    }

    const trimmedName = name.toString().trim();
    const trimmedUsername = username.toString().trim().toLowerCase();
    const trimmedPassword = password.toString().trim();

    if (trimmedName.length < 2) {
      return res.status(400).json({ ok: false, error: 'Name must be at least 2 characters long.' });
    }
    if (trimmedUsername.length < 3) {
      return res.status(400).json({ ok: false, error: 'Username must be at least 3 characters long.' });
    }
    if (trimmedPassword.length < 4) {
      return res.status(400).json({ ok: false, error: 'Password must be at least 4 characters long.' });
    }

    if (!['admin', 'cashier', 'rider'].includes(role)) {
      return res.status(400).json({ ok: false, error: 'Invalid role. Must be admin, cashier, or rider.' });
    }

    const pool = getPool();

    // Check if username is taken in users table
    const [existing]: any = await pool.query('SELECT id FROM users WHERE username = ?', [trimmedUsername]);
    if (existing.length > 0) {
      return res.status(400).json({ ok: false, error: 'Username is already taken.' });
    }

    // Check if username is taken in customers table (to avoid confusion)
    const [existingCustomer]: any = await pool.query('SELECT id FROM customers WHERE name = ?', [trimmedName]);
    if (existingCustomer.length > 0) {
      return res.status(400).json({ ok: false, error: 'Name is already used by a registered customer.' });
    }

    const [result]: any = await pool.query(
      'INSERT INTO users (name, username, password, role, status) VALUES (?, ?, ?, ?, "active")',
      [trimmedName, trimmedUsername, await hashPassword(trimmedPassword), role]
    );

    res.json({ ok: true, id: result.insertId, message: 'User registered successfully!' });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message || String(e) });
  }
});

// Delete a user
router.delete('/:id', requireAuth, requireRole(['admin']), async (req: AuthenticatedRequest, res) => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isFinite(userId)) {
      return res.status(400).json({ ok: false, error: 'Invalid user ID.' });
    }

    const pool = getPool();

    // Retrieve user details
    const [rows]: any = await pool.query('SELECT username FROM users WHERE id = ?', [userId]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'User not found.' });
    }

    const userToDelete = rows[0];

    // Safety checks
    if (userToDelete.username === 'admin') {
      return res.status(400).json({ ok: false, error: 'Cannot delete the default admin account.' });
    }

    if (userToDelete.username === req.user?.username) {
      return res.status(400).json({ ok: false, error: 'Cannot delete your own active session account.' });
    }

    await pool.query('DELETE FROM users WHERE id = ?', [userId]);
    res.json({ ok: true, message: 'User deleted successfully!' });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message || String(e) });
  }
});

export default router;
