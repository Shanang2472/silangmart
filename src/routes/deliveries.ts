import express from 'express';
import multer from 'multer';
import { getPool } from '../db/mysql';
import { requireAuth, requireRole, AuthenticatedRequest } from '../utils/authMiddleware';
import { assertBranchExists } from '../utils/branchUtils';
import {
  notifyOrderCreated,
  notifyOrderStatusChange,
  notifyRiderAssigned,
  notifyPaymentReceived,
  notifyAllAdmins,
  notifyLowStock,
  notifyOutOfStock,
} from '../utils/notificationService';
import { storeImage } from '../utils/imageStorage';

const podUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, WEBP, or GIF images are allowed for POD.'));
  },
});

const paymentProofUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, or WEBP images are allowed for GCash payment proof.'));
  },
});

const router = express.Router();

const parsePaymentProofUpload: express.RequestHandler = (req, res, next) => {
  paymentProofUpload.single('paymentProof')(req, res, (error) => {
    if (error) {
      return res.status(400).json({ ok: false, error: error.message || 'Invalid payment proof upload.' });
    }
    next();
  });
};

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

// GET deliveries (Authenticated)
router.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const branch = req.query.branch as any;
    const validatedBranch = branch ? await assertBranchExists(branch) : undefined;

    const user = req.user!;
    const pool = getPool();

    let queryStr = `SELECT * FROM deliveries`;
    const params: any[] = [];
    const conditions: string[] = [];

    if (validatedBranch) {
      conditions.push(`branch = ?`);
      params.push(validatedBranch);
    }

    // Role-based security boundary
    if (user.role === 'customer') {
      conditions.push(`customer_name = ?`);
      params.push(user.name);
    }

    if (conditions.length > 0) {
      queryStr += ` WHERE ` + conditions.join(' AND ');
    }

    queryStr += ` ORDER BY timestamp DESC`;

    const [rows] = await pool.query(queryStr, params);

    const deliveries = (rows as any[]).map((r) => ({
      id: String(r.id),
      deliveryId: String(r.delivery_id),
      branch: r.branch,
      customerName: String(r.customer_name),
      customerPhone: String(r.customer_phone),
      address: String(r.address),
      barangay: String(r.barangay),
      coordinates: [Number(r.lat), Number(r.lng)] as [number, number],
      status: r.delivery_status ?? r.status,
      deliveryStatus: r.delivery_status ?? r.status,
      paymentMethod: r.payment_method ?? 'Cash',
      paymentStatus: r.payment_status ?? 'Pending',

      paymentReference: r.payment_reference,
      paymentAmount: r.payment_amount != null ? Number(r.payment_amount) : null,
      paymentProofUrl: r.payment_proof_url ? String(r.payment_proof_url) : null,
      paidAt: r.paid_at ? String(r.paid_at) : null,

      items: [],
      deliveryFee: Number(r.delivery_fee),
      totalAmount: Number(r.total_amount),
      driverName: String(r.driver_name),
      driverCoordinates: [
        isFinite(Number(r.driver_lat)) && r.driver_lat != null ? Number(r.driver_lat) : Number(r.lat),
        isFinite(Number(r.driver_lng)) && r.driver_lng != null ? Number(r.driver_lng) : Number(r.lng),
      ] as [number, number],
      driverLocationUpdatedAt: r.driver_location_updated_at
        ? new Date(r.driver_location_updated_at).toISOString()
        : null,
      driverLocationAccuracyMeters: r.driver_location_accuracy_m != null
        ? Number(r.driver_location_accuracy_m)
        : null,
      etaMinutes: Number(r.eta_minutes),
      notes: r.notes ? String(r.notes) : undefined,
      timestamp: String(r.timestamp),
      podPhotoUrl: r.pod_photo_url ? String(r.pod_photo_url) : undefined,
      podUploadedBy: r.pod_uploaded_by ? String(r.pod_uploaded_by) : undefined,
      podUploadedAt: r.pod_uploaded_at ? String(r.pod_uploaded_at) : undefined,
      deliveredAt: r.delivered_at ? String(r.delivered_at) : undefined,
      handoverConfirmed: r.handover_confirmed === 1 || r.handover_confirmed === true,
      archivedAt: r.archived_at ? String(r.archived_at) : null,
      deletedAt: r.deleted_at ? String(r.deleted_at) : null,
    }));

    const pkIds = (rows as any[]).map((r) => Number(r.id));
    if (pkIds.length > 0) {
      const [itemRows] = await pool.query(
        `SELECT delivery_pk, product_id, name, quantity, price
         FROM delivery_items
         WHERE delivery_pk IN (?)`,
        [pkIds]
      );

      const grouped: any = {};
      (itemRows as any[]).forEach((ir) => {
        const dp = Number(ir.delivery_pk);
        grouped[dp] = grouped[dp] || [];
        grouped[dp].push({
          productId: String(ir.product_id),
          name: String(ir.name),
          quantity: Number(ir.quantity),
          price: Number(ir.price),
        });
      });

      const merged = deliveries.map((d, index) => {
        const pk = pkIds[index];
        return { ...d, items: grouped[pk] || [] };
      });

      return res.json({ ok: true, deliveries: merged });
    }

    res.json({ ok: true, deliveries });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

