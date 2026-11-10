import express from 'express';
import { getPool } from '../db/mysql';
import { requireAuth, requireRole } from '../utils/authMiddleware';
import type { Branch } from '../types';
import { assertBranchExists } from '../utils/branchUtils';
import { notifyLowStock, notifyOutOfStock } from '../utils/notificationService';

const router = express.Router();

type ApiError = { error: string; details?: any };

function parseNumber(v: any, field: string): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) throw { error: `Invalid number for ${field}.` } as ApiError;
  return n;
}

function parseString(v: any, field: string): string {
  if (typeof v !== 'string' || v.trim().length === 0) {
    throw { error: `Missing or invalid ${field}.` } as ApiError;
  }
  return v.trim();
}

// Adjust stock (Admin/Staff only)
router.post('/adjust', requireAuth, requireRole(['admin']), async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();

  try {
    const body = req.body || {};
    const productId = parseString(body.productId, 'productId');
    const branch = body.branch as any;
    const validatedBranch = await assertBranchExists(branch);
    const newStock = parseNumber(body.newStock, 'newStock');
    const clampedStock = Math.max(0, Math.floor(newStock));
    await conn.beginTransaction();

    const [productRows]: any = await conn.query(
      `SELECT id, name, lowStockThreshold, overStockThreshold FROM products WHERE id = ? LIMIT 1 FOR UPDATE`,
      [productId]
    );

    if (!productRows || productRows.length === 0) {
      throw { error: `Product "${productId}" was not found.` } as ApiError;
    }

    let overStockLimit = Number(productRows[0].overStockThreshold) || 500;
    if (body.overStockThreshold !== undefined && body.overStockThreshold !== null && body.overStockThreshold !== '') {
      const parsedLimit = Math.max(1, parseNumber(body.overStockThreshold, 'overStockThreshold'));
      await conn.query(`UPDATE products SET overStockThreshold = ? WHERE id = ?`, [parsedLimit, productId]);
      overStockLimit = parsedLimit;
    }

    if (clampedStock > overStockLimit) {
      throw { error: `Bawal magdagdag ng stock. Ang "${productRows[0].name}" ay lalampas sa itinakdang Maximum Stock Limit na ${overStockLimit} (Kasalukuyang gusto: ${clampedStock}). Maaari munang i-adjust ang Stock Limit kung nais taasan ang kapasidad.` } as ApiError;
    }

    const [prevRows]: any = await conn.query(
      `SELECT stock FROM product_stock WHERE product_id = ? AND branch = ? FOR UPDATE`,
      [productId, validatedBranch]
    );

    const prevStock = prevRows && prevRows.length > 0 ? Number(prevRows[0].stock) || 0 : 0;
    const threshold = Number(productRows[0].lowStockThreshold) || 0;
    const productName = productRows[0].name || productId;

    await conn.query(
      `INSERT INTO product_stock (product_id, branch, stock)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE stock = VALUES(stock)`,
      [productId, validatedBranch, clampedStock]
    );

    await conn.commit();

    if (prevStock !== null && clampedStock === 0 && prevStock > 0) {
      notifyOutOfStock(productName, productId, validatedBranch).catch(() => {});
    } else if (threshold > 0 && clampedStock <= threshold && prevStock > threshold) {
      notifyLowStock(productName, productId, clampedStock, validatedBranch).catch(() => {});
    }

    res.json({ ok: true, productId, branch: validatedBranch, stock: clampedStock });
  } catch (e: any) {
    if (conn) {
      try { await conn.rollback(); } catch {}
    }
    res.status(e?.error ? 400 : 500).json({ ok: false, error: e?.message || String(e) });
  } finally {
    conn.release();
  }
});

export default router;
