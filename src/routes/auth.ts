import express from 'express';
import { getPool } from '../db/mysql';
import { generateToken, verifyToken } from '../utils/authHelper';
import { hashPassword, isScryptHash, verifyPassword } from '../utils/passwordHash';

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { role, name, password } = req.body;

    if (!role || !name) {
      return res.status(400).json({ error: 'Missing required credentials (role and name).' });
    }

    const trimmedName = name.toString().trim();
    const pin = (password ?? '').toString().trim();

    const pool = getPool();

    if (role === 'admin' || role === 'cashier') {
      const [rows]: any = await pool.query(
        `SELECT username, name, password, role FROM users WHERE (username = ? OR name = ?) AND (role = 'admin' OR role = 'cashier') AND status = 'active'`,
        [trimmedName, trimmedName]
      );

      if (rows.length === 0) {
        return res.status(401).json({ error: 'Maling Staff Username o Inactive!' });
      }

      const user = rows[0];
      if (!await verifyPassword(pin, user.password)) {
        return res.status(401).json({ error: 'Maling password para sa Staff!' });
      }
      if (!isScryptHash(user.password)) {
        const passwordHash = await hashPassword(pin);
        await pool.query('UPDATE users SET password = ? WHERE username = ? AND password = ?', [
          passwordHash,
          user.username,
          user.password,
        ]);
      }

      const username = user.username;
      const actualName = user.name;
      const actualRole = user.role; // 'admin' or 'cashier'
      // Token always carries 'admin' internally so both admin/cashier pass requireRole(['admin']) middleware
      const token = generateToken({ username, role: 'admin', name: actualName });
      return res.json({ ok: true, token, user: { username, role: actualRole, name: actualName } });
    }

    if (role === 'customer') {
      const normalizedName = trimmedName.replace(/\s+/g, ' ');
      const [rows]: any = await pool.query(
        'SELECT name, pin, password_hash FROM customers WHERE LOWER(TRIM(name)) = LOWER(?)',
        [normalizedName]
      );

      if (rows.length === 0) {
        return res.status(401).json({ error: 'Hindi mahanap ang customer profile!' });
      }

      const customer = rows[0];

      // Normalize login PIN/Password (strip all spaces)
      const normalizedPin = pin.replace(/\s+/g, '');

      const pinMatch = Boolean(customer.pin) && await verifyPassword(normalizedPin, customer.pin);
      const hashMatch = Boolean(customer.password_hash) && await verifyPassword(normalizedPin, customer.password_hash);

      if (!pinMatch && !hashMatch) {
        return res.status(401).json({ error: 'Maling PIN o Password para sa Customer!' });
      }
      if (pinMatch && !isScryptHash(customer.pin)) {
        const passwordHash = await hashPassword(normalizedPin);
        await pool.query('UPDATE customers SET pin = ? WHERE name = ? AND pin = ?', [
          passwordHash,
          customer.name,
          customer.pin,
        ]);
      }
      if (hashMatch && !isScryptHash(customer.password_hash)) {
        const passwordHash = await hashPassword(normalizedPin);
        await pool.query('UPDATE customers SET password_hash = ? WHERE name = ? AND password_hash = ?', [
          passwordHash,
          customer.name,
          customer.password_hash,
        ]);
      }

      const username = customer.name.toLowerCase().split(' ')[0];
      const token = generateToken({ username, role: 'customer', name: customer.name });
      return res.json({ ok: true, token, user: { username, role, name: customer.name } });
    }

    if (role === 'supplier') {
      const [rows]: any = await pool.query(
        `SELECT username, name, password FROM users WHERE (username = ? OR name = ?) AND role = 'supplier' AND status = 'active'`,
        [trimmedName, trimmedName]
      );
      if (rows.length === 0) return res.status(401).json({ error: 'Hindi mahanap ang Supplier account!' });
      const user = rows[0];
      if (!await verifyPassword(pin, user.password)) return res.status(401).json({ error: 'Maling PIN para sa Supplier!' });
      if (!isScryptHash(user.password)) {
        const passwordHash = await hashPassword(pin);
        await pool.query('UPDATE users SET password = ? WHERE username = ? AND password = ?', [
          passwordHash,
          user.username,
          user.password,
        ]);
      }
      const token = generateToken({ username: user.username, role: 'supplier', name: user.name });
      return res.json({ ok: true, token, user: { username: user.username, role: 'supplier', name: user.name } });
    }

    if (role === 'rider') {
      const [rows]: any = await pool.query(
        `SELECT username, name, password FROM users WHERE (username = ? OR name = ?) AND role = 'rider' AND status = 'active'`,
        [trimmedName, trimmedName]
      );

      if (rows.length === 0) {
        return res.status(401).json({ error: 'Hindi mahanap ang Rider account!' });
      }

      const user = rows[0];
      if (!await verifyPassword(pin, user.password)) {
        return res.status(401).json({ error: 'Maling PIN para sa Delivery Rider!' });
      }
      if (!isScryptHash(user.password)) {
        const passwordHash = await hashPassword(pin);
        await pool.query('UPDATE users SET password = ? WHERE username = ? AND password = ?', [
          passwordHash,
          user.username,
          user.password,
        ]);
      }

      const username = user.username;
      const actualName = user.name;
      const token = generateToken({ username, role: 'rider', name: actualName });
      return res.json({ ok: true, token, user: { username, role, name: actualName } });
    }

    return res.status(400).json({ error: 'Invalid role.' });
  } catch (e: any) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