router.get('/:id/location', requireAuth, requireRole(['admin', 'customer', 'rider']), async (req: AuthenticatedRequest, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const deliveryPk = await resolveDeliveryPk(req.params.id);
    const pool = getPool();
    const [rows]: any = await pool.query(
      `SELECT customer_name, driver_name, delivery_status, driver_lat, driver_lng,
              driver_location_updated_at, driver_location_accuracy_m, eta_minutes
       FROM deliveries WHERE id = ? LIMIT 1`,
      [deliveryPk]
    );
    const delivery = rows?.[0];
    if (!delivery) return res.status(404).json({ ok: false, error: 'Delivery not found.' });
    if (req.user?.role === 'customer' && delivery.customer_name !== req.user.name) {
      return res.status(403).json({ ok: false, error: 'You can only view GPS for your own deliveries.' });
    }
    if (req.user?.role === 'rider' && delivery.driver_name !== req.user.name) {
      return res.status(403).json({ ok: false, error: 'You can only view GPS for deliveries assigned to you.' });
    }

    res.json({
      ok: true,
      driverCoordinates: [Number(delivery.driver_lat), Number(delivery.driver_lng)],
      driverLocationUpdatedAt: delivery.driver_location_updated_at
        ? new Date(delivery.driver_location_updated_at).toISOString()
        : null,
      driverLocationAccuracyMeters: delivery.driver_location_accuracy_m != null
        ? Number(delivery.driver_location_accuracy_m)
        : null,
      etaMinutes: Number(delivery.eta_minutes),
      status: delivery.delivery_status,
    });
  } catch (e: any) {
    res.status(e?.error ? 400 : 500).json({ ok: false, error: e?.error || e?.message || String(e) });
  }
});

