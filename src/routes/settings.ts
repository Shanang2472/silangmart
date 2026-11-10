import express from 'express';
import { getPool } from '../db/mysql';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [rows]: any = await pool.query('SELECT setting_key, setting_value FROM system_settings');
    const settings: Record<string, any> = {};
    for (const row of rows) {
      settings[row.setting_key] = row.setting_value;
    }
    res.json(settings);
  } catch (e: any) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

router.put('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const value = req.body;
    const pool = getPool();
    
    await pool.query(
      'INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
      [key, JSON.stringify(value)]
    );
    
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

export default router;
