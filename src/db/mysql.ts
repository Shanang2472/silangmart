import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

type DbConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

function getSslOptions(host: string) {
  const certificateFile = process.env.MYSQL_SSL_CA_FILE?.trim();
  const certificate = process.env.MYSQL_SSL_CA?.replace(/\\n/g, '\n').trim();
  const ca = certificate || (certificateFile ? fs.readFileSync(path.resolve(certificateFile), 'utf8') : undefined);
  const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(host.toLowerCase());

  if (process.env.NODE_ENV === 'production' && !isLocalHost && !ca) {
    throw new Error('Production MySQL connections require MYSQL_SSL_CA or MYSQL_SSL_CA_FILE.');
  }
  return ca ? { ca, rejectUnauthorized: true } : undefined;
}

function getDbConfigFromEnv(): DbConfig {
  const host = process.env.MYSQL_HOST || 'localhost';
  const port = Number(process.env.MYSQL_PORT || 3306);
  const user = process.env.MYSQL_USER || 'root';
  const password = process.env.MYSQL_PASSWORD || '';
  const database = process.env.MYSQL_DATABASE || 'silang_mini_mart';

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid MYSQL_PORT "${process.env.MYSQL_PORT}".`);
  }
  if (process.env.NODE_ENV === 'production') {
    const missing = ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE']
      .filter((name) => !process.env[name]?.trim());
    if (missing.length) {
      throw new Error(`Production database configuration is missing: ${missing.join(', ')}.`);
    }
  }

  return { host, port, user, password, database };
}

let pool: mysql.Pool | null = null;

export function getPool() {
  if (!pool) {
    const config = getDbConfigFromEnv();
    pool = mysql.createPool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      ssl: getSslOptions(config.host),
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      // Keep dates as JS Date where possible
      dateStrings: false,
    });
  }
  return pool;
}

export async function runMigrations() {
  const config = getDbConfigFromEnv();
  
  // A. Ensure database exists
  if (process.env.NODE_ENV !== 'production') {
    const tempConnection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      ssl: getSslOptions(config.host),
    });
    try {
      await tempConnection.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\``);
    } finally {
      await tempConnection.end();
    }
  }

  const activePool = getPool();

  // B. Initialize an empty database from the schema (production never loads demo rows)
  await activePool.query('SELECT 1');
  let productsTableExists = false;
  try {
    await activePool.query(`SELECT 1 FROM products LIMIT 1`);
    productsTableExists = true;
  } catch (e) {
    // Table doesn't exist
  }

  if (!productsTableExists) {
    console.log('Database tables not found. Initializing database schema...');
    let sqlPath = path.join(process.cwd(), 'src/db/schema.sql');
    if (process.env.NODE_ENV !== 'production' && fs.existsSync(path.join(process.cwd(), 'silang_mini_mart.sql'))) {
      sqlPath = path.join(process.cwd(), 'silang_mini_mart.sql');
    }
    if (fs.existsSync(sqlPath)) {
      const sqlContent = fs.readFileSync(sqlPath, 'utf8');
      const lines = sqlContent.split('\n');
      let currentStmt = '';
      const statements: string[] = [];
      for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith('--') || line.startsWith('/*')) continue;
        currentStmt += ' ' + line;
        if (line.endsWith(';')) {
          statements.push(currentStmt.trim());
          currentStmt = '';
        }
      }
      
      const conn = await activePool.getConnection();
      try {
        await conn.beginTransaction();
        for (const stmt of statements) {
          if (stmt.startsWith('DELIMITER') || stmt.startsWith('START TRANSACTION') || stmt.startsWith('COMMIT')) continue;
          await conn.query(stmt);
        }
        await conn.commit();
        console.log('Database initialization completed successfully!');
      } catch (err: any) {
        await conn.rollback();
        console.error('Failed to initialize database tables:', err.message);
        throw err;
      } finally {
        conn.release();
      }
    } else {
      console.warn('Neither silang_mini_mart.sql nor src/db/schema.sql was found.');
    }
  }

  // C. Execute migrations
  try {
    // 1. Check if column `change` exists in `orders_transactions`
    const [columns]: any = await activePool.query(`SHOW COLUMNS FROM orders_transactions`);
    const hasChange = columns.some((col: any) => col.Field === 'change');
    const hasChangeAmount = columns.some((col: any) => col.Field === 'change_amount');

    if (hasChange && !hasChangeAmount) {
      console.log('Migrating: Renaming column `change` to `change_amount` in orders_transactions...');
      await activePool.query(`ALTER TABLE orders_transactions CHANGE COLUMN \`change\` \`change_amount\` DECIMAL(10,2) NOT NULL`);
      console.log('Migration successful!');
    }
  } catch (err) {
    // Suppress error if table does not exist yet (it will be created by seeding)
    console.log('Migration check: table orders_transactions may not exist yet.');
  }

  // 2. Create users table for Staff and Riders
  try {
    await activePool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        username VARCHAR(120) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role ENUM('admin', 'cashier', 'rider') NOT NULL,
        status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    // Clean up any trailing space in user names (e.g. 'AdminSilang ')
    console.log('Migrating: Trimming user names in users table...');
    await activePool.query('UPDATE users SET name = TRIM(name)');

    // Development convenience accounts must never be created on a public deployment.
    const [rows]: any = await activePool.query('SELECT COUNT(*) as count FROM users');
    if (rows[0].count === 0 && process.env.NODE_ENV !== 'production') {
      console.log('Seeding default staff and rider users...');
      await activePool.query(
        `INSERT INTO users (name, username, password, role, status) VALUES 
         ('AdminSilang', 'admin', 'admin', 'admin', 'active'),
         ('RiderSilang', 'rider', '1234', 'rider', 'active')`
      );
    }
  } catch (err) {
    console.error('Migration error for users table:', err);
  }

  // 3. Add pin to customers
  try {
    const [columns]: any = await activePool.query(`SHOW COLUMNS FROM customers`);
    const hasPin = columns.some((col: any) => col.Field === 'pin');
    if (!hasPin) {
      console.log('Migrating: Adding pin column to customers...');
      await activePool.query(`ALTER TABLE customers ADD COLUMN pin VARCHAR(255) NOT NULL DEFAULT '1234' AFTER phone`);
    }
    
    // Add store_image to customers
    const hasStoreImage = columns.some((col: any) => col.Field === 'store_image');
    if (!hasStoreImage) {
      console.log('Migrating: Adding store_image column to customers...');
      await activePool.query(`ALTER TABLE customers ADD COLUMN store_image VARCHAR(255) NULL DEFAULT NULL AFTER pin`);
    }
  } catch (err) {
    console.log('Migration check: table customers may not exist yet or migration failed.');
  }

  // 4. Create system_settings table
  try {
    await activePool.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        setting_key VARCHAR(120) NOT NULL UNIQUE,
        setting_value JSON NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    // Seed default settings if empty
    const [settingsRows]: any = await activePool.query('SELECT COUNT(*) as count FROM system_settings');
    if (settingsRows[0].count === 0) {
      console.log('Seeding default system settings...');
      
      const defaultCategories = [
        "Rice & Grains",
        "Canned Goods",
        "Noodles & Instant",
        "Milk & Dairy",
        "Bread & Bakery",
        "Beverages",
        "Snacks",
        "Toiletries",
        "Household",
        "Other"
      ];
      
      const defaultCoordinates = {
        Poblacion: { lat: 14.2235, lng: 120.9739 },
        Bypass: { lat: 14.2300, lng: 120.9700 }
      };

      await activePool.query(
        'INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?)',
        ['categories', JSON.stringify(defaultCategories)]
      );
      
      await activePool.query(
        'INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?)',
        ['branch_coordinates', JSON.stringify(defaultCoordinates)]
      );
    }
  } catch (err) {
    console.error('Migration error for system_settings table:', err);
  }
  // 5. Create system_notifications table
  try {
    await activePool.query(`
      CREATE TABLE IF NOT EXISTS system_notifications (
        id VARCHAR(64) PRIMARY KEY,
        type ENUM('info', 'warning', 'success', 'danger') NOT NULL,
        title VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        timestamp VARCHAR(64) NOT NULL,
        product_id VARCHAR(64) DEFAULT NULL,
        branch VARCHAR(120) DEFAULT NULL,
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);
  } catch (err) {
    console.error('Migration error for system_notifications table:', err);
  }

  // 6. Create branches table and migrate ENUM columns to VARCHAR FK

  try {
    // Create branches table
    await activePool.query(`
      CREATE TABLE IF NOT EXISTS branches (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(120) NOT NULL UNIQUE,
        address TEXT NOT NULL DEFAULT '',
        lat DOUBLE NOT NULL DEFAULT 0,
        lng DOUBLE NOT NULL DEFAULT 0,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    // Seed default branches if none exist
    const [branchRows]: any = await activePool.query('SELECT COUNT(*) as count FROM branches');
    if (branchRows[0].count === 0) {
      console.log('Seeding default branches...');
      await activePool.query(
        'INSERT INTO branches (name, address, lat, lng) VALUES (?, ?, ?, ?)',
        ['Poblacion', 'Poblacion', 14.2235, 120.9739]
      );
      await activePool.query(
        'INSERT INTO branches (name, address, lat, lng) VALUES (?, ?, ?, ?)',
        ['Bypass', 'Bypass Road', 14.2300, 120.9700]
      );
    }

    // Migrate ENUM('Poblacion','Bypass') columns to VARCHAR(120) on 6 tables
    const tablesToMigrate: { table: string; column: string }[] = [
      { table: 'product_stock', column: 'branch' },
      { table: 'orders_transactions', column: 'branch' },
      { table: 'deliveries', column: 'branch' },
      { table: 'supplier_deliveries', column: 'branch' },
      { table: 'service_transactions', column: 'branch' },
      { table: 'system_notifications', column: 'branch' },
    ];

    for (const { table, column } of tablesToMigrate) {
      try {
        const [cols]: any = await activePool.query(`SHOW COLUMNS FROM ${table} LIKE '${column}'`);
        if (cols.length > 0) {
          const colDef: string = cols[0].Type || '';
          if (colDef.toLowerCase().startsWith('enum')) {
            console.log(`Migrating: Converting ${table}.${column} from ENUM to VARCHAR(120)...`);
            // NULL-able system_notifications.branch gets NULL default; others NOT NULL
            const nullable = (table === 'system_notifications') ? 'DEFAULT NULL' : 'NOT NULL';
            await activePool.query(
              `ALTER TABLE ${table} MODIFY COLUMN ${column} VARCHAR(120) ${nullable}`
            );
            console.log(`  ✓ ${table}.${column} migrated.`);
          }
        }
      } catch (tableErr: any) {
        // Table may not exist yet — safe to skip
        console.log(`Migration skip for ${table}.${column}: ${tableErr.message}`);
      }
    }
  } catch (err) {
    console.error('Migration error for branches table:', err);
  }

  // 7. Increase product_variants.image size to 255 chars
  try {
    const [cols]: any = await activePool.query(`SHOW COLUMNS FROM product_variants LIKE 'image'`);
    if (cols.length > 0) {
      const colDef: string = cols[0].Type || '';
      if (colDef.toLowerCase().includes('varchar(40)')) {
        console.log('Migrating: Increasing product_variants.image length to VARCHAR(255)...');
        await activePool.query(`ALTER TABLE product_variants MODIFY COLUMN image VARCHAR(255) NULL`);
        console.log('  ✓ product_variants.image column enlarged.');
      }
    }
  } catch (err) {
    console.error('Migration error for product_variants.image:', err);
  }

  // 8. Add sack as a supported product variant
  try {
    const [cols]: any = await activePool.query(`SHOW COLUMNS FROM product_variants LIKE 'type'`);
    if (cols.length > 0 && !String(cols[0].Type || '').toLowerCase().includes("'sack'")) {
      console.log('Migrating: Adding sack to product_variants.type...');
      await activePool.query(
        `ALTER TABLE product_variants MODIFY COLUMN type ENUM('retail','package','box','wholesale','sack') NOT NULL`
      );
      console.log('  ✓ product_variants.type now supports sack.');
    }
  } catch (err) {
    console.error('Migration error for product_variants.type:', err);
  }

  // 9. Delivery/payment split migration (deliveries.status -> delivery_status + add payment fields)
  try {
    const [cols]: any = await activePool.query(`SHOW COLUMNS FROM deliveries`);
    const hasDeliveryStatus = cols.some((c: any) => c.Field === 'delivery_status');
    const hasOldStatus = cols.some((c: any) => c.Field === 'status');
    const hasPaymentStatus = cols.some((c: any) => c.Field === 'payment_status');

    if (!hasDeliveryStatus && hasOldStatus) {
      console.log('Migrating: Renaming deliveries.status -> deliveries.delivery_status...');
      await activePool.query(
        `ALTER TABLE deliveries CHANGE COLUMN \`status\` \`delivery_status\` ENUM('Pending','Preparing','Out for Delivery','Delivered','Cancelled') NOT NULL`
      );
    }

    if (!hasPaymentStatus) {
      await activePool.query(
        `ALTER TABLE deliveries ADD COLUMN payment_method ENUM('Cash','GCash','Maya') NOT NULL DEFAULT 'Cash'`
      );
      await activePool.query(
        `ALTER TABLE deliveries ADD COLUMN payment_status ENUM('Pending','Awaiting Verification','Paid','Failed','Refunded') NOT NULL DEFAULT 'Pending'`
      );
      await activePool.query(`ALTER TABLE deliveries ADD COLUMN payment_reference VARCHAR(120) NULL`);
      await activePool.query(`ALTER TABLE deliveries ADD COLUMN payment_amount DECIMAL(10,2) NULL`);
      await activePool.query(`ALTER TABLE deliveries ADD COLUMN paid_at TIMESTAMP NULL`);
      await activePool.query(`ALTER TABLE deliveries ADD COLUMN payment_failed_reason VARCHAR(255) NULL`);
      await activePool.query(`ALTER TABLE deliveries ADD COLUMN cod_amount_received DECIMAL(10,2) NULL`);
      await activePool.query(`ALTER TABLE deliveries ADD COLUMN cod_collected_by VARCHAR(120) NULL`);
      await activePool.query(`ALTER TABLE deliveries ADD COLUMN cod_collected_at TIMESTAMP NULL`);
      await activePool.query(`ALTER TABLE deliveries ADD COLUMN order_txn_id VARCHAR(64) NULL`);
    }
  } catch (err) {
    console.log('Migration skip/error for deliveries payment split:', (err as any)?.message || String(err));
  }

  // 9. Store customer-uploaded GCash payment proof
  try {
    const [cols]: any = await activePool.query(`SHOW COLUMNS FROM deliveries LIKE 'payment_proof_url'`);
    if (cols.length === 0) {
      await activePool.query(`ALTER TABLE deliveries ADD COLUMN payment_proof_url VARCHAR(255) NULL AFTER payment_amount`);
      console.log('  ✓ GCash payment proof column added.');
    }
  } catch (err) {
    console.error('Migration error for GCash payment proof:', err);
  }

  // 9. Add Proof of Delivery (POD) columns to deliveries table
  try {
    const [cols]: any = await activePool.query(`SHOW COLUMNS FROM deliveries`);
    const hasPodPhotoUrl = cols.some((c: any) => c.Field === 'pod_photo_url');
    const hasDeliveredAt = cols.some((c: any) => c.Field === 'delivered_at');
    const hasHandoverConfirmed = cols.some((c: any) => c.Field === 'handover_confirmed');

    if (!hasPodPhotoUrl) {
      console.log('Migrating: Adding pod_photo_url column to deliveries...');
      await activePool.query(`ALTER TABLE deliveries ADD COLUMN pod_photo_url VARCHAR(255) NULL`);
      await activePool.query(`ALTER TABLE deliveries ADD COLUMN pod_uploaded_by VARCHAR(120) NULL`);
      await activePool.query(`ALTER TABLE deliveries ADD COLUMN pod_uploaded_at TIMESTAMP NULL`);
      console.log('  ✓ POD photo columns added.');
    }
    if (!hasDeliveredAt) {
      console.log('Migrating: Adding delivered_at column to deliveries...');
      await activePool.query(`ALTER TABLE deliveries ADD COLUMN delivered_at TIMESTAMP NULL`);
      console.log('  ✓ delivered_at column added.');
    }
    if (!hasHandoverConfirmed) {
      console.log('Migrating: Adding handover_confirmed column to deliveries...');
      await activePool.query(`ALTER TABLE deliveries ADD COLUMN handover_confirmed TINYINT(1) NOT NULL DEFAULT 0`);
      console.log('  ✓ handover_confirmed column added.');
    }
  } catch (err) {
    console.log('Migration skip/error for POD columns:', (err as any)?.message || String(err));
  }

  // 10. Add customer order archive and recycle-bin columns
  try {
    const [cols]: any = await activePool.query(`SHOW COLUMNS FROM deliveries`);
    const hasArchivedAt = cols.some((c: any) => c.Field === 'archived_at');
    const hasDeletedAt = cols.some((c: any) => c.Field === 'deleted_at');
    if (!hasArchivedAt) await activePool.query(`ALTER TABLE deliveries ADD COLUMN archived_at TIMESTAMP NULL`);
    if (!hasDeletedAt) await activePool.query(`ALTER TABLE deliveries ADD COLUMN deleted_at TIMESTAMP NULL`);
  } catch (err) {
    console.log('Migration skip/error for delivery archive columns:', (err as any)?.message || String(err));
  }

  // 11. Create role-scoped notifications table
  try {
    await activePool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id          VARCHAR(64)   NOT NULL PRIMARY KEY,
        user_id     VARCHAR(120)  NOT NULL,
        role        ENUM('admin','customer','rider','supplier') NOT NULL,
        type        ENUM('info','warning','success','danger') NOT NULL DEFAULT 'info',
        category    ENUM('orders','delivery','payment','inventory','account','system','security') NOT NULL DEFAULT 'system',
        title       VARCHAR(255)  NOT NULL,
        message     TEXT          NOT NULL,
        entity_type VARCHAR(64)   NULL,
        entity_id   VARCHAR(64)   NULL,
        action_url  VARCHAR(255)  NULL,
        is_read     TINYINT(1)    NOT NULL DEFAULT 0,
        read_at     TIMESTAMP     NULL,
        created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
        updated_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_role (user_id, role),
        INDEX idx_unread (user_id, is_read),
        INDEX idx_entity (entity_type, entity_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);
    console.log('Migration 10: notifications table ready.');
  } catch (err) {
    console.error('Migration error for notifications table:', err);
  }

  // 11. Create notification_preferences table
  try {
    await activePool.query(`
      CREATE TABLE IF NOT EXISTS notification_preferences (
        id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id           VARCHAR(120) NOT NULL,
        role              VARCHAR(32)  NOT NULL,
        notifications_on  TINYINT(1)  NOT NULL DEFAULT 1,
        sounds_on         TINYINT(1)  NOT NULL DEFAULT 1,
        new_order_sound   TINYINT(1)  NOT NULL DEFAULT 1,
        delivery_sound    TINYINT(1)  NOT NULL DEFAULT 1,
        payment_sound     TINYINT(1)  NOT NULL DEFAULT 1,
        inventory_sound   TINYINT(1)  NOT NULL DEFAULT 1,
        critical_sound    TINYINT(1)  NOT NULL DEFAULT 1,
        created_at        TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
        updated_at        TIMESTAMP   DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_notification_user_role (user_id, role)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);
    console.log('Migration 11: notification_preferences table ready.');
  } catch (err) {
    console.error('Migration error for notification_preferences table:', err);
  }

  // 12. Add overStockThreshold to products and seed default_stock_limit
  try {
    const [cols]: any = await activePool.query(`SHOW COLUMNS FROM products LIKE 'overStockThreshold'`);
    if (cols.length === 0) {
      console.log('Migrating: Adding overStockThreshold column to products...');
      await activePool.query(
        `ALTER TABLE products ADD COLUMN overStockThreshold INT NOT NULL DEFAULT 500 AFTER lowStockThreshold`
      );
      console.log('  ✓ overStockThreshold column added to products.');
    }

    const [settings]: any = await activePool.query(
      `SELECT setting_value FROM system_settings WHERE setting_key = 'default_stock_limit'`
    );
    if (!settings || settings.length === 0) {
      await activePool.query(
        `INSERT INTO system_settings (setting_key, setting_value) VALUES ('default_stock_limit', ?)`,
        [JSON.stringify(500)]
      );
      console.log('  ✓ default_stock_limit setting seeded in system_settings.');
    }
  } catch (err) {
    console.error('Migration error for overStockThreshold in products:', err);
  }

  // 13. Add a server timestamp for verified live rider GPS updates
  try {
    const [cols]: any = await activePool.query(`SHOW COLUMNS FROM deliveries LIKE 'driver_location_updated_at'`);
    if (cols.length === 0) {
      await activePool.query(`ALTER TABLE deliveries ADD COLUMN driver_location_updated_at TIMESTAMP NULL`);
      console.log('  ✓ deliveries.driver_location_updated_at column added.');
    }
  } catch (err) {
    console.error('Migration error for live delivery location timestamp:', err);
  }

  // 14. Store reported accuracy for each browser GPS fix
  try {
    const [cols]: any = await activePool.query(`SHOW COLUMNS FROM deliveries LIKE 'driver_location_accuracy_m'`);
    if (cols.length === 0) {
      await activePool.query(`ALTER TABLE deliveries ADD COLUMN driver_location_accuracy_m DOUBLE NULL`);
      console.log('  ✓ deliveries.driver_location_accuracy_m column added.');
    }
  } catch (err) {
    console.error('Migration error for live delivery GPS accuracy:', err);
  }

  // 15. Add product traceability and VAT reporting fields.
  try {
    const [productCols]: any = await activePool.query(`SHOW COLUMNS FROM products`);
    const productFields = new Set(productCols.map((column: any) => column.Field));
    if (!productFields.has('batch_number')) {
      await activePool.query(`ALTER TABLE products ADD COLUMN batch_number VARCHAR(120) NULL AFTER cost`);
    }
    if (!productFields.has('expiry_date')) {
      await activePool.query(`ALTER TABLE products ADD COLUMN expiry_date DATE NULL AFTER batch_number`);
    }
    if (!productFields.has('supplier_name')) {
      await activePool.query(`ALTER TABLE products ADD COLUMN supplier_name VARCHAR(160) NULL AFTER expiry_date`);
    }
    if (!productFields.has('authenticity_status')) {
      await activePool.query(`ALTER TABLE products ADD COLUMN authenticity_status ENUM('unverified','verified','rejected') NOT NULL DEFAULT 'unverified' AFTER supplier_name`);
    }

    const [transactionCols]: any = await activePool.query(`SHOW COLUMNS FROM orders_transactions LIKE 'vat_amount'`);
    if (transactionCols.length === 0) {
      await activePool.query(`ALTER TABLE orders_transactions ADD COLUMN vat_amount DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER discountAmount`);
    }
    console.log('Migration 15: product traceability and VAT fields ready.');
  } catch (err) {
    console.error('Migration error for product traceability/VAT fields:', err);
  }

  // 16. Ensure notifications are isolated by both account and role.
  try {
    const [notificationRole]: any = await activePool.query(`SHOW COLUMNS FROM notifications LIKE 'role'`);
    if (notificationRole[0] && !String(notificationRole[0].Type).includes('supplier')) {
      await activePool.query(
        `ALTER TABLE notifications MODIFY COLUMN role ENUM('admin','customer','rider','supplier') NOT NULL`
      );
    }

    const [prefIndexes]: any = await activePool.query(`SHOW INDEX FROM notification_preferences`);
    if (prefIndexes.some((index: any) => index.Key_name === 'user_id' && Number(index.Non_unique) === 0)) {
      await activePool.query(`ALTER TABLE notification_preferences DROP INDEX user_id`);
    }
    if (!prefIndexes.some((index: any) => index.Key_name === 'uniq_notification_user_role')) {
      await activePool.query(
        `ALTER TABLE notification_preferences ADD UNIQUE KEY uniq_notification_user_role (user_id, role)`
      );
    }
    console.log('Migration 16: role-scoped notification storage ready.');
  } catch (err) {
    console.error('Migration error for role-scoped notifications:', err);
  }
}
