-- Silang Mini Mart - MySQL schema
-- Run this against your configured database (MYSQL_DATABASE)

CREATE TABLE IF NOT EXISTS customers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  phone VARCHAR(30) NOT NULL,
  pin VARCHAR(255) NOT NULL DEFAULT '1234',
  store_image VARCHAR(255) NULL,
  password_hash VARCHAR(255) NULL,
  barangay VARCHAR(100) NOT NULL,
  address TEXT NOT NULL,
  lat DOUBLE NOT NULL,
  lng DOUBLE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  tagalogName VARCHAR(160) NULL,
  category VARCHAR(120) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  cost DECIMAL(10,2) NOT NULL,
  batch_number VARCHAR(120) NULL,
  expiry_date DATE NULL,
  supplier_name VARCHAR(160) NULL,
  authenticity_status ENUM('unverified','verified','rejected') NOT NULL DEFAULT 'unverified',
  shelfLocation VARCHAR(200) NOT NULL,
  barcode VARCHAR(64) NOT NULL UNIQUE,
  unit ENUM('kg','can','pack','bottle','pc','bag') NOT NULL,
  lowStockThreshold INT NOT NULL,
  overStockThreshold INT NOT NULL DEFAULT 500,
  imagePlaceholderColor VARCHAR(20) NULL,
  images_json TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);



CREATE TABLE IF NOT EXISTS product_variants (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id VARCHAR(64) NOT NULL,
  type ENUM('retail','package','box','wholesale','sack') NOT NULL,
  label VARCHAR(200) NOT NULL,
  qtyPerUnit INT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  cost DECIMAL(10,2) NOT NULL,
  unitName VARCHAR(40) NOT NULL,
  image VARCHAR(40) NULL,
  UNIQUE KEY uniq_product_variant (product_id, type),
  CONSTRAINT fk_variants_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS product_stock (
  product_id VARCHAR(64) NOT NULL,
  branch ENUM('Poblacion','Bypass') NOT NULL,
  stock INT NOT NULL,
  PRIMARY KEY (product_id, branch),
  CONSTRAINT fk_stock_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS orders_transactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  txn_id VARCHAR(64) NOT NULL UNIQUE,
  branch ENUM('Poblacion','Bypass') NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  discountType ENUM('none','senior','pwd','percentage') NOT NULL,
  discountAmount DECIMAL(10,2) NOT NULL,
  vat_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  paymentMethod ENUM('Cash','GCash','Maya') NOT NULL,
  amountPaid DECIMAL(10,2) NOT NULL,
  change_amount DECIMAL(10,2) NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  cashier VARCHAR(120) NOT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders_transaction_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  txn_pk BIGINT UNSIGNED NOT NULL,
  product_id VARCHAR(64) NOT NULL,
  name VARCHAR(200) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  quantity INT NOT NULL,
  unit VARCHAR(40) NOT NULL,
  CONSTRAINT fk_txn_items FOREIGN KEY (txn_pk) REFERENCES orders_transactions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS deliveries (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  delivery_id VARCHAR(64) NOT NULL UNIQUE,
  branch ENUM('Poblacion','Bypass') NOT NULL,
  customer_name VARCHAR(120) NOT NULL,
  customer_phone VARCHAR(30) NOT NULL,
  address TEXT NOT NULL,
  barangay VARCHAR(100) NOT NULL,
  lat DOUBLE NOT NULL,
  lng DOUBLE NOT NULL,

  -- Delivery lifecycle
  delivery_status ENUM('Pending','Preparing','Out for Delivery','Delivered','Cancelled') NOT NULL,

  -- Payment lifecycle (separate from delivery)
  payment_method ENUM('Cash','GCash','Maya') NOT NULL DEFAULT 'Cash',
  payment_status ENUM('Pending','Awaiting Verification','Paid','Failed','Refunded') NOT NULL DEFAULT 'Pending',
  payment_reference VARCHAR(120) NULL,
  payment_amount DECIMAL(10,2) NULL,
  payment_proof_url VARCHAR(255) NULL,
  paid_at TIMESTAMP NULL,
  payment_failed_reason VARCHAR(255) NULL,

  -- COD-specific
  cod_amount_received DECIMAL(10,2) NULL,
  cod_collected_by VARCHAR(120) NULL,
  cod_collected_at TIMESTAMP NULL,

  -- Optional link to POS checkout transaction
  order_txn_id VARCHAR(64) NULL,

  delivery_fee DECIMAL(10,2) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,

  driver_name VARCHAR(120) NOT NULL,
  driver_lat DOUBLE NOT NULL,
  driver_lng DOUBLE NOT NULL,
  driver_location_updated_at TIMESTAMP NULL,
  driver_location_accuracy_m DOUBLE NULL,
  eta_minutes INT NOT NULL,
  notes TEXT NULL,
  timestamp TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  archived_at TIMESTAMP NULL,
  deleted_at TIMESTAMP NULL
);


CREATE TABLE IF NOT EXISTS delivery_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  delivery_pk BIGINT UNSIGNED NOT NULL,
  product_id VARCHAR(64) NOT NULL,
  name VARCHAR(200) NOT NULL,
  quantity INT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  CONSTRAINT fk_delivery_items FOREIGN KEY (delivery_pk) REFERENCES deliveries(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS supplier_deliveries (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  supplier_delivery_id VARCHAR(64) NOT NULL UNIQUE,
  supplier_name VARCHAR(160) NOT NULL,
  branch ENUM('Poblacion','Bypass') NOT NULL,
  delivery_date DATE NOT NULL,
  total_cost DECIMAL(10,2) NOT NULL,
  status ENUM('Pending','Received') NOT NULL,
  received_by VARCHAR(120) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS supplier_delivery_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  supplier_delivery_pk BIGINT UNSIGNED NOT NULL,
  product_id VARCHAR(64) NOT NULL,
  product_name VARCHAR(200) NOT NULL,
  quantity INT NOT NULL,
  cost DECIMAL(10,2) NOT NULL,
  CONSTRAINT fk_supplier_delivery_items FOREIGN KEY (supplier_delivery_pk) REFERENCES supplier_deliveries(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS service_transactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  service_txn_id VARCHAR(64) NOT NULL UNIQUE,
  branch ENUM('Poblacion','Bypass') NOT NULL,
  type ENUM('E-Load','Bills Payment','Remittance') NOT NULL,
  provider VARCHAR(160) NOT NULL,
  recipient VARCHAR(120) NOT NULL,
  sender_or_account_name VARCHAR(160) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  service_fee DECIMAL(10,2) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  status ENUM('Completed','Pending','Failed') NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- NOTE: Notifications/system settings are still handled client-side for now.