router.post('/:id/location', requireAuth, requireRole(['rider']), async (req: AuthenticatedRequest, res) => {
  try {
    const deliveryPk = await resolveDeliveryPk(req.params.id);
    const latitude = parseNumber(req.body?.latitude, 'latitude');
    const longitude = parseNumber(req.body?.longitude, 'longitude');
    const accuracyMeters = parseNumber(req.body?.accuracyMeters, 'accuracyMeters');
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({ ok: false, error: 'GPS coordinates are outside valid ranges.' });
    }
    if (accuracyMeters < 0 || accuracyMeters > 10000) {
      return res.status(400).json({ ok: false, error: 'GPS accuracy must be between 0 and 10000 meters.' });
    }

    const pool = getPool();
    const [rows]: any = await pool.query(
      `SELECT driver_name, delivery_status, lat, lng FROM deliveries WHERE id = ? LIMIT 1`,
      [deliveryPk]
    );
    const delivery = rows?.[0];
    if (!delivery) return res.status(404).json({ ok: false, error: 'Delivery not found.' });
    if (delivery.driver_name !== req.user?.name) {
      return res.status(403).json({ ok: false, error: 'You can only share GPS for deliveries assigned to you.' });
    }
    if (delivery.delivery_status !== 'Out for Delivery') {
      return res.status(409).json({ ok: false, error: 'GPS sharing is only available while a delivery is out for delivery.' });
    }

    const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
    const latitudeDelta = toRadians(Number(delivery.lat) - latitude);
    const longitudeDelta = toRadians(Number(delivery.lng) - longitude);
    const distancePart =
      Math.sin(latitudeDelta / 2) ** 2 +
      Math.cos(toRadians(latitude)) *
        Math.cos(toRadians(Number(delivery.lat))) *
        Math.sin(longitudeDelta / 2) ** 2;
    const boundedDistancePart = Math.min(1, Math.max(0, distancePart));
    const distanceKm = 6371 * 2 * Math.atan2(Math.sqrt(boundedDistancePart), Math.sqrt(1 - boundedDistancePart));
    const etaMinutes = distanceKm < 0.05 ? 0 : Math.ceil(distanceKm * 4);

    await pool.query(
      `UPDATE deliveries
       SET driver_lat = ?, driver_lng = ?, eta_minutes = ?, driver_location_accuracy_m = ?,
           driver_location_updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [latitude, longitude, etaMinutes, accuracyMeters, deliveryPk]
    );

    res.json({
      ok: true,
      driverCoordinates: [latitude, longitude],
      driverLocationUpdatedAt: new Date().toISOString(),
      driverLocationAccuracyMeters: accuracyMeters,
      etaMinutes,
    });
  } catch (e: any) {
    res.status(e?.error ? 400 : 500).json({ ok: false, error: e?.error || e?.message || String(e) });
  }
});

// POST delivery (Authenticated) - secure order checkout on the server
router.post('/', requireAuth, parsePaymentProofUpload, async (req: AuthenticatedRequest, res) => {
  const conn = await getPool().getConnection();
  try {
    let body = req.body || {};
    if (typeof body.payload === 'string') {
      try {
        body = JSON.parse(body.payload);
      } catch {
        return res.status(400).json({ ok: false, error: 'Invalid order payload.' });
      }
    }
    const branch = await assertBranchExists(body.branch);

    const deliveryId = body.id || `DLV-${Date.now().toString().slice(-6)}`;

    if (req.user?.role === 'customer' && req.user.name !== body.customerName) {
      return res.status(403).json({ ok: false, error: 'Customers can only place orders for their own account.' });
    }

    const paymentMethod = body.paymentMethod;
    const allowedPayment = new Set(['Cash', 'GCash', 'Maya']);
    if (!allowedPayment.has(paymentMethod)) {
      return res.status(400).json({ ok: false, error: 'Invalid paymentMethod.' });
    }
    const isCustomerGcashOrder = req.user?.role === 'customer' && paymentMethod === 'GCash';
    const paymentReference = typeof body.paymentReference === 'string' ? body.paymentReference.trim() : '';
    if (isCustomerGcashOrder && paymentReference.length < 3) {
      return res.status(400).json({ ok: false, error: 'Ilagay ang valid na GCash transaction number.' });
    }
    if (paymentReference.length > 120) {
      return res.status(400).json({ ok: false, error: 'GCash transaction number must be 120 characters or fewer.' });
    }
    if (isCustomerGcashOrder && !req.file) {
      return res.status(400).json({ ok: false, error: 'Kailangan ang screenshot ng GCash transaction.' });
    }
    if (req.file && !isCustomerGcashOrder) {
      return res.status(400).json({ ok: false, error: 'Payment proof upload is only accepted for customer GCash orders.' });
    }

    const customerName = parseString(body.customerName, 'customerName');
    const customerPhone = parseString(body.customerPhone, 'customerPhone');
    const address = parseString(body.address, 'address');
    const barangay = parseString(body.barangay, 'barangay');

    const lat = parseNumber(body.coordinates?.[0], 'coordinates[0]');
    const lng = parseNumber(body.coordinates?.[1], 'coordinates[1]');

    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) return res.status(400).json({ ok: false, error: 'items cannot be empty.' });

    const notes = body.notes ? String(body.notes) : null;
    const driverName = body.driverName || 'Kuya Cardo Delivery';

    const driverLat = body.driverCoordinates?.[0] !== undefined ? Number(body.driverCoordinates[0]) : lat;
    const driverLng = body.driverCoordinates?.[1] !== undefined ? Number(body.driverCoordinates[1]) : lng;
    const etaMinutes = body.etaMinutes !== undefined ? Number(body.etaMinutes) : 15;
    const timestamp = body.timestamp ? String(body.timestamp) : new Date().toISOString();

    await conn.beginTransaction();

    const [existingDeliveries]: any = await conn.query(
      `SELECT id FROM deliveries WHERE delivery_id = ? LIMIT 1`,
      [deliveryId]
    );
    if (existingDeliveries.length > 0) {
      await conn.rollback();
      return res.status(409).json({ ok: false, error: `Delivery ${deliveryId} already exists.` });
    }

    // Recompute total cost and items pricing from database products & variants
    const productIds = items.map((it: any) => it.productId);
    const [dbProducts]: any = await conn.query(
      `SELECT id, price, unit, name, authenticity_status, expiry_date < CURDATE() AS is_expired FROM products WHERE id IN (?)`,
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

    let calculatedItemsSum = 0;
    const parsedItems: any[] = [];

    for (const it of items) {
      const dbP = productMap.get(it.productId);
      if (!dbP) {
        throw { error: `Hindi nahanap ang produkto: ${it.productId}` } as ApiError;
      }
      if (Boolean(dbP.is_expired)) {
        throw { error: `Hindi maaaring isama sa order ang expired na produkto: ${dbP.name}.` } as ApiError;
      }
      if (dbP.authenticity_status === 'rejected') {
        throw { error: `Hindi maaaring isama sa order ang tinanggihang produkto: ${dbP.name}.` } as ApiError;
      }

      // Use the explicit unit from the checkout payload so pricing and stock
      // deduction cannot drift from the variant selected by the customer.
      let itemUnitPrice = Number(dbP.price);
      let qtyMultiplier = 1;
      let variantLabel: string | undefined;

      const unitKey = typeof it.unit === 'string' ? it.unit.trim() : '';
      const dbVariant = unitKey ? variantMap.get(`${it.productId}:${unitKey}`) : undefined;

      if (dbVariant) {
        itemUnitPrice = Number(dbVariant.price);
        qtyMultiplier = Number(dbVariant.qtyPerUnit || 1);
        variantLabel = String(dbVariant.unitName);
      } else if (unitKey) {
        throw { error: `Hindi wastong yunit (${unitKey}) para sa produktong ${dbP.name}.` } as ApiError;
      } else if (it.name && it.name.includes('[')) {
        // Fallback: match variant by label substring if unit parameter is generic
        for (const [vKey, vObj] of variantMap.entries()) {
          if (vKey.startsWith(`${it.productId}:`) && it.name.includes(vObj.unitName)) {
            itemUnitPrice = Number(vObj.price);
            qtyMultiplier = Number(vObj.qtyPerUnit || 1);
            variantLabel = String(vObj.unitName);
            break;
          }
        }
      }

      const quantity = Number(it.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw { error: `Invalid quantity for product ${dbP.name}.` } as ApiError;
      }

      const effectiveQuantity = quantity * qtyMultiplier;
      calculatedItemsSum += itemUnitPrice * quantity;

      parsedItems.push({
        productId: it.productId,
        name: variantLabel ? `${dbP.name} [${variantLabel}]` : dbP.name,
        quantity,
        effectiveQuantity,
        price: itemUnitPrice,
      });
    }

    // Delivery fee rule: Free if items sum > 1000, else 50 PHP
    const calculatedFee = calculatedItemsSum > 1000 ? 0 : 50;
    const computedTotalAmount = calculatedItemsSum + calculatedFee;

    // Check stock with locks using effectiveQuantity
    for (const it of parsedItems) {
      const [stockRows]: any = await conn.query(
        `SELECT stock FROM product_stock WHERE product_id = ? AND branch = ? FOR UPDATE`,
        [it.productId, branch]
      );
      const current = stockRows?.[0]?.stock;
      if (current === undefined) {
        throw { error: `Walang stock record para sa produktong ${it.productId} sa ${branch} branch.` } as ApiError;
      }
      if (Number(current) < it.effectiveQuantity) {
        throw { error: `Kulang ang stock para sa "${it.name}". Available: ${current}, kailangan: ${it.effectiveQuantity}.` } as ApiError;
      }
    }

    // Optional POS linkage (store POS txn_id on the delivery)
    const orderTxnId = body.orderTxnId ? String(body.orderTxnId).trim() : null;
    if (isCustomerGcashOrder) {
      const [referenceRows]: any = await conn.query(
        `SELECT id FROM deliveries WHERE payment_reference = ? LIMIT 1`,
        [paymentReference]
      );
      if (referenceRows.length > 0) {
        throw { error: 'Duplicate GCash transaction number. Pakisuri at ilagay ang tamang reference.' } as ApiError;
      }
    }
    const paymentProofUrl = isCustomerGcashOrder
      ? await storeImage(req.file!, 'silang-mini-mart/gcash-payment-proofs', 'gcash-payment-proofs')
      : null;

    // Insert delivery header
    const [deliveryResult] = await conn.query(
      `INSERT INTO deliveries
        (delivery_id, branch, customer_name, customer_phone, address, barangay, lat, lng,
         delivery_status, payment_method, payment_status, payment_reference, payment_amount, payment_proof_url,
         delivery_fee, total_amount, driver_name, driver_lat, driver_lng, eta_minutes, notes, timestamp,
         order_txn_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        deliveryId,
        branch,
        customerName,
        customerPhone,
        address,
        barangay,
        lat,
        lng,
        'Pending',
        paymentMethod,
        paymentMethod === 'Cash' ? 'Pending' : 'Awaiting Verification',
        isCustomerGcashOrder ? paymentReference : null,
        isCustomerGcashOrder ? computedTotalAmount : null,
        paymentProofUrl,
        calculatedFee,
        computedTotalAmount,
        driverName,
        driverLat,
        driverLng,
        etaMinutes,
        notes,
        timestamp.replace('T', ' ').slice(0, 19),
        orderTxnId,
      ]
    );

    const deliveryPk = (deliveryResult as any).insertId;

    // Insert items and decrement stocks by effectiveQuantity
    for (const it of parsedItems) {
      await conn.query(
        `INSERT INTO delivery_items (delivery_pk, product_id, name, quantity, price)
         VALUES (?,?,?,?,?)`,
        [deliveryPk, it.productId, it.name, it.quantity, it.price]
      );

      await conn.query(
        `UPDATE product_stock SET stock = stock - ? WHERE product_id = ? AND branch = ?`,
        [it.effectiveQuantity, it.productId, branch]
      );
    }

    await conn.commit();

    // Fire order-created notifications (non-blocking, after commit)
    notifyOrderCreated({
      deliveryId,
      customerName,
      totalAmount: computedTotalAmount,
      paymentMethod,
      address,
      branch,
      items: parsedItems.map(i => ({ name: i.name, quantity: i.quantity })),
    }).catch(err => console.error('[notif] OrderCreated error:', err));

    // Check if any items crossed low-stock threshold after decrement
    for (const it of parsedItems) {
      try {
        const [stockRows]: any = await conn.query(
          `SELECT ps.stock, p.name, p.lowStockThreshold
           FROM product_stock ps JOIN products p ON p.id = ps.product_id
           WHERE ps.product_id = ? AND ps.branch = ?`,
          [it.productId, branch]
        );
        const sr = stockRows?.[0];
        if (sr) {
          if (Number(sr.stock) === 0) {
            notifyOutOfStock(sr.name, it.productId, branch).catch(() => {});
          } else if (Number(sr.stock) <= Number(sr.lowStockThreshold)) {
            notifyLowStock(sr.name, it.productId, Number(sr.stock), branch).catch(() => {});
          }
        }
      } catch { /* suppress */ }
    }

    res.json({ ok: true, id: deliveryPk, deliveryId });
  } catch (e: any) {
    await conn.rollback();
    res.status(e?.error ? 400 : 500).json({ ok: false, error: e?.error || e?.message || String(e) });
  } finally {
    conn.release();
  }
});

