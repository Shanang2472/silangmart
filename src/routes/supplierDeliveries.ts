import express from 'express';
import { getPool } from '../db/mysql';
import { requireAuth, requireRole } from '../utils/authMiddleware';
import type { Branch } from '../types';

const router = express.Router();

type ApiError = { error: string; details?: any };

import { assertBranchExists } from '../utils/branchUtils';

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

// GET supplier deliveries (admins see all; suppliers can only see their own deliveries)
router.get('/', requireAuth, requireRole(['admin', 'supplier']), async (req: any, res) => {
  try {
    const branch = req.query.branch as any;
    if (branch) await assertBranchExists(branch);

    const pool = getPool();
    const filters: string[] = [];
    const params: any[] = [];
    if (branch) { filters.push('branch = ?'); params.push(branch); }
    if (req.user.role === 'supplier') { filters.push('supplier_name = ?'); params.push(req.user.name); }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const [rows] = await pool.query(
      `SELECT * FROM supplier_deliveries ${where} ORDER BY delivery_date DESC`, params
    );

    const deliveries = (rows as any[]).map((r) => ({
      id: String(r.supplier_delivery_id),
      supplierName: String(r.supplier_name),
      branch: r.branch,
      deliveryDate: String(r.delivery_date),
      totalCost: Number(r.total_cost),
      status: r.status,
      receivedBy: r.received_by ? String(r.received_by) : undefined,
      items: [],
    }));

    const pkIds = (rows as any[]).map((r) => Number(r.id));
    if (pkIds.length > 0) {
      const [itemRows] = await pool.query(
        `SELECT supplier_delivery_pk, product_id, product_name, quantity, cost
         FROM supplier_delivery_items
         WHERE supplier_delivery_pk IN (?)`,
        [pkIds]
      );

      const grouped: any = {};
      (itemRows as any[]).forEach((ir) => {
        const pk = Number(ir.supplier_delivery_pk);
        grouped[pk] = grouped[pk] || [];
        grouped[pk].push({
          productId: String(ir.product_id),
          productName: String(ir.product_name),
          quantity: Number(ir.quantity),
          cost: Number(ir.cost),
        });
      });

      const merged = deliveries.map((d, index) => {
        const pk = pkIds[index];
        return { ...d, items: grouped[pk] || [] };
      });

      return res.json({ ok: true, supplierDeliveries: merged });
    }

    res.json({ ok: true, supplierDeliveries: deliveries });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// POST supplier deliveries (admin or the authenticated supplier)
router.post('/', requireAuth, requireRole(['admin', 'supplier']), async (req: any, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const body = req.body || {};

    const supplierName = req.user.role === 'supplier'
      ? req.user.name
      : parseString(body.supplierName, 'supplierName');
    const branch = body.branch as any;
    await assertBranchExists(branch);

    const deliveryDate = parseString(body.deliveryDate, 'deliveryDate'); // YYYY-MM-DD expected
    const status = req.user.role === 'supplier'
      ? 'Pending'
      : (body.status === 'Received' ? 'Received' : 'Pending');
    const receivedBy = req.user.role === 'supplier'
      ? null
      : (body.receivedBy ? parseString(body.receivedBy, 'receivedBy') : null);
    const totalCost = parseNumber(body.totalCost, 'totalCost');

    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) return res.status(400).json({ ok: false, error: 'items cannot be empty.' });

    const supplierDeliveryId = body.id || `SD-${Date.now().toString().slice(-6)}`;

    await conn.beginTransaction();

    await conn.query(
      `INSERT INTO supplier_deliveries
        (supplier_delivery_id, supplier_name, branch, delivery_date, total_cost, status, received_by)
       VALUES (?,?,?,?,?,?,?)`,
      [supplierDeliveryId, supplierName, branch, deliveryDate, totalCost, status, receivedBy]
    );

    const [spRows]: any = await conn.query(
      `SELECT id FROM supplier_deliveries WHERE supplier_delivery_id = ?`,
      [supplierDeliveryId]
    );
    const spPk = spRows?.[0]?.id;

    for (const it of items) {
      const productId = parseString(it.productId, 'items[].productId');
      const productName = parseString(it.productName, 'items[].productName');
      const quantity = parseNumber(it.quantity, 'items[].quantity');
      const cost = parseNumber(it.cost, 'items[].cost');
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw { error: 'items[].quantity must be a positive integer.' } as ApiError;
      }

      await conn.query(
        `INSERT INTO supplier_delivery_items
          (supplier_delivery_pk, product_id, product_name, quantity, cost)
         VALUES (?,?,?,?,?)`,
        [spPk, productId, productName, quantity, cost]
      );

      // Increment stock if the delivery status is 'Received'
      if (status === 'Received') {
        await conn.query(
          `INSERT INTO product_stock (product_id, branch, stock)
           VALUES (?,?,?)
           ON DUPLICATE KEY UPDATE stock = stock + VALUES(stock)`,
          [productId, branch, quantity]
        );
      }
    }

    await conn.commit();
    res.json({ ok: true, supplierDeliveryId });
  } catch (e: any) {
    await conn.rollback();
    res.status(e?.error ? 400 : 500).json({ ok: false, error: e?.error || e?.message || String(e) });
  } finally {
    conn.release();
  }
});

// Receive a pending delivery and update product stock atomically.
router.patch('/:id/receive', requireAuth, requireRole(['admin']), async (req: any, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows]: any = await conn.query(
      `SELECT id, supplier_delivery_id, branch, status FROM supplier_deliveries WHERE supplier_delivery_id = ? FOR UPDATE`,
      [String(req.params.id)]
    );
    if (!rows.length) return res.status(404).json({ ok: false, error: 'Supplier delivery not found.' });
    const delivery = rows[0];
    if (delivery.status === 'Received') return res.status(400).json({ ok: false, error: 'This delivery has already been received.' });

    const [items]: any = await conn.query(
      'SELECT product_id, quantity FROM supplier_delivery_items WHERE supplier_delivery_pk = ?', [delivery.id]
    );
    for (const item of items) {
      await conn.query(
        `INSERT INTO product_stock (product_id, branch, stock) VALUES (?,?,?)
         ON DUPLICATE KEY UPDATE stock = stock + VALUES(stock)`,
        [item.product_id, delivery.branch, Number(item.quantity)]
      );
    }
    await conn.query(
      `UPDATE supplier_deliveries SET status = 'Received', received_by = ? WHERE id = ?`,
      [req.user.name, delivery.id]
    );
    await conn.commit();
    res.json({ ok: true, supplierDeliveryId: delivery.supplier_delivery_id });
  } catch (e: any) {
    await conn.rollback();
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  } finally {
    conn.release();
  }
});

export default router;
