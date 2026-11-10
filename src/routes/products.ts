import express from 'express';
import { getPool } from '../db/mysql';
import { requireAuth, requireRole } from '../utils/authMiddleware';
import multer from 'multer';
import { assertBranchSync } from '../utils/branchUtils';
import { storeImage } from '../utils/imageStorage';

const router = express.Router();

type ApiError = { error: string; details?: any };

function assertBranch(branch: any): string {
  return assertBranchSync(branch);
}

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

function parseOptionalDate(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw { error: 'expiryDate must use YYYY-MM-DD format.' } as ApiError;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw { error: 'expiryDate is not a valid calendar date.' } as ApiError;
  }
  return value;
}

function parseAuthenticityStatus(value: unknown): 'unverified' | 'verified' | 'rejected' {
  if (value === undefined || value === null || value === '') return 'unverified';
  if (value === 'unverified' || value === 'verified' || value === 'rejected') return value;
  throw { error: 'Invalid authenticityStatus.' } as ApiError;
}

const productImagesUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req: any, file: any, cb: (error: any, acceptFile: boolean) => void) => {
    const ok = file.mimetype.startsWith('image/');
    cb(ok ? null : new Error('Only image files are allowed'), ok);
  },
});

const variantImagesUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req: any, file: any, cb: (error: any, acceptFile: boolean) => void) => {
    const ok = file.mimetype.startsWith('image/');
    cb(ok ? null : new Error('Only image files are allowed'), ok);
  }

});

// Upload product image (Admin only)
router.post(
  '/upload-image',
  requireAuth,
  requireRole(['admin']),
  productImagesUpload.single('image'),
  async (req: express.Request, res: express.Response) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ ok: false, error: 'No image file provided.' });
      }
      const url = await storeImage(file, 'silang-mini-mart/products', 'product-images');
      res.json({ ok: true, url });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
  },
  (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err) {
      const msg = err?.message || 'Upload failed.';
      return res.status(400).json({ ok: false, error: msg });
    }
    _next();
  }
);