async function resolveDeliveryPk(idParam: any): Promise<number> {
  if (idParam === undefined || idParam === null) {
    throw { error: 'Missing delivery ID.' } as ApiError;
  }
  const strVal = String(idParam).trim();
  if (!strVal) {
    throw { error: 'Missing delivery ID.' } as ApiError;
  }
  const pool = getPool();
  const numVal = Number(strVal);
  if (Number.isFinite(numVal)) {
    const [rows]: any = await pool.query(
      `SELECT id FROM deliveries WHERE id = ? OR delivery_id = ? LIMIT 1`,
      [numVal, strVal]
    );
    if (rows && rows.length > 0) return Number(rows[0].id);
  } else {
    const [rows]: any = await pool.query(
      `SELECT id FROM deliveries WHERE delivery_id = ? LIMIT 1`,
      [strVal]
    );
    if (rows && rows.length > 0) return Number(rows[0].id);
  }
  throw { error: `Delivery not found with ID: "${strVal}".` } as ApiError;
}

// POST COD/GCash/Maya payment record (Rider or Admin)
// Riders submit digital references as awaiting verification; only an admin can mark them Paid.
router.post('/:id/payment', requireAuth, requireRole(['admin', 'rider']), async (req: AuthenticatedRequest, res) => {
  try {
    const deliveryPk = await resolveDeliveryPk(req.params.id);
    const body = req.body || {};

    const pool = getPool();

    const paymentMethod = parseString(body.paymentMethod, 'paymentMethod');
    const allowed = new Set(['Cash', 'GCash', 'Maya']);
    if (!allowed.has(paymentMethod)) {
      return res.status(400).json({ ok: false, error: 'Invalid paymentMethod.' });
    }

    const paymentGatewayStatus = body.paymentGatewayStatus ? String(body.paymentGatewayStatus) : undefined;
    const paymentReference = body.paymentReference ? String(body.paymentReference).trim() : undefined;
    const paymentAmount = body.paymentAmount !== undefined ? Number(body.paymentAmount) : undefined;

    const codAmountReceived = body.codAmountReceived !== undefined ? Number(body.codAmountReceived) : undefined;
    const codCollectedBy = body.codCollectedBy ? String(body.codCollectedBy) : undefined;

    // Load delivery current state
    const [dRows]: any = await pool.query(
      `SELECT id, delivery_id, delivery_status, payment_status, payment_method, total_amount, driver_name, customer_name
       FROM deliveries WHERE id = ?`,
      [deliveryPk]
    );
    if (!dRows || dRows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Delivery not found.' });
    }

    const delivery = dRows[0];
    const totalAmount = Number(delivery.total_amount);
    const isRider = req.user?.role === 'rider';

    if (isRider && ![req.user?.name, req.user?.username].includes(String(delivery.driver_name))) {
      return res.status(403).json({ ok: false, error: 'Hindi ikaw ang nakatalagang rider para sa delivery na ito.' });
    }

    // Disallow payments on cancelled deliveries
    if (delivery.delivery_status === 'Cancelled') {
      return res.status(409).json({ ok: false, error: 'Cannot process payment for a cancelled delivery.' });
    }

    // Basic idempotency: if already Paid, do not re-pay
    if (delivery.payment_status === 'Paid') {
      return res.status(409).json({ ok: false, error: 'Payment already marked as Paid for this delivery.' });
    }

    // Enforce payment method consistency with originally chosen payment_method
    if (delivery.payment_method !== paymentMethod) {
      return res.status(400).json({
        ok: false,
        error: `paymentMethod mismatch. This delivery was created with payment_method='${delivery.payment_method}', but request used '${paymentMethod}'.`,
      });
    }

    if (paymentMethod === 'Cash') {
      if (!Number.isFinite(codAmountReceived as any)) {
        return res.status(400).json({ ok: false, error: 'Missing or invalid codAmountReceived.' });
      }
      if (Number(codAmountReceived) !== totalAmount) {
        return res.status(400).json({
          ok: false,
          error: `COD amount mismatch. Expected: ₱${totalAmount.toFixed(2)}. Received: ₱${Number(codAmountReceived).toFixed(2)}`,
        });
      }
      if (!codCollectedBy) {
        return res.status(400).json({ ok: false, error: 'Missing codCollectedBy.' });
      }

      const cashCounted = body.cashReceivedCounted;
      // Strict rider acknowledgement (server-side). Frontend must send a boolean.
      if (typeof cashCounted !== 'boolean') {
        return res.status(400).json({ ok: false, error: 'Missing or invalid cashReceivedCounted (boolean) for COD.' });
      }
      if (cashCounted !== true) {
        return res.status(400).json({ ok: false, error: 'cashReceivedCounted must be true after counting cash in front of customer.' });
      }

      await pool.query(
        `UPDATE deliveries
         SET payment_method = 'Cash',
             payment_status = 'Paid',
             cod_amount_received = ?,
             cod_collected_by = ?,
             cod_collected_at = NOW(),
             paid_at = NOW()
         WHERE id = ?`,
        [Number(codAmountReceived), codCollectedBy, deliveryPk]
      );

      // Payment notification (non-blocking)
      const [dInfoRows]: any = await pool.query(
        `SELECT delivery_id, customer_name, total_amount, driver_name FROM deliveries WHERE id = ?`,
        [deliveryPk]
      );
      if (dInfoRows?.[0]) {
        const di = dInfoRows[0];
        notifyPaymentReceived({
          deliveryId: di.delivery_id,
          customerName: di.customer_name,
          totalAmount: Number(di.total_amount),
          paymentMethod: 'Cash',
          riderName: di.driver_name,
          codAmount: Number(codAmountReceived),
        }).catch(() => {});
      }

      return res.json({ ok: true });
    }

    // Digital validations
    if (paymentReference == null || paymentReference.length < 3) {
      return res.status(400).json({ ok: false, error: 'Missing or invalid paymentReference.' });
    }
    if (!Number.isFinite(paymentAmount as any)) {
      return res.status(400).json({ ok: false, error: 'Missing or invalid paymentAmount.' });
    }
    if (paymentAmount == null || paymentAmount <= 0) {
      return res.status(400).json({ ok: false, error: 'paymentAmount must be a valid positive number.' });
    }

    if (Number(paymentAmount) !== totalAmount) {
      return res.status(400).json({
        ok: false,
        error: `Payment amount mismatch. Expected: ₱${totalAmount.toFixed(2)}. Received: ₱${Number(paymentAmount).toFixed(2)}`,
      });
    }

    if (!paymentGatewayStatus) {
      return res.status(400).json({ ok: false, error: 'Missing paymentGatewayStatus for digital payments.' });
    }

    // Prevent duplicate reference numbers across all deliveries
    const [refRows]: any = await pool.query(
      `SELECT id FROM deliveries WHERE payment_reference = ? LIMIT 1`,
      [paymentReference]
    );
    if (refRows && refRows.length > 0 && Number(refRows[0].id) !== Number(deliveryPk)) {
      return res.status(409).json({ ok: false, error: 'Duplicate paymentReference detected.' });
    }

    const normalized = String(paymentGatewayStatus).toLowerCase();
    if (!['awaiting verification', 'successful', 'failed'].includes(normalized)) {
      return res.status(400).json({
        ok: false,
        error: "Invalid paymentGatewayStatus. Expected 'Awaiting Verification', 'Successful', or 'Failed'.",
      });
    }

    if (isRider && normalized !== 'awaiting verification') {
      return res.status(403).json({ ok: false, error: 'Rider-submitted GCash/Maya proof must be verified by an admin before marking it paid.' });
    }
    if (!isRider && !['successful', 'failed'].includes(normalized)) {
      return res.status(400).json({ ok: false, error: 'Admin must confirm the payment as Successful or Failed.' });
    }
    if (isRider && !['Pending', 'Preparing'].includes(delivery.delivery_status)) {
      return res.status(409).json({ ok: false, error: 'GCash/Maya proof must be submitted before dispatch.' });
    }
    if (!isRider && !['Awaiting Verification', 'Failed'].includes(delivery.payment_status)) {
      return res.status(409).json({ ok: false, error: 'Walang pending digital payment na kailangang i-verify.' });
    }

    const newPaymentStatus: 'Paid' | 'Failed' | 'Awaiting Verification' =
      normalized === 'successful' ? 'Paid'
        : normalized === 'failed' ? 'Failed'
          : 'Awaiting Verification';

    const payment_failed_reason = body.paymentFailedReason ? String(body.paymentFailedReason).trim() : null;
    if (newPaymentStatus === 'Failed' && (!payment_failed_reason || payment_failed_reason.length < 3)) {
      return res.status(400).json({ ok: false, error: 'Missing paymentFailedReason (min 3 chars) when paymentGatewayStatus is Failed.' });
    }

    await pool.query(
      `UPDATE deliveries
       SET payment_method = ?,
           payment_reference = ?,
           payment_amount = ?,
           payment_status = ?,
           payment_failed_reason = ?,
           paid_at = CASE WHEN ? IN ('Paid') THEN NOW() ELSE NULL END
       WHERE id = ?`,
      [paymentMethod, paymentReference, Number(paymentAmount), newPaymentStatus, payment_failed_reason, newPaymentStatus, deliveryPk]
    );

    if (newPaymentStatus === 'Awaiting Verification') {
      await notifyAllAdmins({
        type: 'warning',
        category: 'payment',
        title: 'GCash/Maya payment needs verification',
        message: `${delivery.payment_method} reference ${paymentReference} for Order #${delivery.delivery_id} needs checking in the official merchant account before dispatch.`,
        entityType: 'delivery',
        entityId: String(delivery.delivery_id),
        actionUrl: '/deliveries',
        priority: 'important',
      });
    } else if (newPaymentStatus === 'Paid') {
      notifyPaymentReceived({
        deliveryId: String(delivery.delivery_id),
        customerName: String(delivery.customer_name),
        totalAmount,
        paymentMethod,
        riderName: String(delivery.driver_name),
      }).catch((error) => console.error('[notif] Digital payment verification notification failed:', error));
    }

    return res.json({ ok: true, paymentStatus: newPaymentStatus });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e?.error || e?.message || String(e) });
  }
});


