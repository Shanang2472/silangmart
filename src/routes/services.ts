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

// GET services (Admin/Staff only)
router.get('/', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const branch = req.query.branch as any;
    if (branch) await assertBranchExists(branch);

    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT * FROM service_transactions ${branch ? 'WHERE branch = ?' : ''} ORDER BY timestamp DESC`,
      branch ? [branch] : []
    );

    const services = (rows as any[]).map((r) => ({
      id: String(r.id),
      branch: r.branch,
      type: r.type,
      provider: String(r.provider),
      recipient: String(r.recipient),
      senderOrAccountName: String(r.sender_or_account_name),
      amount: Number(r.amount),
      serviceFee: Number(r.service_fee),
      totalAmount: Number(r.total_amount),
      status: r.status,
      timestamp: String(r.timestamp),
    }));

    res.json({ ok: true, services });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// POST services (Admin/Staff only)
router.post('/', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const body = req.body || {};
    const branch = body.branch as any;
    await assertBranchExists(branch);

    const type = parseString(body.type, 'type');
    const allowed = new Set(['E-Load', 'Bills Payment', 'Remittance']);
    if (!allowed.has(type)) return res.status(400).json({ ok: false, error: 'Invalid service type.' });

    const provider = parseString(body.provider, 'provider');
    const recipient = parseString(body.recipient, 'recipient');
    const senderOrAccountName = parseString(body.senderOrAccountName, 'senderOrAccountName');

    const amount = parseNumber(body.amount, 'amount');
    const serviceFee = parseNumber(body.serviceFee, 'serviceFee');
    const totalAmount = parseNumber(body.totalAmount, 'totalAmount');

    const status = body.status === 'Failed' ? 'Failed' : (body.status === 'Pending' ? 'Pending' : 'Completed');
    const timestamp = body.timestamp ? String(body.timestamp) : new Date().toISOString();

    const pool = getPool();
    const serviceTxnId = `SV-${Date.now().toString().slice(-6)}`;

    await pool.query(
      `INSERT INTO service_transactions
        (service_txn_id, branch, type, provider, recipient, sender_or_account_name, amount, service_fee, total_amount, status, timestamp)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        serviceTxnId,
        branch,
        type,
        provider,
        recipient,
        senderOrAccountName,
        amount,
        serviceFee,
        totalAmount,
        status,
        timestamp.replace('T', ' ').slice(0, 19)
      ]
    );

    res.json({ ok: true, serviceTxnId });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e?.error || e?.message || String(e) });
  }
});

export default router;