// List products (Public - needed for search, dropdown, customer portal, cash register)
router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    
    // Fetch all branches to determine A and B
    const [branchRows]: any = await pool.query('SELECT name FROM branches ORDER BY id');
    const branchNames: string[] = branchRows.map((br: any) => br.name);
    const branchA = branchNames[0] || 'Poblacion';
    const branchB = branchNames[1] || 'Bypass';

    const [rows] = await pool.query(
      `SELECT 
        p.id,
        p.name,
        p.tagalogName,
        p.category,
        p.price,
        p.cost,
        p.batch_number,
        p.expiry_date,
        p.supplier_name,
        p.authenticity_status,
        p.shelfLocation,
        p.barcode,
        p.unit,
        p.lowStockThreshold,
        p.overStockThreshold,
        p.imagePlaceholderColor,
        p.images_json
      FROM products p
      ORDER BY p.category, p.name`
    );

    const [stockRows]: any = await pool.query(`SELECT product_id, branch, stock FROM product_stock`);
    const stockMap = new Map<string, Record<string, number>>();
    for (const sr of stockRows) {
      const pid = String(sr.product_id);
      const br = String(sr.branch);
      const st = Number(sr.stock) || 0;
      if (!stockMap.has(pid)) {
        stockMap.set(pid, {});
      }
      stockMap.get(pid)![br] = st;
    }

    const products = (rows as any[]).map((r) => {
      const images = r.images_json
        ? typeof r.images_json === 'string'
          ? JSON.parse(r.images_json)
          : r.images_json
        : undefined;
      const imagesArr: string[] | undefined = Array.isArray(images) ? images : undefined;

      const pStockMap = stockMap.get(String(r.id)) || {};
      const stockA = branchA ? (pStockMap[branchA] || 0) : 0;
      const stockB = branchB ? (pStockMap[branchB] || 0) : 0;

      // Ensure all registered branches have an entry in stockByBranch
      const fullStockByBranch: Record<string, number> = {};
      for (const brName of branchNames) {
        fullStockByBranch[brName] = pStockMap[brName] || 0;
      }

      return {
        id: String(r.id),
        name: String(r.name),
        tagalogName: r.tagalogName ? String(r.tagalogName) : undefined,
        category: String(r.category),
        price: Number(r.price),
        cost: Number(r.cost),
        batchNumber: r.batch_number ? String(r.batch_number) : undefined,
        expiryDate: r.expiry_date
          ? r.expiry_date instanceof Date
            ? r.expiry_date.toISOString().slice(0, 10)
            : String(r.expiry_date).slice(0, 10)
          : undefined,
        supplierName: r.supplier_name ? String(r.supplier_name) : undefined,
        authenticityStatus: r.authenticity_status || 'unverified',
        stockByBranch: fullStockByBranch,
        stockBranchA: stockA,
        stockBranchB: stockB,
        shelfLocation: String(r.shelfLocation),
        barcode: String(r.barcode),
        unit: r.unit,
        lowStockThreshold: Number(r.lowStockThreshold),
        overStockThreshold: r.overStockThreshold !== undefined && r.overStockThreshold !== null ? Number(r.overStockThreshold) : 500,
        imagePlaceholderColor: r.imagePlaceholderColor ? String(r.imagePlaceholderColor) : undefined,
        images: imagesArr,
        variants: [],
      };
    });


    const ids = products.map((p) => p.id);
    let variantMap = new Map<string, any[]>();
    if (ids.length > 0) {
      const [vrows] = await pool.query(
        `SELECT product_id, type, label, qtyPerUnit, price, cost, unitName, image
         FROM product_variants
         WHERE product_id IN (?)
         ORDER BY type, id`,
        [ids]
      );
      const grouped: any = {};
      (vrows as any[]).forEach((vr) => {
        const pid = String(vr.product_id);
        grouped[pid] = grouped[pid] || [];
        grouped[pid].push({
          type: vr.type,
          label: String(vr.label),
          qtyPerUnit: Number(vr.qtyPerUnit),
          price: Number(vr.price),
          cost: Number(vr.cost),
          unitName: String(vr.unitName),
          image: vr.image ? String(vr.image) : undefined,
        });
      });
      variantMap = new Map(Object.entries(grouped));
    }

    const normalized = products.map((p) => ({
      ...p,
      variants: variantMap.get(p.id) || [],
    }));

    res.json({ ok: true, products: normalized });
  } catch (e: any) {
    const status = e?.error ? 400 : 500;
    res.status(status).json({ ok: false, ...(e?.error ? e : { error: e?.message || String(e) }) });
  }
});