// Customer order organization actions
for (const action of ['archive', 'restore', 'delete'] as const) {
  router.post(`/:id/${action}`, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const deliveryPk = await resolveDeliveryPk(req.params.id);
      const pool = getPool();
      const [rows]: any = await pool.query(`SELECT customer_name FROM deliveries WHERE id = ?`, [deliveryPk]);
      if (!rows[0]) return res.status(404).json({ ok: false, error: 'Delivery not found.' });
      if (req.user?.role === 'customer' && rows[0].customer_name !== req.user.name) {
        return res.status(403).json({ ok: false, error: 'You can only organize your own orders.' });
      }

      if (action === 'archive') {
        await pool.query(`UPDATE deliveries SET archived_at = NOW(), deleted_at = NULL WHERE id = ?`, [deliveryPk]);
      } else if (action === 'delete') {
        await pool.query(`UPDATE deliveries SET deleted_at = NOW() WHERE id = ?`, [deliveryPk]);
      } else {
        await pool.query(`UPDATE deliveries SET archived_at = NULL, deleted_at = NULL WHERE id = ?`, [deliveryPk]);
      }
      return res.json({ ok: true, action });
    } catch (e: any) {
      return res.status(e?.error ? 400 : 500).json({ ok: false, error: e?.error || e?.message || String(e) });
    }
  });
}

