import express from 'express';
import { getPool } from '../db/mysql';
import { requireAuth, requireRole } from '../utils/authMiddleware';
import { assertBranchExists } from '../utils/branchUtils';

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

// GET all transactions (Admin/Staff only)
router.get('/transactions', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const branch = req.query.branch as any;
    const validatedBranch = branch ? await assertBranchExists(branch) : undefined;




    const pool = getPool();
    const queryStr = `
      SELECT id, txn_id, branch, subtotal, discountType, discountAmount, vat_amount, total, paymentMethod, amountPaid, change_amount, timestamp, cashier
      FROM orders_transactions
      ${validatedBranch ? 'WHERE branch = ?' : ''}
      ORDER BY timestamp DESC
    `;
    const [rows] = await pool.query(queryStr, validatedBranch ? [validatedBranch] : []);


    const transactions = (rows as any[]).map((r) => ({
      id: String(r.txn_id), // maps back to client `id`
      branch: r.branch,
      subtotal: Number(r.subtotal),
      discountType: r.discountType,
      discountAmount: Number(r.discountAmount),
      vatAmount: Number(r.vat_amount || 0),
      total: Number(r.total),
      paymentMethod: r.paymentMethod,
      amountPaid: Number(r.amountPaid),
      change: Number(r.change_amount), // mapped from db change_amount
      timestamp: String(r.timestamp),
      cashier: String(r.cashier),
      items: [],
    }));

    const pkIds = (rows as any[]).map((r) => Number(r.id));
    if (pkIds.length > 0) {
      const [itemRows] = await pool.query(
        `SELECT txn_pk, product_id, name, price, quantity, unit
         FROM orders_transaction_items
         WHERE txn_pk IN (?)`,
        [pkIds]
      );

      const grouped: any = {};
      (itemRows as any[]).forEach((ir) => {
        const pk = Number(ir.txn_pk);
        grouped[pk] = grouped[pk] || [];
        grouped[pk].push({
          productId: String(ir.product_id),
          name: String(ir.name),
          price: Number(ir.price),
          quantity: Number(ir.quantity),
          unit: String(ir.unit),
        });
      });

      const merged = transactions.map((t, index) => {
        const pk = pkIds[index];
        return { ...t, items: grouped[pk] || [] };
      });

      return res.json({ ok: true, transactions: merged });
    }

    res.json({ ok: true, transactions });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// POST checkout (Admin/Staff only)
router.post('/checkout', requireAuth, requireRole(['admin']), async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const body = req.body || {};

    const branch = await assertBranchExists(body.branch);

    const txnId = parseString(body.id, 'id');

    const cashier = parseString(body.cashier, 'cashier');

    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) {
      return res.status(400).json({ ok: false, error: 'items cannot be empty.' });
    }

    const discountType = body.discountType || 'none';
    const allowedDiscount: any = { none: true, senior: true, pwd: true, percentage: true };
    if (!allowedDiscount[discountType]) {
      return res.status(400).json({ ok: false, error: 'Invalid discountType.' });
    }

    const paymentMethod = body.paymentMethod;
    const allowedPayment: any = { Cash: true, GCash: true, Maya: true };
    if (!allowedPayment[paymentMethod]) {
      return res.status(400).json({ ok: false, error: 'Invalid paymentMethod.' });
    }

    const amountPaid = parseNumber(body.amountPaid, 'amountPaid');
    const timestamp = body.timestamp ? String(body.timestamp) : new Date().toISOString();

    // Start transaction
    await conn.beginTransaction();

    // Idempotency check: see if txnId already exists
    const [existingTxns]: any = await conn.query(
      `SELECT id FROM orders_transactions WHERE txn_id = ?`,
      [txnId]
    );
    if (existingTxns.length > 0) {
      await conn.rollback();
      return res.status(409).json({ ok: false, error: `Transaction ${txnId} already exists.` });
    }

    // Server-side authoritative validation & calculation
    const productIds = items.map((it: any) => it.productId);
    const [dbProducts]: any = await conn.query(
      `SELECT id, name, price, unit, authenticity_status, expiry_date < CURDATE() AS is_expired FROM products WHERE id IN (?)`,
      [productIds]
    );
    const productMap = new Map<string, any>(dbProducts.map((p: any) => [p.id, p]));

    const [dbVariants]: any = await conn.query(
      `SELECT product_id, price, unitName, qtyPerUnit FROM product_variants WHERE product_id IN (?)`,
      [productIds]
    );
    const variantMap = new Map<string, any>();
    dbVariants.forEach((v: any) => {
      const key = `${v.product_id}:${v.unitName}`;
      variantMap.set(key, v);
    });

    let computedSubtotal = 0;

    for (const it of items) {
      const dbProd = productMap.get(it.productId);
      if (!dbProd) {
        throw { error: `Hindi nahanap ang produkto: ${it.productId}` } as ApiError;
      }
      if (Boolean(dbProd.is_expired)) {
        throw { error: `Hindi maaaring ibenta ang expired na produkto: ${dbProd.name}.` } as ApiError;
      }
      if (dbProd.authenticity_status === 'rejected') {
        throw { error: `Hindi maaaring ibenta ang tinanggihang produkto: ${dbProd.name}.` } as ApiError;
      }

      let expectedPrice = 0;
      if (it.unit === dbProd.unit) {
        expectedPrice = Number(dbProd.price);
      } else {
        const variantKey = `${it.productId}:${it.unit}`;
        const dbVariant = variantMap.get(variantKey);
        if (!dbVariant) {
          throw { error: `Hindi wastong yunit (${it.unit}) para sa produktong ${dbProd.name}.` } as ApiError;
        }
        expectedPrice = Number(dbVariant.price);
      }

      computedSubtotal += expectedPrice * Number(it.quantity);
    }

    computedSubtotal = Math.round(computedSubtotal * 100) / 100;
    let computedDiscountAmount = 0;
    if (discountType === 'senior' || discountType === 'pwd') {
      computedDiscountAmount = Math.round(computedSubtotal * 0.20 * 100) / 100; // 20% discount
    } else if (discountType === 'percentage') {
      const clientDiscount = Number(body.discountAmount || 0);
      if (clientDiscount < 0 || clientDiscount > computedSubtotal) {
        throw { error: 'Hindi wastong discount amount.' } as ApiError;
      }
      computedDiscountAmount = Math.round(clientDiscount * 100) / 100;
    }

    const computedTotal = Math.max(0, Math.round((computedSubtotal - computedDiscountAmount) * 100) / 100);
    const computedVatAmount = Math.round(computedTotal * 12 / 112 * 100) / 100;

    if (amountPaid < computedTotal) {
      throw { error: `Kulang ang bayad! Total: ₱${computedTotal.toFixed(2)}, Binayad: ₱${amountPaid.toFixed(2)}` } as ApiError;
    }

    const computedChange = Math.round((amountPaid - computedTotal) * 100) / 100;

    // Insert transaction header
    const [headerResult] = await conn.query(
      `INSERT INTO orders_transactions 
        (txn_id, branch, subtotal, discountType, discountAmount, vat_amount, total, paymentMethod, amountPaid, change_amount, timestamp, cashier)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        txnId,
        branch,
        computedSubtotal,
        discountType,
        computedDiscountAmount,
        computedVatAmount,
        computedTotal,
        paymentMethod,
        amountPaid,
        computedChange,
        timestamp.replace('T', ' ').slice(0, 19), // formats to SQL timestamp
        cashier,
      ]
    );

    const insertedPk = (headerResult as any).insertId;

    // Insert items & decrement stocks using row locks
    for (const it of items) {
      const productId = it.productId;
      const quantity = Number(it.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw { error: 'Wastong bilang (positive integer) ang kailangan para sa dami.' } as ApiError;
      }

      const dbProd = productMap.get(productId);
      const variantKey = `${productId}:${it.unit}`;
      const dbVariant = variantMap.get(variantKey);
      const qtyMultiplier = (it.unit && dbProd && it.unit !== dbProd.unit && dbVariant) ? Number(dbVariant.qtyPerUnit || 1) : 1;
      const effectiveStockNeeded = quantity * qtyMultiplier;

      // SELECT FOR UPDATE to lock the row
      const [stockRows]: any = await conn.query(
        `SELECT stock FROM product_stock WHERE product_id = ? AND branch = ? FOR UPDATE`,
        [productId, branch]
      );

      const currentStock = stockRows?.[0]?.stock;
      if (currentStock === undefined) {
        throw { error: `Walang stock record para sa produktong ${productId} sa ${branch} branch.` } as ApiError;
      }

      if (Number(currentStock) < effectiveStockNeeded) {
        throw { error: `Kulang ang stock para sa item "${it.name}". Mayroon na lamang ${currentStock} piraso (kailangan: ${effectiveStockNeeded}).` } as ApiError;
      }

      // Insert transaction item
      await conn.query(
        `INSERT INTO orders_transaction_items (txn_pk, product_id, name, price, quantity, unit)
         VALUES (?,?,?,?,?,?)`,
        [
          insertedPk,
          productId,
          it.name,
          it.price,
          quantity,
          it.unit || 'pc'
        ]
      );

      // Decrement stock using effectiveStockNeeded (quantity * multiplier)
      await conn.query(
        `UPDATE product_stock SET stock = stock - ? WHERE product_id = ? AND branch = ?`,
        [effectiveStockNeeded, productId, branch]
      );
    }

    await conn.commit();
    res.json({
      ok: true,
      txnId,
      subtotal: computedSubtotal,
      discountAmount: computedDiscountAmount,
      vatAmount: computedVatAmount,
      total: computedTotal,
      change: computedChange,
    });
  } catch (e: any) {
    await conn.rollback();
    res.status(e?.error ? 400 : 500).json({ ok: false, error: e?.error || e?.message || String(e) });
  } finally {
    conn.release();
  }
});

export default router;
