import express from 'express';
import authRouter from './auth';
import productsRouter from './products';
import customersRouter from './customers';
import posRouter from './pos';
import inventoryRouter from './inventory';
import deliveriesRouter from './deliveries';
import servicesRouter from './services';
import supplierDeliveriesRouter from './supplierDeliveries';
import settingsRouter from './settings';
import notificationsRouter from './notifications';
import branchesRouter from './branches';
import usersRouter from './users';
import { getPool } from '../db/mysql';

const router = express.Router();

// Mount sub-routers
router.use('/auth', authRouter);
router.use('/products', productsRouter);
router.use('/customers', customersRouter);
router.use('/pos', posRouter);
router.use('/inventory', inventoryRouter);
router.use('/deliveries', deliveriesRouter);
router.use('/services', servicesRouter);
router.use('/supplier-deliveries', supplierDeliveriesRouter);
router.use('/settings', settingsRouter);
router.use('/notifications', notificationsRouter);
router.use('/branches', branchesRouter);
router.use('/users', usersRouter);

// Health check endpoint
router.get('/health', async (_req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT 1 AS ok');
    res.json({ ok: true, rows });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

export default router;