/**
 * POST /api/auth/verify
 * Validates the current JWT token server-side and returns the confirmed user.
 * Called by the frontend on startup to ensure the cached session is still valid.
 * Also checks the user still exists and is active in the database.
 */
router.post('/verify', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ ok: false, error: 'No token provided.' });
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    if (!payload) {
      return res.status(401).json({ ok: false, error: 'Token is invalid or expired. Please log in again.' });
    }

    const pool = getPool();

    // For admin/cashier tokens (token role is always 'admin' internally)
    if (payload.role === 'admin') {
      const [rows]: any = await pool.query(
        `SELECT username, name, role, status FROM users WHERE username = ? AND status = 'active'`,
        [payload.username]
      );
      if (rows.length === 0) {
        return res.status(401).json({ ok: false, error: 'Account not found or has been deactivated.' });
      }
      const user = rows[0];
      return res.json({ ok: true, user: { username: user.username, role: user.role, name: user.name } });
    }

    // For supplier tokens
    if (payload.role === 'supplier') {
      const [rows]: any = await pool.query(
        `SELECT username, name, role, status FROM users WHERE username = ? AND role = 'supplier' AND status = 'active'`,
        [payload.username]
      );
      if (rows.length === 0) return res.status(401).json({ ok: false, error: 'Supplier account not found or deactivated.' });
      const user = rows[0];
      return res.json({ ok: true, user: { username: user.username, role: 'supplier', name: user.name } });
    }

    // For rider tokens
    if (payload.role === 'rider') {
      const [rows]: any = await pool.query(
        `SELECT username, name, role, status FROM users WHERE username = ? AND role = 'rider' AND status = 'active'`,
        [payload.username]
      );
      if (rows.length === 0) {
        return res.status(401).json({ ok: false, error: 'Rider account not found or deactivated.' });
      }
      const user = rows[0];
      return res.json({ ok: true, user: { username: user.username, role: 'rider', name: user.name } });
    }

    // For customer tokens
    if (payload.role === 'customer') {
      const [rows]: any = await pool.query(
        'SELECT name FROM customers WHERE LOWER(TRIM(name)) = LOWER(?)',
        [payload.name]
      );
      if (rows.length === 0) {
        return res.status(401).json({ ok: false, error: 'Customer account not found.' });
      }
      return res.json({
        ok: true,
        user: { username: payload.username, role: 'customer', name: rows[0].name }
      });
    }

    return res.status(400).json({ ok: false, error: 'Invalid role in token.' });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message || String(e) });
  }
});

export default router;
