import express from 'express';
import { getPool } from '../db/mysql';
import { generateToken } from '../utils/authHelper';
import { requireAuth, AuthenticatedRequest } from '../utils/authMiddleware';
import multer from 'multer';
import { storeImage } from '../utils/imageStorage';
import { hashPassword } from '../utils/passwordHash';


const router = express.Router();

function parseNumber(v: any, field: string): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) throw { error: `Invalid number for ${field}.` };
  return n;
}

function parseString(v: any, field: string): string {
  if (typeof v !== 'string' || v.trim().length === 0) {
    throw { error: `Missing or invalid ${field}.` };
  }
  return v.trim();
}

const storePicturesUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (_req: any, file: any, cb: (error: any, acceptFile: boolean) => void) => {
    const ok = file.mimetype.startsWith('image/');
    cb(ok ? null : new Error('Only image files are allowed'), ok);
  }
});

// List customers (Public - needed for login profiles dropdown)
router.get('/', async (_req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT id, name, phone, store_image, barangay, address, lat, lng, created_at
       FROM customers
       ORDER BY name ASC`
    );

    const customers = (rows as any[]).map((r) => ({
      id: Number(r.id),
      name: String(r.name),
      phone: String(r.phone),
      storeImage: r.store_image ? String(r.store_image) : null,
      barangay: String(r.barangay),
      address: String(r.address),
      coordinates: [Number(r.lat), Number(r.lng)] as [number, number],
    }));

    res.json({ ok: true, customers });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Register customer (Public signup)
router.post('/', async (req, res) => {
  try {
    const body = req.body || {};

    const name = parseString(body.name, 'name');
    const phone = parseString(body.phone, 'phone');
    const barangay = parseString(body.barangay, 'barangay');
    const address = parseString(body.address, 'address');

    const lat = parseNumber(body.lat, 'lat');
    const lng = parseNumber(body.lng, 'lng');
    const rawPassword = body.pin ? String(body.pin).trim() : '';
    const normalizedPassword = rawPassword.replace(/\s+/g, '');
    const storeImage = body.storeImage ? String(body.storeImage).trim() : null;

    if (normalizedPassword.length < 4) {
      return res.status(400).json({ ok: false, error: 'Password/PIN ay dapat hindi bababa sa 4 na characters.' });
    }

    // Normalize password/PIN: remove spaces (e.g., accidental multi-word input)
    const passwordCandidate = normalizedPassword;

    const passwordHashValue = await hashPassword(passwordCandidate);

    const pool = getPool();

    const [result] = await pool.query(
      `INSERT INTO customers (name, phone, pin, password_hash, store_image, barangay, address, lat, lng)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [name, phone, '', passwordHashValue, storeImage, barangay, address, lat, lng]
    );

    const customerId = (result as any).insertId;

    // Directly generate a login session token for new customer!
    const username = name.toLowerCase().split(' ')[0];
    const token = generateToken({ username, role: 'customer', name });

    res.json({
      ok: true,
      id: customerId,
      token,
      user: { username, role: 'customer', name }
    });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e?.message || String(e) });
  }
});

// Upload customer store picture (Public - so signup can upload store pictures too!)
router.post('/upload-store-image', requireAuth, storePicturesUpload.single('storeImage'), async (req: express.Request, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'No file uploaded.' });
    }
    const imageUrl = await storeImage(req.file, 'silang-mini-mart/store-pictures', 'store-pictures');
    // Update the authenticated customer's store_image column using name identifier
    const user = (req as any).user as any;
    if (user && user.name) {
      const pool = getPool();
      await pool.query('UPDATE customers SET store_image = ? WHERE name = ?', [imageUrl, user.name]);
    }
    res.json({ ok: true, imageUrl });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Update customer profile (restricted to customer role)
router.put('/profile', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    if (user.role !== 'customer') {
      return res.status(403).json({ ok: false, error: 'Only customers can update their profile.' });
    }

    const body = req.body || {};
    const phone = parseString(body.phone, 'phone');
    const barangay = parseString(body.barangay, 'barangay');
    const address = parseString(body.address, 'address');
    const lat = parseNumber(body.lat, 'lat');
    const lng = parseNumber(body.lng, 'lng');
    const storeImage = body.storeImage ? String(body.storeImage).trim() : null;
    const rawPassword = body.pin ? String(body.pin).trim() : null;
    const normalizedPassword = rawPassword ? rawPassword.replace(/\s+/g, '') : null;

    const pool = getPool();
    
    let updateQuery = `
      UPDATE customers 
      SET phone = ?, barangay = ?, address = ?, lat = ?, lng = ?, store_image = ?
    `;
    const params: any[] = [phone, barangay, address, lat, lng, storeImage];

    if (normalizedPassword && normalizedPassword.length >= 4) {
      updateQuery += `, pin = '', password_hash = ?`;
      params.push(await hashPassword(normalizedPassword));
    }

    updateQuery += ` WHERE name = ?`;
    params.push(user.name);

    await pool.query(updateQuery, params);

    res.json({ ok: true, message: 'Profile updated successfully!' });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e?.error || e?.message || String(e) });
  }
});

export default router;