// POST delivery status update (customer may cancel their own unstarted order)
router.post('/:id/status', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const deliveryPk = await resolveDeliveryPk(req.params.id);
    const body = req.body || {};

    const pool = getPool();

    const [curRows]: any = await pool.query(
      `SELECT delivery_status, payment_status, payment_method, payment_reference, payment_amount,
              total_amount, driver_name, customer_name
       FROM deliveries WHERE id = ?`,
      [deliveryPk]
    );
    if (!curRows || curRows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Delivery not found.' });
    }

    const currentDeliveryStatus = curRows?.[0]?.delivery_status;
    const currentPaymentStatus = curRows?.[0]?.payment_status;
    const currentCustomerName = curRows?.[0]?.customer_name;
    const currentPaymentMethod = curRows?.[0]?.payment_method;
    const currentPaymentReference = curRows?.[0]?.payment_reference;
    const currentPaymentAmount = curRows?.[0]?.payment_amount;
    const currentTotalAmount = Number(curRows?.[0]?.total_amount);
    const currentDriverName = curRows?.[0]?.driver_name;

    const requestedStatus = body.deliveryStatus ?? body.status;
    if (req.user?.role === 'customer') {
      if (currentCustomerName !== req.user.name) {
        return res.status(403).json({ ok: false, error: 'You can only update your own orders.' });
      }
      if (requestedStatus !== 'Cancelled') {
        return res.status(403).json({ ok: false, error: 'Customers may only cancel their own orders.' });
      }
      if (!['Pending', 'Preparing'].includes(currentDeliveryStatus)) {
        return res.status(409).json({ ok: false, error: 'Orders can only be cancelled before dispatch.' });
      }
    } else if (!['admin', 'rider'].includes(req.user?.role || '')) {
      return res.status(403).json({ ok: false, error: 'You are not allowed to update delivery status.' });
    }
    if (req.user?.role === 'rider' && ![req.user.name, req.user.username].includes(String(currentDriverName))) {
      return res.status(403).json({ ok: false, error: 'You are not assigned to this delivery.' });
    }

    // Disallow updating after cancellation/after delivered
    if (currentDeliveryStatus === 'Cancelled') {
      return res.status(409).json({ ok: false, error: 'Cannot update status of a cancelled delivery.' });
    }
    if (currentDeliveryStatus === 'Delivered') {
      return res.status(409).json({ ok: false, error: 'Cannot update status of a delivered delivery.' });
    }

    if (requestedStatus === 'Cancelled' && currentPaymentStatus === 'Paid') {
      return res.status(409).json({ ok: false, error: 'Paid orders require refund processing before cancellation.' });
    }

    const setParts: string[] = [];
    const params: any[] = [];

    // Handle optional status update
    const deliveryStatus = body.deliveryStatus ?? body.status;
    if (deliveryStatus !== undefined) {
      const statusStr = parseString(deliveryStatus, 'deliveryStatus');
      const allowed = new Set(['Pending', 'Preparing', 'Out for Delivery', 'Delivered', 'Cancelled']);
      if (!allowed.has(statusStr)) {
        return res.status(400).json({ ok: false, error: 'Invalid deliveryStatus.' });
      }

      // Only validate transition if status actually changed
      if (statusStr !== currentDeliveryStatus) {
        // Enforce allowed transitions
        const allowedTransitions: Record<string, string[]> = {
          Pending: ['Preparing', 'Out for Delivery', 'Cancelled'],
          Preparing: ['Out for Delivery', 'Cancelled'],
          'Out for Delivery': ['Delivered', 'Cancelled'],
          Delivered: [],
          Cancelled: [],
        };

        const allowedNext = allowedTransitions[currentDeliveryStatus] || [];
        if (!allowedNext.includes(statusStr)) {
          return res.status(400).json({
            ok: false,
            error: `Invalid delivery status transition. ${currentDeliveryStatus} -> ${statusStr} is not allowed.`,
          });
        }

        if (statusStr === 'Out for Delivery' && currentPaymentMethod !== 'Cash' && (
          currentPaymentStatus !== 'Paid' ||
          !currentPaymentReference ||
          Number(currentPaymentAmount) !== currentTotalAmount
        )) {
          return res.status(409).json({
            ok: false,
            error: `${currentPaymentMethod} payment needs an admin-verified reference and exact matching amount before dispatch. Current payment status: ${currentPaymentStatus}.`,
          });
        }

        // If changing to Delivered, enforce payment_status=Paid AND POD uploaded AND handover confirmed
        if (statusStr === 'Delivered') {
          if (currentPaymentStatus !== 'Paid') {
            return res.status(400).json({
              ok: false,
              error: `Cannot mark as Delivered unless payment_status is Paid. Current: ${currentPaymentStatus}`,
            });
          }
          const [podRows]: any = await pool.query(
            `SELECT pod_photo_url, handover_confirmed FROM deliveries WHERE id = ?`,
            [deliveryPk]
          );
          const podRow = podRows?.[0];
          if (!podRow?.pod_photo_url) {
            return res.status(400).json({
              ok: false,
              error: 'Proof of Delivery photo is required before marking order as Delivered.',
            });
          }
          if (!podRow?.handover_confirmed) {
            return res.status(400).json({
              ok: false,
              error: 'Rider must confirm physical handover to customer before marking as Delivered.',
            });
          }
        }
      }

      setParts.push('delivery_status = ?');
      params.push(statusStr);
      // Record delivered_at timestamp when transitioning to Delivered
      if (statusStr === 'Delivered') {
        setParts.push('delivered_at = NOW()');
      }
    }

    // Handle optional driver name update
    const driverName = body.driverName ? parseString(body.driverName, 'driverName') : undefined;
    if (driverName !== undefined) {
      setParts.push('driver_name = ?');
      params.push(driverName);
    }

    // Handle optional ETA update
    const etaMinutes = body.etaMinutes !== undefined ? parseNumber(body.etaMinutes, 'etaMinutes') : undefined;
    if (etaMinutes !== undefined) {
      setParts.push('eta_minutes = ?');
      params.push(Math.floor(etaMinutes));
    }

    // If nothing to update, return early
    if (setParts.length === 0) {
      return res.status(400).json({ ok: false, error: 'No fields to update.' });
    }

    params.push(deliveryPk);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query(`UPDATE deliveries SET ${setParts.join(', ')} WHERE id = ?`, params);

      // If transition to Cancelled, restore stock
      const deliveryStatus = body.deliveryStatus ?? body.status;
      if (deliveryStatus && parseString(deliveryStatus, 'deliveryStatus') === 'Cancelled' && currentDeliveryStatus !== 'Cancelled') {
        const [delRows]: any = await conn.query(`SELECT branch FROM deliveries WHERE id = ?`, [deliveryPk]);
        const branchName = delRows?.[0]?.branch;

        const [itemRows]: any = await conn.query(
          `SELECT product_id, name, quantity FROM delivery_items WHERE delivery_pk = ?`,
          [deliveryPk]
        );

        for (const item of itemRows) {
          const productId = String(item.product_id);
          const qty = Number(item.quantity);

          const [prodRows]: any = await conn.query(`SELECT unit FROM products WHERE id = ?`, [productId]);
          const baseUnit = prodRows?.[0]?.unit;

          const [varRows]: any = await conn.query(
            `SELECT unitName, qtyPerUnit FROM product_variants WHERE product_id = ?`,
            [productId]
          );

          let qtyMultiplier = 1;
          if (varRows && varRows.length > 0) {
            for (const v of varRows) {
              if (item.name && item.name.includes(v.unitName)) {
                qtyMultiplier = Number(v.qtyPerUnit || 1);
                break;
              }
            }
          }

          const effectiveRestoreQty = qty * qtyMultiplier;

          await conn.query(
            `UPDATE product_stock SET stock = stock + ? WHERE product_id = ? AND branch = ?`,
            [effectiveRestoreQty, productId, branchName]
          );
        }
      }

      await conn.commit();

      // Fire status-change notifications (non-blocking, after commit)
      if (deliveryStatus && deliveryStatus !== currentDeliveryStatus) {
        const [dRows2]: any = await pool.query(
          `SELECT delivery_id, customer_name, total_amount, payment_method, driver_name, address FROM deliveries WHERE id = ?`,
          [deliveryPk]
        );
        if (dRows2?.[0]) {
          const d = dRows2[0];
          const newStatus = parseString(deliveryStatus, 'deliveryStatus');

          // Rider assigned notification (when driverName is being changed to a real rider)
          if (driverName && driverName !== 'Kuya Cardo Delivery' && currentDeliveryStatus === 'Pending') {
            notifyRiderAssigned(driverName, {
              deliveryId: d.delivery_id,
              customerName: d.customer_name,
              totalAmount: Number(d.total_amount),
              paymentMethod: d.payment_method,
              address: d.address,
              riderName: driverName,
            }).catch(() => {});
          }

          notifyOrderStatusChange(newStatus, {
            deliveryId: d.delivery_id,
            customerName: d.customer_name,
            totalAmount: Number(d.total_amount),
            paymentMethod: d.payment_method,
            riderName: d.driver_name || driverName,
            address: d.address,
          }).catch(() => {});
        }
      } else if (driverName && deliveryStatus === undefined) {
        // Driver name update without status change = rider assignment
        const [dRows3]: any = await pool.query(
          `SELECT delivery_id, customer_name, total_amount, payment_method, address, delivery_status FROM deliveries WHERE id = ?`,
          [deliveryPk]
        );
        if (dRows3?.[0] && dRows3[0].delivery_status === 'Pending') {
          const d = dRows3[0];
          notifyRiderAssigned(driverName, {
            deliveryId: d.delivery_id,
            customerName: d.customer_name,
            totalAmount: Number(d.total_amount),
            paymentMethod: d.payment_method,
            address: d.address,
            riderName: driverName,
          }).catch(() => {});
        }
      }

      res.json({ ok: true });
    } catch (err: any) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e?.error || e?.message || String(e) });
  }
});