// Add new product (Admin/Staff only)
router.post('/', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const body = req.body || {};

    const id = parseString(body.id, 'id');
    const name = parseString(body.name, 'name');
    const category = parseString(body.category, 'category');
    const price = parseNumber(body.price, 'price');
    const cost = parseNumber(body.cost, 'cost');
    const batchNumber = typeof body.batchNumber === 'string' && body.batchNumber.trim() ? body.batchNumber.trim() : null;
    const expiryDate = parseOptionalDate(body.expiryDate);
    const supplierName = typeof body.supplierName === 'string' && body.supplierName.trim() ? body.supplierName.trim() : null;
    const authenticityStatus = parseAuthenticityStatus(body.authenticityStatus);
    const shelfLocation = parseString(body.shelfLocation, 'shelfLocation');
    const barcode = parseString(body.barcode, 'barcode');
    const unit = parseString(body.unit, 'unit');
    const lowStockThreshold = parseNumber(body.lowStockThreshold, 'lowStockThreshold');
    const overStockThreshold = body.overStockThreshold !== undefined && body.overStockThreshold !== null && body.overStockThreshold !== ''
      ? Math.max(1, parseNumber(body.overStockThreshold, 'overStockThreshold'))
      : 500;

    const tagalogName = typeof body.tagalogName === 'string' ? body.tagalogName : null;
    const imagePlaceholderColor = typeof body.imagePlaceholderColor === 'string' ? body.imagePlaceholderColor : null;
    const images = Array.isArray(body.images) ? body.images : null;

    const pool = getPool();

    await pool.query(
      `INSERT INTO products 
        (id, name, tagalogName, category, price, cost, batch_number, expiry_date, supplier_name, authenticity_status,
         shelfLocation, barcode, unit, lowStockThreshold, overStockThreshold, imagePlaceholderColor, images_json)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id,
        name,
        tagalogName,
        category,
        price,
        cost,
        batchNumber,
        expiryDate,
        supplierName,
        authenticityStatus,
        shelfLocation,
        barcode,
        unit,
        lowStockThreshold,
        overStockThreshold,
        imagePlaceholderColor,
        images ? JSON.stringify(images) : null,
      ]
    );

    // Save stock row for ALL currently configured branches
    const stockByBranch = body.stockByBranch || {};
    const stockA = body.stockBranchA !== undefined ? Number(body.stockBranchA) : undefined;
    const stockB = body.stockBranchB !== undefined ? Number(body.stockBranchB) : undefined;

    const [branchRows]: any = await pool.query('SELECT name FROM branches ORDER BY id');
    const branchNames: string[] = (branchRows || []).map((r: any) => r.name);
    if (branchNames.length === 0) {
      branchNames.push('Poblacion', 'Bypass'); // safe fallback
    }

    const branchA = branchNames[0] || 'Poblacion';
    const branchB = branchNames[1] || 'Bypass';

    const stockValues: number[] = [];
    for (const brName of branchNames) {
      let finalStock = 0;
      if (stockByBranch[brName] !== undefined) {
        finalStock = Math.max(0, Math.floor(Number(stockByBranch[brName]) || 0));
      } else if (brName === branchA && stockA !== undefined) {
        finalStock = Math.max(0, Math.floor(stockA));
      } else if (brName === branchB && stockB !== undefined) {
        finalStock = Math.max(0, Math.floor(stockB));
      }
      stockValues.push(finalStock);
    }

    if (stockValues.some((stock) => stock > overStockThreshold)) {
      throw { error: `Hindi puwedeng mag-save ng produkto na may stock na higit sa itinakdang Maximum Stock Limit (${overStockThreshold}) bawat branch. Maaaring bawasan muna ang stock o taasan ang Stock Limit.` } as ApiError;
    }

    for (const brName of branchNames) {
      let finalStock = 0;
      if (stockByBranch[brName] !== undefined) {
        finalStock = Math.max(0, Math.floor(Number(stockByBranch[brName]) || 0));
      } else if (brName === branchA && stockA !== undefined) {
        finalStock = Math.max(0, Math.floor(stockA));
      } else if (brName === branchB && stockB !== undefined) {
        finalStock = Math.max(0, Math.floor(stockB));
      }
      
      await pool.query(
        `INSERT INTO product_stock (product_id, branch, stock)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE stock = VALUES(stock)`,
        [id, brName, finalStock]
      );
    }

    // Save variants
    if (Array.isArray(body.variants)) {
      for (const v of body.variants) {
        const type = v.type;
        const label = String(v.label || '');
        const qtyPerUnit = Number(v.qtyPerUnit) || 1;
        const price = Number(v.price) || 0;
        const cost = Number(v.cost) || 0;
        const unitName = String(v.unitName || '');
        const image = v.image ? String(v.image) : null;

        await pool.query(
          `INSERT INTO product_variants (product_id, type, label, qtyPerUnit, price, cost, unitName, image)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             label = VALUES(label),
             qtyPerUnit = VALUES(qtyPerUnit),
             price = VALUES(price),
             cost = VALUES(cost),
             unitName = VALUES(unitName),
             image = VALUES(image)`,
          [id, type, label, qtyPerUnit, price, cost, unitName, image]
        );
      }

    }

    res.json({ ok: true, productId: id });
  } catch (e: any) {
    res.status(e?.error ? 400 : 500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Update product (Admin/Staff only)
router.put('/:id', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ ok: false, error: 'Missing product id.' });
    const body = req.body || {};

    const pool = getPool();
    const fields = [
      'name',
      'tagalogName',
      'category',
      'price',
      'cost',
      'batchNumber',
      'expiryDate',
      'supplierName',
      'authenticityStatus',
      'shelfLocation',
      'barcode',
      'unit',
      'lowStockThreshold',
      'overStockThreshold',
      'imagePlaceholderColor',
      'images',
    ];

    const hasProductFields = fields.some((f) => body[f] !== undefined);
    const hasStockFields = body.stockByBranch !== undefined || body.stockBranchA !== undefined || body.stockBranchB !== undefined;
    const hasVariantFields = body.variants !== undefined;
    
    if (!hasProductFields && !hasStockFields && !hasVariantFields) {
      return res.status(400).json({ ok: false, error: 'No update fields provided.' });
    }

    const setParts: string[] = [];
    const params: any[] = [];

    const add = (col: string, val: any) => {
      setParts.push(`${col} = ?`);
      params.push(val);
    };

    if (body.name !== undefined) add('name', parseString(body.name, 'name'));
    if (body.tagalogName !== undefined) add('tagalogName', body.tagalogName === null ? null : String(body.tagalogName));
    if (body.category !== undefined) add('category', parseString(body.category, 'category'));
    if (body.price !== undefined) add('price', parseNumber(body.price, 'price'));
    if (body.cost !== undefined) add('cost', parseNumber(body.cost, 'cost'));
    if (body.batchNumber !== undefined) add('batch_number', typeof body.batchNumber === 'string' && body.batchNumber.trim() ? body.batchNumber.trim() : null);
    if (body.expiryDate !== undefined) add('expiry_date', parseOptionalDate(body.expiryDate));
    if (body.supplierName !== undefined) add('supplier_name', typeof body.supplierName === 'string' && body.supplierName.trim() ? body.supplierName.trim() : null);
    if (body.authenticityStatus !== undefined) add('authenticity_status', parseAuthenticityStatus(body.authenticityStatus));
    if (body.shelfLocation !== undefined) add('shelfLocation', parseString(body.shelfLocation, 'shelfLocation'));
    if (body.barcode !== undefined) add('barcode', parseString(body.barcode, 'barcode'));
    if (body.unit !== undefined) add('unit', parseString(body.unit, 'unit'));
    if (body.lowStockThreshold !== undefined) add('lowStockThreshold', parseNumber(body.lowStockThreshold, 'lowStockThreshold'));
    if (body.overStockThreshold !== undefined) add('overStockThreshold', Math.max(1, parseNumber(body.overStockThreshold, 'overStockThreshold')));
    if (body.imagePlaceholderColor !== undefined) add('imagePlaceholderColor', body.imagePlaceholderColor === null ? null : String(body.imagePlaceholderColor));
    if (body.images !== undefined) {
      if (Array.isArray(body.images)) add('images_json', JSON.stringify(body.images));
      else add('images_json', null);
    }

    if (setParts.length > 0) {
      params.push(id);
      await pool.query(`UPDATE products SET ${setParts.join(', ')} WHERE id = ?`, params);
    }

    // Save stock row updates
    const stockByBranch = body.stockByBranch;
    const stockA = body.stockBranchA !== undefined ? Number(body.stockBranchA) : undefined;
    const stockB = body.stockBranchB !== undefined ? Number(body.stockBranchB) : undefined;

    const [branchRows]: any = await pool.query('SELECT name FROM branches ORDER BY id');
    const branchNames: string[] = (branchRows || []).map((r: any) => r.name);
    
    if (branchNames.length > 0) {
      const branchA = branchNames[0] || 'Poblacion';
      const branchB = branchNames[1] || 'Bypass';

      // Determine effective limit for validation
      let effectiveLimit: number | null = body.overStockThreshold !== undefined ? Math.max(1, parseNumber(body.overStockThreshold, 'overStockThreshold')) : null;
      if (effectiveLimit === null && hasStockFields) {
        const [prodRow]: any = await pool.query('SELECT overStockThreshold FROM products WHERE id = ? LIMIT 1', [id]);
        effectiveLimit = prodRow?.[0]?.overStockThreshold ? Number(prodRow[0].overStockThreshold) : 500;
      }

      for (const brName of branchNames) {
        let finalStock: number | undefined = undefined;
        if (stockByBranch && stockByBranch[brName] !== undefined) {
          finalStock = Math.max(0, Math.floor(Number(stockByBranch[brName]) || 0));
        } else if (brName === branchA && stockA !== undefined) {
          finalStock = Math.max(0, Math.floor(stockA));
        } else if (brName === branchB && stockB !== undefined) {
          finalStock = Math.max(0, Math.floor(stockB));
        }
        
        if (finalStock !== undefined) {
          if (effectiveLimit !== null && finalStock > effectiveLimit) {
            throw { error: `Hindi puwedeng mag-save ng stock (${finalStock}) na higit sa itinakdang limit (${effectiveLimit}) sa ${brName}. Taasan muna ang Maximum Stock Limit kung nais mag-imbak ng mas marami.` } as ApiError;
          }

          await pool.query(
            `INSERT INTO product_stock (product_id, branch, stock)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE stock = VALUES(stock)`,
            [id, brName, finalStock]
          );
        }
      }
    }

    // Save variants
    if (Array.isArray(body.variants)) {
      for (const v of body.variants) {
        const type = v.type;
        const label = String(v.label || '');
        const qtyPerUnit = Number(v.qtyPerUnit) || 1;
        const price = Number(v.price) || 0;
        const cost = Number(v.cost) || 0;
        const unitName = String(v.unitName || '');
        const image = v.image ? String(v.image) : null;

        await pool.query(
          `INSERT INTO product_variants (product_id, type, label, qtyPerUnit, price, cost, unitName, image)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             label = VALUES(label),
             qtyPerUnit = VALUES(qtyPerUnit),
             price = VALUES(price),
             cost = VALUES(cost),
             unitName = VALUES(unitName),
             image = CASE
               WHEN VALUES(image) LIKE '/uploads/%' OR VALUES(image) LIKE 'http%' OR VALUES(image) LIKE 'data:image%' THEN VALUES(image)
               WHEN image LIKE '/uploads/%' OR image LIKE 'http%' OR image LIKE 'data:image%' THEN image
               ELSE VALUES(image)
             END`,
          [id, type, label, qtyPerUnit, price, cost, unitName, image]
        );
      }

      for (const type of ['package', 'box', 'wholesale']) {
        if (!body.variants.some((variant: any) => variant.type === type)) {
          await pool.query(
            'DELETE FROM product_variants WHERE product_id = ? AND type = ?',
            [id, type]
          );
        }
      }
    }

    res.json({ ok: true });
  } catch (e: any) {
    res.status(e?.error ? 400 : 500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Delete product (Admin/Staff only)
router.delete('/:id', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const id = req.params.id;
    const pool = getPool();
    await pool.query('DELETE FROM products WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(e?.error ? 400 : 500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Upload variant images (Admin/Staff only)
router.post(
  '/:id/variant-images',
  requireAuth,
  requireRole(['admin']),
  variantImagesUpload.fields([
    { name: 'retail', maxCount: 1 },
    { name: 'package', maxCount: 1 },
    { name: 'box', maxCount: 1 },
    { name: 'wholesale', maxCount: 1 },
    { name: 'sack', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const id = req.params.id;
      if (!id) return res.status(400).json({ ok: false, error: 'Missing product id.' });

      const files = req.files as Record<string, Express.Multer.File[]> | undefined;

      const getUrl = async (key: string) => {
        const arr = files?.[key];
        if (!arr || !Array.isArray(arr) || arr.length === 0) return undefined;
        return storeImage(arr[0], 'silang-mini-mart/variant-images', 'variant-images');
      };

      const updates: Array<{ type: 'retail' | 'package' | 'box' | 'wholesale' | 'sack'; imageUrl?: string }> = [
        { type: 'retail' },
        { type: 'package' },
        { type: 'box' },
        { type: 'wholesale' },
        { type: 'sack' },
      ];

      const pool = getPool();
      const urls: Partial<Record<string, string>> = {};
      for (const u of updates) {
        const imageUrl = await getUrl(u.type);
        if (!imageUrl) continue;
        urls[u.type] = imageUrl;
        await pool.query(
          `UPDATE product_variants SET image = ? WHERE product_id = ? AND type = ?`,
          [imageUrl, id, u.type]
        );
      }

      res.json({ ok: true, urls });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
  }
);

// Bulk update product stock limits (Admin only)
router.post('/bulk-stock-limits', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const pool = getPool();
    const body = req.body || {};
    const defaultLimit = Math.max(1, parseNumber(body.limit, 'limit'));
    const category = typeof body.category === 'string' && body.category !== 'All' ? body.category : null;

    if (category) {
      await pool.query('UPDATE products SET overStockThreshold = ? WHERE category = ?', [defaultLimit, category]);
    } else {
      await pool.query('UPDATE products SET overStockThreshold = ?', [defaultLimit]);
    }

    res.json({ ok: true, limit: defaultLimit, category: category || 'All' });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

export default router;
