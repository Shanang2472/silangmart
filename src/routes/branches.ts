import express from 'express';
import { getPool } from '../db/mysql';

const router = express.Router();

// Tables that reference branch by name
const BRANCH_REFERENCE_TABLES = [
  { table: 'product_stock', label: 'Stock Records' },
  { table: 'orders_transactions', label: 'POS Transactions' },
  { table: 'deliveries', label: 'Deliveries' },
  { table: 'supplier_deliveries', label: 'Supplier Deliveries' },
  { table: 'service_transactions', label: 'Service Transactions' },
];

// GET /api/branches — list all branches with usage counts
router.get('/', async (_req, res) => {
  try {
    const pool = getPool();
    const [branches]: any = await pool.query(
      'SELECT id, name, address, lat, lng, is_active FROM branches ORDER BY created_at ASC'
    );

    // Enrich each branch with the total count of linked records across all tables
    const enriched = await Promise.all(
      branches.map(async (branch: any) => {
        let totalRecords = 0;
        const breakdown: Record<string, number> = {};

        for (const { table, label } of BRANCH_REFERENCE_TABLES) {
          try {
            const [countRows]: any = await pool.query(
              `SELECT COUNT(*) as cnt FROM ${table} WHERE branch = ?`,
              [branch.name]
            );
            const cnt = countRows[0]?.cnt ?? 0;
            totalRecords += cnt;
            breakdown[label] = cnt;
          } catch {
            breakdown[label] = 0;
          }
        }

        return {
          ...branch,
          is_active: Boolean(branch.is_active),
          totalRecords,
          breakdown,
        };
      })
    );

    res.json({ branches: enriched });
  } catch (e: any) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

// POST /api/branches — create a new branch
router.post('/', async (req, res) => {
  try {
    const { name, address = '', lat = 0, lng = 0 } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Branch name is required.' });
    }

    const trimmedName = name.trim();
    const pool = getPool();

    // Check for duplicate
    const [existing]: any = await pool.query(
      'SELECT id FROM branches WHERE name = ?',
      [trimmedName]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: `Branch "${trimmedName}" already exists.` });
    }

    const [result]: any = await pool.query(
      'INSERT INTO branches (name, address, lat, lng) VALUES (?, ?, ?, ?)',
      [trimmedName, address, Number(lat) || 0, Number(lng) || 0]
    );

    res.json({ ok: true, id: result.insertId, name: trimmedName });
  } catch (e: any) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

// PUT /api/branches/:id — update a branch (name, address, lat, lng, is_active)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address, lat, lng, is_active } = req.body;
    const pool = getPool();

    // Fetch existing
    const [existing]: any = await pool.query('SELECT * FROM branches WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Branch not found.' });
    }

    const oldName = existing[0].name;
    const newName = (name || oldName).trim();

    // Check duplicate name if renaming
    if (newName !== oldName) {
      const [dup]: any = await pool.query(
        'SELECT id FROM branches WHERE name = ? AND id != ?',
        [newName, id]
      );
      if (dup.length > 0) {
        return res.status(409).json({ error: `Branch name "${newName}" is already taken.` });
      }

      // Update all tables that reference the old name
      for (const { table } of BRANCH_REFERENCE_TABLES) {
        try {
          await pool.query(`UPDATE ${table} SET branch = ? WHERE branch = ?`, [newName, oldName]);
        } catch {
          // table might not have rows — ignore
        }
      }
    }

    await pool.query(
      'UPDATE branches SET name = ?, address = ?, lat = ?, lng = ?, is_active = ? WHERE id = ?',
      [
        newName,
        address ?? existing[0].address,
        lat !== undefined ? Number(lat) : existing[0].lat,
        lng !== undefined ? Number(lng) : existing[0].lng,
        is_active !== undefined ? (is_active ? 1 : 0) : existing[0].is_active,
        id,
      ]
    );

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

// DELETE /api/branches/:id — delete a branch (blocked if linked records exist)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    const [existing]: any = await pool.query('SELECT * FROM branches WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Branch not found.' });
    }

    const branchName = existing[0].name;

    // Check all linked tables for any records
    const blockers: string[] = [];
    for (const { table, label } of BRANCH_REFERENCE_TABLES) {
      try {
        const [countRows]: any = await pool.query(
          `SELECT COUNT(*) as cnt FROM ${table} WHERE branch = ?`,
          [branchName]
        );
        const cnt = countRows[0]?.cnt ?? 0;
        if (cnt > 0) {
          blockers.push(`${label} (${cnt})`);
        }
      } catch {
        // table doesn't exist yet — skip
      }
    }

    if (blockers.length > 0) {
      return res.status(409).json({
        error: `Cannot delete branch "${branchName}" — it has linked records that must be removed or reassigned first.`,
        blockers,
      });
    }

    await pool.query('DELETE FROM branches WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

export default router;