// POST /api/deliveries/:id/pod — Upload Proof of Delivery photo (Rider/Admin)
router.post(
  '/:id/pod',
  requireAuth,
  requireRole(['admin', 'rider']),
  podUpload.single('pod_photo'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const deliveryPk = await resolveDeliveryPk(req.params.id);
      const pool = getPool();

      // Verify delivery exists and is not already Delivered/Cancelled
      const [curRows]: any = await pool.query(
        `SELECT delivery_status, pod_photo_url FROM deliveries WHERE id = ?`,
        [deliveryPk]
      );
      if (!curRows || curRows.length === 0) {
        return res.status(404).json({ ok: false, error: 'Delivery not found.' });
      }
      const { delivery_status } = curRows[0];
      if (delivery_status === 'Cancelled') {
        return res.status(409).json({ ok: false, error: 'Cannot upload POD for a cancelled delivery.' });
      }
      if (delivery_status === 'Delivered') {
        return res.status(409).json({ ok: false, error: 'Delivery already marked as Delivered.' });
      }

      // Ensure a file was uploaded
      if (!req.file) {
        return res.status(400).json({ ok: false, error: 'No proof of delivery photo uploaded.' });
      }

      const podPhotoUrl = await storeImage(req.file, 'silang-mini-mart/proof-of-delivery', 'pod');
      const uploadedBy = req.user?.name || req.user?.username || 'Unknown Rider';

      // Parse handover confirmation from form fields
      const handoverConfirmed =
        req.body?.handoverConfirmed === true ||
        req.body?.handoverConfirmed === 'true' ||
        req.body?.handoverConfirmed === '1';

      await pool.query(
        `UPDATE deliveries
         SET pod_photo_url = ?,
             pod_uploaded_by = ?,
             pod_uploaded_at = NOW(),
             handover_confirmed = ?
         WHERE id = ?`,
        [podPhotoUrl, uploadedBy, handoverConfirmed ? 1 : 0, deliveryPk]
      );

      return res.json({ ok: true, podPhotoUrl });
    } catch (e: any) {
      res.status(400).json({ ok: false, error: e?.error || e?.message || String(e) });
    }
  }
);


export default router;
