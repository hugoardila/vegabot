const crypto = require("crypto");
const mysql = require("mysql2/promise");
const { readSaintInventory } = require("./saintInventory");
const {
  getRetailPrice,
  getWholesalePolicy,
  getWholesalePrice,
  priceBotCart
} = require("./pricingPolicy");

const config = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "vegabot",
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
  charset: "utf8mb4"
};

const serverConfig = { ...config };
delete serverConfig.database;

let pool;
let initialized = false;
let lastSaintMirrorVersion = 0;
let lastSaintMirrorResult = null;
let saintMirrorPromise = null;

const SAINT_MIRROR_CHUNK_SIZE = 150;

function encode(value) {
  return JSON.stringify(value ?? null);
}

function decode(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizePhone(value) {
  const raw = String(value || "").replace("whatsapp:", "").trim();
  if (!raw) return "";
  return raw.startsWith("+") ? raw : `+${raw.replace(/\D/g, "")}`;
}

function getDefaultCategoryIcon(name) {
  const normalized = String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  if (/DIADEMA|MANOS LIBRE|AUDIFONO/.test(normalized)) return "\u{1F3A7}";
  if (/MICROFONO/.test(normalized)) return "\u{1F3A4}";
  if (/PARLANTE|CABINA|HOPESTAR|JBL|SONIVOX/.test(normalized)) return "\u{1F50A}";
  if (/RADIO/.test(normalized)) return "\u{1F4FB}";
  if (/CAMARA|SEGURIDAD/.test(normalized)) return "\u{1F4F9}";
  if (/ANTENA/.test(normalized)) return "\u{1F4E1}";
  if (/TV|TELEVISION/.test(normalized)) return "\u{1F4FA}";
  if (/RELOJ|SMARTWATCH/.test(normalized)) return "\u{231A}";
  if (/POWER BANK|BATERIA/.test(normalized)) return "\u{1F50B}";
  if (/CARGADOR|CABEZA|PLUYIN/.test(normalized)) return "\u{1F50C}";
  if (/CABLE/.test(normalized)) return "\u{1F517}";
  if (/BOMBILLO|ILUMINACION/.test(normalized)) return "\u{1F4A1}";
  if (/LINTERNA/.test(normalized)) return "\u{1F526}";
  if (/HOLDER|SOPORTE|SAMSUNG|CELULAR/.test(normalized)) return "\u{1F4F1}";
  if (/ACCE PC|COMPUTADOR|MOUSE|TECLADO/.test(normalized)) return "\u{1F5A5}\uFE0F";
  if (/BECK PLAY|CONTROL/.test(normalized)) return "\u{1F3AE}";
  if (/BELLEZA|VGR/.test(normalized)) return "\u{2728}";
  if (/ORIGINAL/.test(normalized)) return "\u{2705}";
  if (/DEPARTAMENTO|HOGAR|OFICINA/.test(normalized)) return "\u{1F3E2}";
  return "\u{1F4E6}";
}

async function getPool() {
  await init();
  return pool;
}

async function init() {
  if (initialized) return;
  const server = await mysql.createConnection(serverConfig);
  await server.query("CREATE DATABASE IF NOT EXISTS vegabot CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
  await server.end();

  pool = mysql.createPool(config);
  await createSchema();
  initialized = true;
}

async function createSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      \`key\` VARCHAR(120) PRIMARY KEY,
      value LONGTEXT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id VARCHAR(120) PRIMARY KEY,
      name VARCHAR(180) NOT NULL UNIQUE,
      margin INT NOT NULL DEFAULT 0,
      icon VARCHAR(64) NOT NULL DEFAULT ''
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS brands (
      name VARCHAR(180) PRIMARY KEY
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id VARCHAR(120) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      category VARCHAR(180) NOT NULL,
      brand VARCHAR(180) NOT NULL,
      stock INT NOT NULL DEFAULT 0,
      wholesale_price INT NOT NULL DEFAULT 0,
      retail_price INT NOT NULL DEFAULT 0,
      price_3 INT NOT NULL DEFAULT 0,
      warranty VARCHAR(120) NOT NULL DEFAULT '',
      status VARCHAR(80) NOT NULL DEFAULT 'Disponible',
      deposito VARCHAR(180) NOT NULL DEFAULT '',
      puesto VARCHAR(180) NOT NULL DEFAULT '',
      source VARCHAR(180) NOT NULL DEFAULT '',
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_products_category (category),
      INDEX idx_products_brand (brand),
      INDEX idx_products_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS store_subcategories (
      id VARCHAR(120) PRIMARY KEY,
      category_name VARCHAR(180) NOT NULL,
      name VARCHAR(180) NOT NULL,
      icon VARCHAR(64) NOT NULL DEFAULT '',
      sort_order INT NOT NULL DEFAULT 0,
      enabled TINYINT(1) NOT NULL DEFAULT 1,
      classification_source VARCHAR(20) NOT NULL DEFAULT 'auto',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_store_subcategory_category_name (category_name, name),
      INDEX idx_store_subcategory_category (category_name, enabled, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS store_category_names (
      category_id VARCHAR(120) PRIMARY KEY,
      display_name VARCHAR(180) NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS product_subcategory_assignments (
      product_id VARCHAR(120) PRIMARY KEY,
      subcategory_id VARCHAR(120) NULL,
      assignment_source VARCHAR(20) NOT NULL DEFAULT 'manual',
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_product_subcategory_assignment (subcategory_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id VARCHAR(120) PRIMARY KEY,
      name VARCHAR(180) NOT NULL,
      phone VARCHAR(60) NOT NULL,
      company VARCHAR(180) NOT NULL DEFAULT '',
      type VARCHAR(80) NOT NULL DEFAULT 'Mayorista',
      status VARCHAR(80) NOT NULL DEFAULT 'Atencion bot',
      last_message TEXT,
      assigned_to VARCHAR(120) NOT NULL DEFAULT 'Sin asignar',
      tags_json LONGTEXT NOT NULL,
      last_contact VARCHAR(80) NOT NULL DEFAULT '',
      UNIQUE KEY uq_customers_phone (phone),
      INDEX idx_customers_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await ensureColumn("customers", "bot_stage", "VARCHAR(80) NOT NULL DEFAULT 'lead_new'");
  await ensureColumn("customers", "active_order_id", "VARCHAR(120) NOT NULL DEFAULT ''");
  await ensureColumn("customers", "bot_memory_json", "LONGTEXT NULL");
  await ensureColumn("customers", "manual_attention", "TINYINT(1) NOT NULL DEFAULT 0");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      customer_id VARCHAR(120) NOT NULL,
      sender VARCHAR(40) NOT NULL,
      text TEXT,
      message_type VARCHAR(40) NOT NULL DEFAULT 'text',
      media_url TEXT,
      media_name VARCHAR(255) NOT NULL DEFAULT '',
      media_meta VARCHAR(255) NOT NULL DEFAULT '',
      time VARCHAR(40) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_conversations_customer (customer_id),
      INDEX idx_conversations_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id VARCHAR(120) PRIMARY KEY,
      customer_id VARCHAR(120) NOT NULL,
      customer_name VARCHAR(180) NOT NULL,
      phone VARCHAR(60) NOT NULL,
      items_json LONGTEXT NOT NULL,
      subtotal INT NOT NULL DEFAULT 0,
      freight INT NOT NULL DEFAULT 0,
      total INT NOT NULL DEFAULT 0,
      status VARCHAR(80) NOT NULL,
      payment_status VARCHAR(80) NOT NULL,
      dispatch_json LONGTEXT NOT NULL,
      created_at VARCHAR(80) NOT NULL,
      channel VARCHAR(60) NOT NULL DEFAULT 'whatsapp',
      source VARCHAR(60) NOT NULL DEFAULT 'bot',
      bot_status VARCHAR(80) NOT NULL DEFAULT 'confirmado_por_bot',
      validation_status VARCHAR(80) NOT NULL DEFAULT 'pendiente_validacion',
      priority VARCHAR(40) NOT NULL DEFAULT 'normal',
      customer_company VARCHAR(180) NOT NULL DEFAULT '',
      customer_city VARCHAR(120) NOT NULL DEFAULT '',
      delivery_address VARCHAR(255) NOT NULL DEFAULT '',
      requested_text TEXT,
      notes TEXT,
      internal_notes TEXT,
      confirmed_at VARCHAR(80) NOT NULL DEFAULT '',
      validated_at VARCHAR(80) NOT NULL DEFAULT '',
      dispatched_at VARCHAR(80) NOT NULL DEFAULT '',
      inventory_deducted TINYINT(1) NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_orders_status (status),
      INDEX idx_orders_validation (validation_status),
      INDEX idx_orders_phone (phone)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await ensureColumn("orders", "inventory_deducted", "TINYINT(1) NOT NULL DEFAULT 0");
  await ensureColumn("orders", "customer_document", "VARCHAR(60) NOT NULL DEFAULT ''");
  await ensureColumn("orders", "contact_phone", "VARCHAR(60) NOT NULL DEFAULT ''");
  await ensureColumn("orders", "delivery_type", "VARCHAR(120) NOT NULL DEFAULT ''");
  await ensureColumn("products", "price_3", "INT NOT NULL DEFAULT 0");
  await ensureColumn("products", "store_description", "LONGTEXT NULL");
  await ensureColumn("products", "bot_features", "LONGTEXT NULL");
  await ensureColumn("products", "cost", "INT NOT NULL DEFAULT 0");
  await ensureColumn("products", "reference", "VARCHAR(255) NOT NULL DEFAULT ''");
  await ensureColumn("products", "unit", "VARCHAR(80) NOT NULL DEFAULT ''");
  await ensureColumn("products", "barcodes", "LONGTEXT NULL");
  await ensureColumn("products", "free_shipping", "TINYINT(1) NOT NULL DEFAULT 0");
  await ensureColumn("products", "promotion_enabled", "TINYINT(1) NOT NULL DEFAULT 0");
  await ensureColumn("products", "promotion_percent", "DECIMAL(5,2) NOT NULL DEFAULT 0");
  await ensureColumn("products", "store_enabled", "TINYINT(1) NOT NULL DEFAULT 1");
  await ensureColumn("categories", "icon", "VARCHAR(64) NOT NULL DEFAULT ''");
  await ensureColumn("store_subcategories", "classification_source", "VARCHAR(20) NOT NULL DEFAULT 'auto'");
  await pool.query("UPDATE products SET store_enabled = 0 WHERE stock <= 0 AND store_enabled <> 0");
  const [categoryIconRows] = await pool.query("SELECT id, name, icon FROM categories");
  for (const category of categoryIconRows) {
    if (String(category.icon || "").trim()) continue;
    await pool.query("UPDATE categories SET icon = ? WHERE id = ?", [
      getDefaultCategoryIcon(category.name),
      category.id
    ]);
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS product_store_names (
      product_id VARCHAR(120) PRIMARY KEY,
      store_name VARCHAR(255) NOT NULL DEFAULT 'SIN NOMBRE',
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      order_id VARCHAR(120) NOT NULL,
      product_id VARCHAR(120) NOT NULL,
      product_name VARCHAR(255) NOT NULL,
      category VARCHAR(180) NOT NULL DEFAULT '',
      brand VARCHAR(180) NOT NULL DEFAULT '',
      qty INT NOT NULL DEFAULT 1,
      unit_price INT NOT NULL DEFAULT 0,
      line_total INT NOT NULL DEFAULT 0,
      stock_snapshot INT NOT NULL DEFAULT 0,
      deposito VARCHAR(180) NOT NULL DEFAULT '',
      puesto VARCHAR(180) NOT NULL DEFAULT '',
      status VARCHAR(80) NOT NULL DEFAULT 'pendiente_validacion',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_order_items_order (order_id),
      INDEX idx_order_items_product (product_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory_reservations (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      order_id VARCHAR(120) NOT NULL,
      product_id VARCHAR(120) NOT NULL,
      qty INT NOT NULL DEFAULT 0,
      status VARCHAR(40) NOT NULL DEFAULT 'active',
      source VARCHAR(60) NOT NULL DEFAULT 'bot',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_inventory_reservation_order_product (order_id, product_id),
      INDEX idx_inventory_reservation_product_status (product_id, status),
      INDEX idx_inventory_reservation_order (order_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS carts (
      customer_id VARCHAR(120) PRIMARY KEY,
      status VARCHAR(40) NOT NULL DEFAULT 'active',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cart_items (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      customer_id VARCHAR(120) NOT NULL,
      product_id VARCHAR(120) NOT NULL,
      product_name VARCHAR(255) NOT NULL,
      category VARCHAR(180) NOT NULL DEFAULT '',
      brand VARCHAR(180) NOT NULL DEFAULT '',
      qty INT NOT NULL DEFAULT 1,
      unit_price INT NOT NULL DEFAULT 0,
      line_total INT NOT NULL DEFAULT 0,
      wholesale_price_snapshot INT NOT NULL DEFAULT 0,
      retail_price_snapshot INT NOT NULL DEFAULT 0,
      price_tier VARCHAR(20) NOT NULL DEFAULT 'detal',
      stock_snapshot INT NOT NULL DEFAULT 0,
      deposito VARCHAR(180) NOT NULL DEFAULT '',
      puesto VARCHAR(180) NOT NULL DEFAULT '',
      status VARCHAR(80) NOT NULL DEFAULT 'pendiente_validacion',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_cart_customer_product (customer_id, product_id),
      INDEX idx_cart_items_customer (customer_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await ensureColumn("cart_items", "wholesale_price_snapshot", "INT NOT NULL DEFAULT 0");
  await ensureColumn("cart_items", "retail_price_snapshot", "INT NOT NULL DEFAULT 0");
  await ensureColumn("cart_items", "price_tier", "VARCHAR(20) NOT NULL DEFAULT 'detal'");
  await ensureColumn("cart_items", "free_shipping", "TINYINT(1) NOT NULL DEFAULT 0");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS payment_validations (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      order_id VARCHAR(120) NOT NULL,
      customer_id VARCHAR(120) NOT NULL,
      customer_phone VARCHAR(60) NOT NULL,
      validator_phone VARCHAR(60) NOT NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'pendiente',
      proof_text TEXT,
      media_url TEXT,
      media_type VARCHAR(120) NOT NULL DEFAULT '',
      requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      validated_at VARCHAR(80) NOT NULL DEFAULT '',
      INDEX idx_payment_validations_status (status),
      INDEX idx_payment_validations_validator (validator_phone),
      INDEX idx_payment_validations_order (order_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS saint_invoice_queue (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      source VARCHAR(30) NOT NULL,
      order_id VARCHAR(120) NOT NULL,
      payload_json LONGTEXT NOT NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'pending',
      attempts INT NOT NULL DEFAULT 0,
      notification_attempts INT NOT NULL DEFAULT 0,
      invoice_type VARCHAR(10) NOT NULL DEFAULT 'G',
      invoice_number VARCHAR(40) NOT NULL DEFAULT '',
      last_error TEXT,
      last_attempt_at DATETIME NULL,
      next_attempt_at DATETIME NULL,
      invoice_created_at DATETIME NULL,
      notified_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_saint_invoice_source_order (source, order_id),
      INDEX idx_saint_invoice_queue_status (status),
      INDEX idx_saint_invoice_queue_next_attempt (next_attempt_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await seedAutomaticProductSubcategories(pool, await selectLocalProducts(pool));
}

async function ensureColumn(table, column, definition) {
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  if (!rows.length) {
    await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function chunks(items, size = SAINT_MIRROR_CHUNK_SIZE) {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

async function loadSettings(db) {
  const [settingRows] = await db.query("SELECT `key`, value FROM settings");
  return settingRows.reduce((acc, row) => {
    acc[row.key] = decode(row.value, row.value);
    return acc;
  }, {});
}

async function selectLocalProducts(db) {
  const [products] = await db.query(
    `SELECT id, name, category, brand, stock,
      wholesale_price AS price1, retail_price AS price2, price_3 AS price3,
      wholesale_price AS wholesalePrice, retail_price AS retailPrice,
      cost, reference, unit, barcodes,
      warranty, status, deposito, puesto, source,
      store_description AS storeDescription,
      bot_features AS botFeatures,
      free_shipping AS freeShipping,
      promotion_enabled AS promotionEnabled,
      promotion_percent AS promotionPercent,
      store_enabled AS storeEnabled,
      updated_at AS updatedAt
     FROM products ORDER BY category, brand, name`
  );
  return products;
}

const AUTO_SUBCATEGORY_RULES = [
  { name: "Power banks", icon: "🔋", pattern: /\bpower\s*bank\b|bateria externa|cargador portatil/ },
  { name: "Cabezas de carga", icon: "🔌", pattern: /\bcabeza\b|cubo de carga|adaptador de carga/ },
  { name: "Cargadores", icon: "⚡", pattern: /\bcargador(?:es)?\b|carga rapida|charger/ },
  { name: "Cables y conectividad", icon: "🔗", pattern: /\bcable(?:s)?\b|cordon|pluyin|plug|jack|conector/ },
  { name: "Cabinas", icon: "🔊", pattern: /\bcabina(?:s)?\b/ },
  { name: "Parlantes", icon: "🔊", pattern: /\bparlante(?:s)?\b|speaker|boom(?:s)?box/ },
  { name: "Diademas", icon: "🎧", pattern: /\bdiadema(?:s)?\b|headphone/ },
  { name: "Manos libres", icon: "🎧", pattern: /manos? libre|\bml\b|airpods?|audifono|auricular/ },
  { name: "Radios", icon: "📻", pattern: /\bradio(?:s)?\b|rabio/ },
  { name: "Microfonos", icon: "🎙️", pattern: /microfono|solapa/ },
  { name: "Soportes y holders", icon: "📱", pattern: /\bholder\b|soporte.*(?:cel|telefono|movil)|base.*(?:cel|telefono|movil)/ },
  { name: "Bases para TV", icon: "📺", pattern: /base.*\btv\b|soporte.*\btv\b/ },
  { name: "TV y streaming", icon: "📺", pattern: /tv\s*(?:stick|box)|android\s*tv|chromecast|receptor.*tv/ },
  { name: "Baterias y pilas", icon: "🔋", pattern: /\bbateria(?:s)?\b|\bpila(?:s)?\b/ },
  { name: "Linternas", icon: "🔦", pattern: /\blinterna(?:s)?\b/ },
  { name: "Relojes y wearables", icon: "⌚", pattern: /\breloj(?:es)?\b|smart\s*watch|smartwatch|wearable/ },
  { name: "Camaras y seguridad", icon: "📹", pattern: /\bcamara(?:s)?\b|seguridad|vigilancia/ },
  { name: "Controles", icon: "🎮", pattern: /\bcontrol(?:es)?\b|gamepad|joystick/ },
  { name: "Cuidado personal", icon: "✂️", pattern: /patillera|maquina|shaver|depiladora|afeitadora|secador/ },
  { name: "Accesorios para PC", icon: "🖥️", pattern: /\bmouse\b|teclado|webcam|parlante pc|hub usb/ },
  { name: "Video y multimedia", icon: "🎬", pattern: /\bdvd\b|reproductor|video/ },
  { name: "Adaptadores", icon: "🔄", pattern: /\badaptador(?:es)?\b|convertidor/ },
  { name: "Accesorios", icon: "📦", pattern: /accesorio|banda elastica|combo/ }
];

function normalizeClassificationText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const GENERIC_BRAND_KEYS = new Set([
  "general",
  "generico",
  "generica",
  "sin marca",
  "no aplica",
  "n a",
  "na",
  "ninguna",
  "otros",
  "varios"
]);

function getAutomaticBrand(value) {
  const name = String(value || "").replace(/\s+/g, " ").trim().slice(0, 180);
  const key = normalizeClassificationText(name);
  if (!key || GENERIC_BRAND_KEYS.has(key)) return null;
  return { key, name };
}

function inferAutomaticSubcategory(product = {}) {
  const text = normalizeClassificationText([
    product.name,
    product.reference,
    product.brand
  ].filter(Boolean).join(" "));
  return AUTO_SUBCATEGORY_RULES.find((rule) => rule.pattern.test(text))
    || { name: "Otros productos", icon: "📦" };
}

function inferBrandSubcategory(product = {}, categoryBrands = new Map()) {
  const brand = getAutomaticBrand(product.brand);
  return brand
    ? { name: categoryBrands.get(brand.key) || brand.name, icon: "🏷️" }
    : { name: "Otras marcas", icon: "📦" };
}

function automaticSubcategoryOrder(name) {
  const index = AUTO_SUBCATEGORY_RULES.findIndex((rule) => rule.name === name);
  return index >= 0 ? index : AUTO_SUBCATEGORY_RULES.length;
}

function storeSubcategoryId(categoryName, subcategoryName) {
  const readable = `${slugify(categoryName)}--${slugify(subcategoryName)}`;
  if (readable.length <= 120) return readable;
  const hash = crypto.createHash("sha1")
    .update(`${categoryName}:${subcategoryName}`)
    .digest("hex")
    .slice(0, 10);
  return `${readable.slice(0, 109)}-${hash}`;
}

async function seedAutomaticProductSubcategories(db, products = []) {
  if (!Array.isArray(products) || products.length === 0) return;
  const brandProfilesByCategory = new Map();
  const inferredProducts = [];
  const inferredNamesByCategory = new Map();
  const brandModeCategories = new Set();
  const subcategoriesById = new Map();
  const assignments = [];

  for (const product of products) {
    const categoryName = boundedText(product.category, "General", 180);
    if (!brandProfilesByCategory.has(categoryName)) {
      brandProfilesByCategory.set(categoryName, {
        brands: new Map(),
        hasUnbrandedProducts: false
      });
    }
    const brandProfile = brandProfilesByCategory.get(categoryName);
    const brand = getAutomaticBrand(product.brand);
    if (!brand) {
      brandProfile.hasUnbrandedProducts = true;
      continue;
    }
    if (!brandProfile.brands.has(brand.key)) {
      brandProfile.brands.set(brand.key, brand.name);
    }
  }

  for (const product of products) {
    const productId = cleanText(product.id, "");
    if (!productId) continue;
    const categoryName = boundedText(product.category, "General", 180);
    const brandProfile = brandProfilesByCategory.get(categoryName) || {
      brands: new Map(),
      hasUnbrandedProducts: false
    };
    const useBrandSubcategories = brandProfile.brands.size > 0;
    if (useBrandSubcategories) brandModeCategories.add(categoryName);
    const inferred = useBrandSubcategories
      ? inferBrandSubcategory(product, brandProfile.brands)
      : inferAutomaticSubcategory(product);
    inferredProducts.push({ productId, categoryName, inferred });
    if (!inferredNamesByCategory.has(categoryName)) {
      inferredNamesByCategory.set(categoryName, new Set());
    }
    inferredNamesByCategory.get(categoryName).add(inferred.name);
  }

  const categoriesWithUsefulSubcategories = new Set(
    [...inferredNamesByCategory.entries()]
      .filter(([categoryName, names]) => (
        names.size > 1 || brandModeCategories.has(categoryName)
      ))
      .map(([categoryName]) => categoryName)
  );

  for (const { productId, categoryName, inferred } of inferredProducts) {
    if (!categoriesWithUsefulSubcategories.has(categoryName)) continue;
    const id = storeSubcategoryId(categoryName, inferred.name);
    subcategoriesById.set(id, {
      id,
      categoryName,
      name: inferred.name,
      icon: inferred.icon
    });
    assignments.push({ productId, subcategoryId: id });
  }

  // A SAINT category change invalidates any assignment that points to the old category.
  await db.query(
    `DELETE assignment
     FROM product_subcategory_assignments assignment
     LEFT JOIN products catalog_product
       ON catalog_product.id = assignment.product_id
     LEFT JOIN store_subcategories subcategory
       ON subcategory.id = assignment.subcategory_id
     WHERE catalog_product.id IS NULL
       OR subcategory.id IS NULL
       OR LOWER(TRIM(subcategory.category_name)) <> LOWER(TRIM(catalog_product.category))`
  );

  if (brandModeCategories.size > 0) {
    const categoryNames = [...brandModeCategories];
    const placeholders = categoryNames.map(() => "?").join(",");
    await db.query(
      `DELETE assignment
       FROM product_subcategory_assignments assignment
       INNER JOIN products catalog_product
         ON catalog_product.id = assignment.product_id
       WHERE catalog_product.category IN (${placeholders})`,
      categoryNames
    );
  }

  await db.query(
    "UPDATE store_subcategories SET enabled = 0 WHERE classification_source = 'auto'"
  );
  await db.query(
    "DELETE FROM product_subcategory_assignments WHERE assignment_source = 'auto'"
  );

  const orderedSubcategories = [...subcategoriesById.values()].sort((left, right) => (
    left.categoryName.localeCompare(right.categoryName, "es")
    || automaticSubcategoryOrder(left.name) - automaticSubcategoryOrder(right.name)
    || left.name.localeCompare(right.name, "es")
  ));

  for (const subcategoryChunk of chunks(orderedSubcategories)) {
    const placeholders = subcategoryChunk.map(() => "(?,?,?,?,?,1,'auto')").join(",");
    const values = subcategoryChunk.flatMap((subcategory) => [
      subcategory.id,
      subcategory.categoryName,
      subcategory.name,
      subcategory.icon,
      automaticSubcategoryOrder(subcategory.name)
    ]);
    await db.query(
      `INSERT INTO store_subcategories
        (id, category_name, name, icon, sort_order, enabled, classification_source)
       VALUES ${placeholders}
       ON DUPLICATE KEY UPDATE
         icon = IF(classification_source = 'auto', VALUES(icon), icon),
         sort_order = IF(classification_source = 'auto', VALUES(sort_order), sort_order),
         enabled = 1`,
      values
    );
  }

  for (const assignmentChunk of chunks(assignments)) {
    const placeholders = assignmentChunk.map(() => "(?,?,'auto')").join(",");
    const values = assignmentChunk.flatMap((assignment) => [
      assignment.productId,
      assignment.subcategoryId
    ]);
    await db.query(
      `INSERT INTO product_subcategory_assignments
        (product_id, subcategory_id, assignment_source)
       VALUES ${placeholders}
       ON DUPLICATE KEY UPDATE
         subcategory_id = IF(assignment_source = 'auto', VALUES(subcategory_id), subcategory_id)`,
      values
    );
  }
}

function normalizeSaintMirrorProducts(snapshotProducts = []) {
  const productsById = new Map();
  for (const product of snapshotProducts) {
    const id = cleanText(product.id, "").trim();
    if (!id) continue;
    if (id.length > 120) {
      throw new Error(`SAINT devolvio una referencia mayor a 120 caracteres (${id.slice(0, 40)}...); el espejo local no fue modificado`);
    }
    const key = id.toUpperCase();
    if (productsById.has(key)) {
      throw new Error(`SAINT devolvio la referencia duplicada ${id}; el espejo local no fue modificado`);
    }
    productsById.set(key, {
      id,
      name: boundedText(product.name, id, 255),
      category: boundedText(product.category, "General", 180),
      brand: boundedText(product.brand, "General", 180),
      stock: Math.max(Math.floor(cleanNumber(product.stock, 0)), 0),
      price1: Math.max(Math.round(cleanNumber(product.price1 ?? product.wholesalePrice, 0)), 0),
      price2: Math.max(Math.round(cleanNumber(product.price2 ?? product.retailPrice, 0)), 0),
      price3: Math.max(Math.round(cleanNumber(product.price3, 0)), 0),
      cost: Math.max(Math.round(cleanNumber(product.cost, 0)), 0),
      reference: boundedText(product.reference, "", 255),
      unit: boundedText(product.unit, "", 80),
      warranty: boundedText(product.warranty, "", 120),
      status: boundedText(product.status, "Sin stock", 80),
      deposito: boundedText(product.deposito, "", 180),
      puesto: boundedText(product.puesto, "", 180),
      source: "saint:bodega",
      storeDescription: cleanLongText(product.storeDescription, ""),
      botFeatures: cleanLongText(product.botFeatures, ""),
      barcodes: cleanLongText(product.barcodes, ""),
      storeEnabled: Math.max(Math.floor(cleanNumber(product.stock, 0)), 0) > 0
    });
  }
  return [...productsById.values()];
}

async function performSaintInventoryMirror(db, snapshot) {
  if (!Array.isArray(snapshot?.products) || snapshot.products.length === 0) {
    throw new Error("SAINT devolvio un inventario vacio; el espejo local se conservo sin cambios");
  }
  const products = normalizeSaintMirrorProducts(snapshot.products);
  if (products.length !== snapshot.products.length) {
    throw new Error("La instantanea SAINT contiene referencias invalidas; el espejo local no fue modificado");
  }

  const categoryNames = [...new Set(products.map((product) => product.category))]
    .sort((a, b) => a.localeCompare(b));
  const brandNames = [...new Set(products.map((product) => product.brand))]
    .sort((a, b) => a.localeCompare(b));
  const connection = await db.getConnection();
  const syncedAt = new Date().toISOString();

  try {
    await connection.beginTransaction();
    const [[previousCountRow]] = await connection.query("SELECT COUNT(*) AS total FROM products");
    const [categoryMarginRows] = await connection.query("SELECT name, margin, icon FROM categories");
    const categoryMargins = new Map(
      categoryMarginRows.map((row) => [String(row.name), Number(row.margin || 0)])
    );
    const categoryIcons = new Map(
      categoryMarginRows.map((row) => [String(row.name), String(row.icon || "").trim()])
    );

    await connection.query("DROP TEMPORARY TABLE IF EXISTS saint_inventory_snapshot_ids");
    await connection.query(
      "CREATE TEMPORARY TABLE saint_inventory_snapshot_ids (id VARCHAR(120) PRIMARY KEY) ENGINE=InnoDB"
    );

    for (const productChunk of chunks(products)) {
      const idPlaceholders = productChunk.map(() => "(?)").join(",");
      await connection.query(
        `INSERT INTO saint_inventory_snapshot_ids (id) VALUES ${idPlaceholders}`,
        productChunk.map((product) => product.id)
      );

      const rowPlaceholders = productChunk.map(() => "(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").join(",");
      const values = productChunk.flatMap((product) => [
        product.id,
        product.name,
        product.category,
        product.brand,
        product.stock,
        product.price1,
        product.price2,
        product.price3,
        product.cost,
        product.reference,
        product.unit,
        product.warranty,
        product.status,
        product.deposito,
        product.puesto,
        product.source,
        product.storeDescription,
        product.botFeatures,
        product.barcodes,
        product.storeEnabled ? 1 : 0
      ]);
      await connection.query(
        `INSERT INTO products
          (id, name, category, brand, stock, wholesale_price, retail_price, price_3,
           cost, reference, unit, warranty, status, deposito, puesto, source,
           store_description, bot_features, barcodes, store_enabled)
         VALUES ${rowPlaceholders}
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           category = VALUES(category),
           brand = VALUES(brand),
           stock = VALUES(stock),
           wholesale_price = VALUES(wholesale_price),
           retail_price = VALUES(retail_price),
           price_3 = VALUES(price_3),
           cost = VALUES(cost),
           reference = VALUES(reference),
           unit = VALUES(unit),
           status = VALUES(status),
           deposito = VALUES(deposito),
           puesto = VALUES(puesto),
           source = VALUES(source),
           barcodes = VALUES(barcodes)`,
        values
      );
    }

    const [deleteResult] = await connection.query(
      `DELETE product
       FROM products product
       LEFT JOIN saint_inventory_snapshot_ids snapshot ON snapshot.id = product.id
       WHERE snapshot.id IS NULL`
    );

    await connection.query("DELETE FROM categories");
    for (const categoryChunk of chunks(categoryNames)) {
      const placeholders = categoryChunk.map(() => "(?,?,?,?)").join(",");
      const values = categoryChunk.flatMap((name) => [
        categoryMirrorId(name),
        name,
        categoryMargins.get(name) || 0,
        categoryIcons.get(name) || getDefaultCategoryIcon(name)
      ]);
      await connection.query(
        `INSERT INTO categories (id, name, margin, icon) VALUES ${placeholders}`,
        values
      );
    }

    await connection.query("DELETE FROM brands");
    for (const brandChunk of chunks(brandNames)) {
      const placeholders = brandChunk.map(() => "(?)").join(",");
      await connection.query(`INSERT INTO brands (name) VALUES ${placeholders}`, brandChunk);
    }

    await connection.query(
      `DELETE assignment
       FROM product_subcategory_assignments assignment
       LEFT JOIN products product ON product.id = assignment.product_id
       WHERE product.id IS NULL`
    );
    await seedAutomaticProductSubcategories(connection, products);

    const mirrorSettings = {
      saintMirrorLastSuccessAt: syncedAt,
      saintMirrorProductCount: products.length,
      saintMirrorDeletedCount: Number(deleteResult.affectedRows || 0),
      saintMirrorPreviousCount: Number(previousCountRow.total || 0)
    };
    for (const [key, value] of Object.entries(mirrorSettings)) {
      await connection.query("REPLACE INTO settings (`key`, value) VALUES (?, ?)", [key, encode(value)]);
    }

    await connection.commit();
    return {
      ...mirrorSettings,
      categoryCount: categoryNames.length,
      brandCount: brandNames.length,
      snapshotVersion: Number(snapshot.fetchedAt || Date.now())
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function ensureSaintInventoryMirror(db, snapshot) {
  const snapshotVersion = Number(snapshot?.fetchedAt || 0);
  if (snapshotVersion > 0 && snapshotVersion <= lastSaintMirrorVersion && lastSaintMirrorResult) {
    return { ...lastSaintMirrorResult, skipped: true };
  }

  while (saintMirrorPromise) {
    await saintMirrorPromise;
    if (snapshotVersion > 0 && snapshotVersion <= lastSaintMirrorVersion && lastSaintMirrorResult) {
      return { ...lastSaintMirrorResult, skipped: true };
    }
  }

  saintMirrorPromise = performSaintInventoryMirror(db, snapshot);
  try {
    const result = await saintMirrorPromise;
    lastSaintMirrorVersion = snapshotVersion || result.snapshotVersion;
    lastSaintMirrorResult = result;
    return result;
  } finally {
    saintMirrorPromise = null;
  }
}

function applyMirrorResultToSettings(settings, mirrorResult) {
  if (!mirrorResult) return;
  settings.saintMirrorStatus = "synced";
  settings.saintMirrorLastSuccessAt = mirrorResult.saintMirrorLastSuccessAt;
  settings.saintMirrorProductCount = mirrorResult.saintMirrorProductCount;
  settings.saintMirrorDeletedCount = mirrorResult.saintMirrorDeletedCount;
  delete settings.saintMirrorError;
}

async function refreshSaintInventoryMirror() {
  const db = await getPool();
  const settings = await loadSettings(db);
  const localProducts = await selectLocalProducts(db);
  const saintInventory = await readSaintInventory(settings, localProducts, { forceRefresh: true });
  if (saintInventory?.products) {
    const mirrorResult = await ensureSaintInventoryMirror(db, saintInventory);
    return { status: "synced", ...mirrorResult };
  }
  if (saintInventory?.error) return { status: "error", error: saintInventory.error };
  return { status: "disabled" };
}

async function readDb(options = {}) {
  const db = await getPool();
  const settings = await loadSettings(db);
  const wholesalePolicy = getWholesalePolicy(settings);
  settings.minimumWholesaleAmount = wholesalePolicy.minimumAmount;
  settings.minimumWholesaleUnits = wholesalePolicy.minimumUnits;
  settings.minimumWholesaleReferences = wholesalePolicy.minimumReferences;
  settings.minimumWholesaleTotalUnits = wholesalePolicy.minimumTotalUnits;

  let [categories] = await db.query("SELECT id, name, margin, icon FROM categories ORDER BY name");
  const localCategoriesByName = new Map(
    categories.map((category) => [String(category.name), category])
  );
  let [brandRows] = await db.query("SELECT name FROM brands ORDER BY name");
  let products = await selectLocalProducts(db);
  const localEnrichmentByProduct = new Map(
    products.map((product) => [String(product.id).toUpperCase(), product])
  );
  const [storeNameRows] = await db.query(
    "SELECT product_id AS productId, store_name AS storeName FROM product_store_names"
  );
  const storeNameByProduct = new Map(
    storeNameRows.map((row) => [String(row.productId).toUpperCase(), String(row.storeName || "").trim()])
  );

  const saintInventory = await readSaintInventory(settings, products, {
    forceRefresh: options.forceSaintRefresh === true
  });
  if (saintInventory?.products) {
    try {
      const mirrorResult = await ensureSaintInventoryMirror(db, saintInventory);
      applyMirrorResultToSettings(settings, mirrorResult);
    } catch (error) {
      settings.saintMirrorStatus = "error";
      settings.saintMirrorError = String(error.message || error).slice(0, 1000);
      console.error("No se pudo actualizar el espejo local de SAINT:", error);
    }
    products = saintInventory.products.map((product) => {
      const local = localEnrichmentByProduct.get(String(product.id).toUpperCase());
      if (!local) return product;
      return {
        ...product,
        storeDescription: local.storeDescription ?? "",
        botFeatures: local.botFeatures ?? "",
        warranty: local.warranty ?? "",
        freeShipping: Boolean(local.freeShipping),
        promotionEnabled: Boolean(local.promotionEnabled),
        promotionPercent: Number(local.promotionPercent || 0),
        storeEnabled: Boolean(local.storeEnabled)
      };
    });
    categories = (saintInventory.categories || categories).map((category) => {
      const localCategory = localCategoriesByName.get(String(category.name));
      return {
        ...category,
        id: localCategory?.id || category.id,
        margin: Number(localCategory?.margin ?? category.margin ?? 0),
        icon: String(localCategory?.icon || "").trim() || getDefaultCategoryIcon(category.name)
      };
    });
    brandRows = (saintInventory.brands || []).map((name) => ({ name }));
    settings.inventorySource = "saint:bodega";
    settings.saintInventoryStatus = "connected";
    settings.saintInventoryCount = products.length;
    delete settings.saintInventoryError;
  } else if (saintInventory?.error) {
    settings.inventorySource = "mysql:vegabot";
    settings.saintInventoryStatus = "error";
    settings.saintInventoryError = saintInventory.error;
  } else {
    settings.inventorySource = "mysql:vegabot";
    settings.saintInventoryStatus = "disabled";
  }
  const [categoryNameRows] = await db.query(
    "SELECT category_id AS categoryId, display_name AS displayName FROM store_category_names"
  );
  const categoryDisplayNameById = new Map(
    categoryNameRows.map((row) => [String(row.categoryId), String(row.displayName || "").trim()])
  );
  categories = categories.map((category) => ({
    ...category,
    sourceName: String(category.name || "General"),
    displayName: categoryDisplayNameById.get(String(category.id)) || String(category.name || "General")
  }));
  const saintCatalogEnabled = settings.saintInventoryEnabled === true
    || settings.saintInventoryEnabled === 1
    || ["true", "1"].includes(String(settings.saintInventoryEnabled || "").toLowerCase());
  products = products.map((product) => {
    const isSaintProduct = saintCatalogEnabled
      || String(product.source || "").toLowerCase().startsWith("saint:");
    const canonicalName = String(product.name || "").trim();
    const savedStoreName = storeNameByProduct.get(String(product.id).toUpperCase()) || "";
    return {
      ...product,
      storeName: savedStoreName || (isSaintProduct ? "SIN NOMBRE" : canonicalName),
      saintName: isSaintProduct ? canonicalName : ""
    };
  });
  const [subcategories] = await db.query(
    `SELECT id, category_name AS categoryName, name, icon,
      sort_order AS sortOrder, enabled
     FROM store_subcategories
     WHERE enabled = 1
     ORDER BY category_name, sort_order, name`
  );
  const [subcategoryAssignmentRows] = await db.query(
    `SELECT assignment.product_id AS productId,
      assignment.subcategory_id AS subcategoryId,
      assignment.assignment_source AS assignmentSource
     FROM product_subcategory_assignments assignment`
  );
  const subcategoryById = new Map(
    subcategories.map((subcategory) => [String(subcategory.id), subcategory])
  );
  const subcategoryAssignmentByProduct = new Map(
    subcategoryAssignmentRows.map((assignment) => [
      String(assignment.productId).toUpperCase(),
      assignment
    ])
  );
  products = products.map((product) => {
    const assignment = subcategoryAssignmentByProduct.get(String(product.id).toUpperCase());
    const subcategory = assignment?.subcategoryId
      ? subcategoryById.get(String(assignment.subcategoryId))
      : null;
    const belongsToCategory = subcategory
      && String(subcategory.categoryName) === String(product.category || "General");
    return {
      ...product,
      subcategoryId: belongsToCategory ? String(subcategory.id) : "",
      subcategoryName: belongsToCategory ? String(subcategory.name) : "",
      subcategoryIcon: belongsToCategory ? String(subcategory.icon || "") : "",
      subcategoryAssignmentSource: assignment?.assignmentSource || ""
    };
  });
  const [reservationRows] = await db.query(
    `SELECT product_id AS productId, SUM(qty) AS reservedStock
     FROM inventory_reservations
     WHERE status = 'active'
     GROUP BY product_id`
  );
  const reservedByProduct = new Map(
    reservationRows.map((row) => [String(row.productId), Number(row.reservedStock || 0)])
  );
  products = products.map((product) => {
    const stock = Math.max(Number(product.stock || 0), 0);
    const reservedStock = reservedByProduct.get(String(product.id)) || 0;
    const price1 = cleanNumber(product.price1 ?? product.wholesalePrice, 0);
    const price2 = cleanNumber(product.price2 ?? product.retailPrice, 0);
    const price3 = cleanNumber(product.price3, 0);
    const retailPrice = getRetailPrice({ price1, price2 });
    return {
      ...product,
      stock,
      price1,
      price2,
      price3,
      wholesalePrice: price1,
      retailPrice: price2,
      botPriceLevel: 2,
      storePriceLevel: 2,
      botPrice: retailPrice,
      storePrice: retailPrice,
      minimumWholesaleAmount: wholesalePolicy.minimumAmount,
      minimumWholesaleUnits: wholesalePolicy.minimumUnits,
      minimumWholesaleReferences: wholesalePolicy.minimumReferences,
      minimumWholesaleTotalUnits: wholesalePolicy.minimumTotalUnits,
      reservedStock,
      availableStock: Math.max(stock - reservedStock, 0)
    };
  });
  const [customerRows] = await db.query(
    `SELECT id, name, phone, company, type, status, last_message AS lastMessage,
      assigned_to AS assignedTo, tags_json AS tagsJson, last_contact AS lastContact,
      bot_stage AS botStage, active_order_id AS activeOrderId, bot_memory_json AS botMemoryJson,
      manual_attention AS manualAttention
     FROM customers ORDER BY last_contact DESC, name`
  );
  const [conversations] = await db.query(
    `SELECT id, customer_id AS customerId, sender AS \`from\`, text,
      message_type AS type, media_url AS mediaUrl, media_name AS mediaName,
      media_meta AS mediaMeta, time, created_at AS createdAt
     FROM conversations ORDER BY id ASC`
  );
  const [orderRows] = await db.query(
    `SELECT id, customer_id AS customerId, customer_name AS customerName, phone,
      items_json AS itemsJson, subtotal, freight, total, status,
      payment_status AS paymentStatus, dispatch_json AS dispatchJson, created_at AS createdAt,
      channel, source, bot_status AS botStatus, validation_status AS validationStatus,
      priority, customer_company AS customerCompany, customer_city AS customerCity,
      customer_document AS customerDocument, contact_phone AS contactPhone,
      delivery_type AS deliveryType, delivery_address AS deliveryAddress, requested_text AS requestedText,
      notes, internal_notes AS internalNotes, confirmed_at AS confirmedAt,
      validated_at AS validatedAt, dispatched_at AS dispatchedAt,
      inventory_deducted AS inventoryDeducted, updated_at AS updatedAt
     FROM orders ORDER BY updated_at DESC, id DESC`
  );

  const orders = [];
  for (const order of orderRows) {
    orders.push({
      ...order,
      items: await readOrderItems(order.id, decode(order.itemsJson, [])),
      dispatch: decode(order.dispatchJson, {}),
      itemsJson: undefined,
      dispatchJson: undefined
    });
  }

  return {
    settings,
    categories,
    subcategories,
    brands: brandRows.map((row) => row.name),
    products,
    customers: customerRows.map((customer) => ({
      ...customer,
      tags: decode(customer.tagsJson, []),
      botMemory: decode(customer.botMemoryJson, {}),
      manualAttention: Boolean(customer.manualAttention),
      tagsJson: undefined,
      botMemoryJson: undefined
    })),
    conversations,
    orders
  };
}

async function readOrderItems(orderId, fallbackItems = []) {
  const db = await getPool();
  const [rows] = await db.query(
    `SELECT product_id AS sku, product_name AS name, category, brand, qty,
      unit_price AS price, line_total AS lineTotal, stock_snapshot AS stockSnapshot,
      deposito, puesto, status
     FROM order_items WHERE order_id = ? ORDER BY id ASC`,
    [orderId]
  );
  return rows.length ? rows : fallbackItems;
}

async function updateSettings(settings) {
  const db = await getPool();
  const current = (await readDb()).settings;
  const merged = { ...current, ...settings };
  const runtimeKeys = new Set([
    "inventorySource",
    "saintInventoryStatus",
    "saintInventoryCount",
    "saintInventoryError",
    "botPriceLevel",
    "storePriceLevel"
  ]);
  await db.query(
    "DELETE FROM settings WHERE `key` IN ('inventorySource', 'saintInventoryStatus', 'saintInventoryCount', 'saintInventoryError', 'botPriceLevel', 'storePriceLevel')"
  );
  for (const [key, value] of Object.entries(merged)) {
    if (runtimeKeys.has(key)) continue;
    await db.query("REPLACE INTO settings (`key`, value) VALUES (?, ?)", [key, encode(value)]);
  }
  return merged;
}

async function saveProductStoreName(db, productId, storeName) {
  const normalized = cleanText(storeName, "SIN NOMBRE") || "SIN NOMBRE";
  await db.query(
    `INSERT INTO product_store_names (product_id, store_name)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE store_name = VALUES(store_name)`,
    [String(productId), normalized]
  );
  return normalized;
}

async function updateProduct(productId, payload = {}, externalProduct = null) {
  const db = await getPool();
  let [existingRows] = await db.query("SELECT * FROM products WHERE id = ? LIMIT 1", [productId]);
  if (!existingRows.length && externalProduct) {
    await db.query(
       `INSERT INTO products
         (id, name, category, brand, stock, wholesale_price, retail_price, price_3,
          warranty, status, deposito, puesto, source, store_description, bot_features, store_enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(productId),
        cleanText(externalProduct.name, String(productId)),
        cleanText(externalProduct.category, "General"),
        cleanText(externalProduct.brand, "General"),
        cleanNumber(externalProduct.stock, 0),
        cleanNumber(externalProduct.price1 ?? externalProduct.wholesalePrice, 0),
        cleanNumber(externalProduct.price2 ?? externalProduct.retailPrice, 0),
        cleanNumber(externalProduct.price3, 0),
        cleanText(externalProduct.warranty, ""),
        cleanText(externalProduct.status, "Disponible"),
        cleanText(externalProduct.deposito, ""),
        cleanText(externalProduct.puesto, ""),
        cleanText(externalProduct.source, "saint:bodega"),
        cleanLongText(externalProduct.storeDescription, ""),
        cleanLongText(externalProduct.botFeatures, ""),
        cleanNumber(externalProduct.stock, 0) > 0 ? 1 : 0
      ]
    );
    [existingRows] = await db.query("SELECT * FROM products WHERE id = ? LIMIT 1", [productId]);
  }
  if (!existingRows.length) return null;
  const current = existingRows[0];
  const isSaintProduct = Boolean(externalProduct?.saintName)
    || String(current.source || "").toLowerCase().startsWith("saint:");
  const storeName = await saveProductStoreName(
    db,
    productId,
    payload.storeName ?? payload.displayName ?? (isSaintProduct ? "SIN NOMBRE" : payload.name ?? current.name)
  );
  const next = {
    name: isSaintProduct ? current.name : cleanText(payload.name, current.name),
    category: cleanText(payload.category, current.category),
    brand: cleanText(payload.brand, current.brand),
    stock: cleanNumber(payload.stock, current.stock),
    wholesalePrice: cleanNumber(payload.wholesalePrice, current.wholesale_price),
    retailPrice: cleanNumber(payload.retailPrice, current.retail_price),
    price3: cleanNumber(payload.price3, current.price_3),
    warranty: cleanText(payload.warranty, current.warranty),
    status: cleanText(payload.status, current.status),
    deposito: cleanText(payload.deposito, current.deposito),
    puesto: cleanText(payload.puesto, current.puesto),
    source: cleanText(payload.source, current.source),
    botFeatures: cleanLongText(payload.botFeatures, current.bot_features || ""),
    freeShipping: cleanBoolean(payload.freeShipping ?? payload.free_shipping, current.free_shipping),
    promotionEnabled: cleanBoolean(payload.promotionEnabled ?? payload.promotion_enabled, current.promotion_enabled),
    promotionPercent: cleanPercentage(payload.promotionPercent ?? payload.promotion_percent, current.promotion_percent),
    storeEnabled: cleanBoolean(payload.storeEnabled ?? payload.enabled, current.store_enabled)
  };
  if (next.promotionPercent <= 0) next.promotionEnabled = false;

  await db.query("INSERT IGNORE INTO categories (id, name, margin) VALUES (?, ?, 0)", [slugify(next.category), next.category]);
  await db.query("INSERT IGNORE INTO brands (name) VALUES (?)", [next.brand]);
  await db.query(
    `UPDATE products
     SET name = ?, category = ?, brand = ?, stock = ?, wholesale_price = ?,
       retail_price = ?, price_3 = ?, warranty = ?, status = ?, deposito = ?, puesto = ?, source = ?,
       bot_features = ?, free_shipping = ?, promotion_enabled = ?, promotion_percent = ?, store_enabled = ?
     WHERE id = ?`,
    [
      next.name,
      next.category,
      next.brand,
      next.stock,
      next.wholesalePrice,
      next.retailPrice,
      next.price3,
      next.warranty,
      next.status,
      next.deposito,
      next.puesto,
      next.source,
      next.botFeatures,
      next.freeShipping ? 1 : 0,
      next.promotionEnabled ? 1 : 0,
      next.promotionPercent,
      next.storeEnabled ? 1 : 0,
      productId
    ]
  );
  const data = await readDb();
  const updated = data.products.find((product) => product.id === productId) || null;
  return updated ? { ...updated, storeName } : null;
}

function cleanText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || String(fallback || "").trim();
}

function boundedText(value, fallback, maxLength) {
  return cleanText(value, fallback).slice(0, maxLength);
}

function categoryMirrorId(name) {
  const text = cleanText(name, "General");
  if (text.length <= 120) return text;
  const hash = crypto.createHash("sha1").update(text).digest("hex").slice(0, 8);
  return `${slugify(text).slice(0, 110)}-${hash}`;
}

function cleanLongText(value, fallback = "") {
  if (value === undefined || value === null) return String(fallback || "").trim();
  return String(value || "").trim();
}

function cleanNumber(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return Number(fallback || 0);
  return Math.max(Math.round(number), 0);
}

function cleanBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") return Boolean(Number(fallback)) || fallback === true;
  if (typeof value === "string") return ["1", "true", "si", "yes", "on"].includes(value.trim().toLowerCase());
  return value === true || Number(value) === 1;
}

function cleanPercentage(value, fallback = 0) {
  const number = Number(value);
  const safe = Number.isFinite(number) ? number : Number(fallback || 0);
  return Math.min(Math.max(Math.round(safe * 100) / 100, 0), 99);
}

function slugify(value) {
  const slug = String(value || "sin-categoria")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "sin-categoria";
}

async function appendConversation(customerId, sender, payload = {}) {
  const db = await getPool();
  const now = new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  const text = payload.text || "";
  const type = payload.type || "text";
  const media = payload.media || {};
  await db.query(
    `INSERT INTO conversations
      (customer_id, sender, text, message_type, media_url, media_name, media_meta, time)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [customerId, sender, text, type, media.url || "", media.name || "", media.meta || "", now]
  );
  await db.query(
    `UPDATE customers
     SET status = CASE
       WHEN manual_attention = 1 THEN 'Atencion manual'
       WHEN status = 'Requiere asesor' THEN status
       ELSE 'Atencion bot'
     END,
     last_message = ?, last_contact = ?
     WHERE id = ?`,
    [
    text || `Adjunto ${type}`,
    new Date().toLocaleString("es-CO", { hour12: false }),
    customerId
    ]
  );
}

async function upsertWhatsappCustomer(phone, incomingName = "") {
  const db = await getPool();
  const normalizedPhone = normalizePhone(phone);
  const id = `wa-${normalizedPhone.replace(/\D/g, "")}`;
  const [existingRows] = await db.query("SELECT id, name, phone FROM customers WHERE phone = ? OR id = ? LIMIT 1", [normalizedPhone, id]);
  if (existingRows.length) return existingRows[0];
  const customer = {
    id,
    name: incomingName || "Cliente WhatsApp",
    phone: normalizedPhone
  };
  await db.query(
    `INSERT INTO customers
      (id, name, phone, company, type, status, last_message, assigned_to, tags_json, last_contact)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      customer.id,
      customer.name,
      customer.phone,
      "",
      "Por clasificar",
      "Atencion bot",
      "",
      "Sin asignar",
      encode(["WhatsApp"]),
      new Date().toLocaleString("es-CO", { hour12: false })
    ]
  );
  return customer;
}

async function updateCustomerBotMemory(customerId, payload = {}) {
  const db = await getPool();
  const [rows] = await db.query("SELECT bot_memory_json AS botMemoryJson FROM customers WHERE id = ? LIMIT 1", [customerId]);
  if (!rows.length) return null;
  const current = decode(rows[0].botMemoryJson, {});
  const nextMemory = {
    ...current,
    ...(payload.memory || {}),
    lastIntent: payload.lastIntent || current.lastIntent || "",
    lastBotAnswer: payload.lastBotAnswer || current.lastBotAnswer || "",
    updatedAt: new Date().toLocaleString("es-CO", { hour12: false })
  };
  const nextStage = payload.botStage !== undefined ? cleanText(payload.botStage, "lead_new") : current.botStage || "lead_new";
  const nextOrderId = payload.activeOrderId !== undefined ? String(payload.activeOrderId || "").trim() : current.activeOrderId || "";
  await db.query(
    "UPDATE customers SET bot_stage = ?, active_order_id = ?, bot_memory_json = ? WHERE id = ?",
    [nextStage, nextOrderId, encode(nextMemory), customerId]
  );
  return { botStage: nextStage, activeOrderId: nextOrderId, botMemory: nextMemory };
}

async function updateCustomerManualAttention(customerId, enabled) {
  const db = await getPool();
  const manual = enabled ? 1 : 0;
  const status = enabled ? "Atencion manual" : "Atencion bot";
  const [result] = await db.query(
    "UPDATE customers SET manual_attention = ?, status = ? WHERE id = ?",
    [manual, status, customerId]
  );
  if (!result.affectedRows) return null;
  const data = await readDb();
  return data.customers.find((customer) => customer.id === customerId) || null;
}

async function flagCustomerNeedsAdvisor(customerId) {
  const db = await getPool();
  await db.query(
    "UPDATE customers SET status = 'Requiere asesor' WHERE id = ? AND manual_attention = 0",
    [customerId]
  );
}

function normalizeOrder(order = {}) {
  const now = new Date().toLocaleString("es-CO", { hour12: false });
  const dispatch = order.dispatch || {};
  return {
    id: order.id || `PED-${Date.now().toString().slice(-8)}`,
    customerId: order.customerId || "",
    customerName: order.customerName || "Cliente WhatsApp",
    phone: normalizePhone(order.phone || ""),
    items: order.items || [],
    subtotal: Number(order.subtotal || 0),
    freight: Number(order.freight || 0),
    total: Number(order.total || 0),
    status: order.status || "Pendiente validacion",
    paymentStatus: order.paymentStatus || "Por confirmar",
    dispatch,
    createdAt: order.createdAt || now,
    channel: order.channel || "whatsapp",
    source: order.source || "bot",
    botStatus: order.botStatus || "confirmado_por_bot",
    validationStatus: order.validationStatus || "pendiente_validacion",
    priority: order.priority || "normal",
    customerCompany: order.customerCompany || "",
    customerDocument: order.customerDocument || "",
    contactPhone: normalizePhone(order.contactPhone || ""),
    customerCity: order.customerCity || dispatch.city || "",
    deliveryAddress: order.deliveryAddress || dispatch.address || "",
    deliveryType: order.deliveryType || "",
    requestedText: order.requestedText || "",
    notes: order.notes || "",
    internalNotes: order.internalNotes || "",
    confirmedAt: order.confirmedAt !== undefined
      ? order.confirmedAt
      : (order.botStatus === "confirmado_por_bot" ? now : ""),
    validatedAt: order.validatedAt || "",
    dispatchedAt: order.dispatchedAt || "",
    inventoryDeducted: Boolean(order.inventoryDeducted)
  };
}

async function saveOrder(order) {
  const db = await getPool();
  const normalized = normalizeOrder(order);
  await db.query(
    `REPLACE INTO orders
      (id, customer_id, customer_name, phone, items_json, subtotal, freight, total,
       status, payment_status, dispatch_json, created_at, channel, source, bot_status,
       validation_status, priority, customer_company, customer_document, contact_phone,
       customer_city, delivery_type, delivery_address,
       requested_text, notes, internal_notes, confirmed_at, validated_at, dispatched_at,
       inventory_deducted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
    [
      normalized.id,
      normalized.customerId,
      normalized.customerName,
      normalized.phone,
      encode(normalized.items),
      normalized.subtotal,
      normalized.freight,
      normalized.total,
      normalized.status,
      normalized.paymentStatus,
      encode(normalized.dispatch),
      normalized.createdAt,
      normalized.channel,
      normalized.source,
      normalized.botStatus,
      normalized.validationStatus,
      normalized.priority,
      normalized.customerCompany,
      normalized.customerDocument,
      normalized.contactPhone,
      normalized.customerCity,
      normalized.deliveryType,
      normalized.deliveryAddress,
      normalized.requestedText,
      normalized.notes,
      normalized.internalNotes,
      normalized.confirmedAt,
      normalized.validatedAt,
      normalized.dispatchedAt,
      normalized.inventoryDeducted ? 1 : 0
    ]
  );
  await saveOrderItems(normalized.id, normalized.items);
  return normalized;
}

async function saveOrderItems(orderId, items = []) {
  const db = await getPool();
  await db.query("DELETE FROM order_items WHERE order_id = ?", [orderId]);
  for (const item of items) {
    const qty = Number(item.qty || 1);
    const price = Number(item.price || item.unitPrice || 0);
    await db.query(
      `INSERT INTO order_items
        (order_id, product_id, product_name, category, brand, qty, unit_price,
         line_total, stock_snapshot, deposito, puesto, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        item.sku || item.productId || "",
        item.name || item.productName || "",
        item.category || "",
        item.brand || "",
        qty,
        price,
        Number(item.lineTotal || qty * price),
        Number(item.stockSnapshot ?? item.stock ?? 0),
        item.deposito || "",
        item.puesto || "",
        item.status || "pendiente_validacion"
      ]
    );
  }
}

async function reserveInventoryForOrder(order = {}) {
  const db = await getPool();
  const connection = await db.getConnection();
  const lockName = "vegabot_inventory_reservations";
  try {
    const [[lockResult]] = await connection.query("SELECT GET_LOCK(?, 8) AS acquired", [lockName]);
    if (Number(lockResult?.acquired || 0) !== 1) {
      throw new Error("No fue posible bloquear temporalmente el inventario");
    }

    const inventory = await readDb();
    const [existingRows] = await connection.query(
      "SELECT product_id AS productId, qty FROM inventory_reservations WHERE order_id = ? AND status = 'active'",
      [order.id]
    );
    const existingByProduct = new Map(existingRows.map((row) => [String(row.productId), Number(row.qty || 0)]));
    const requested = new Map();
    for (const item of order.items || []) {
      const productId = String(item.sku || item.productId || item.id || "");
      const qty = Math.max(Number(item.qty || item.quantity || 0), 0);
      if (!productId || !qty) continue;
      requested.set(productId, (requested.get(productId) || 0) + qty);
    }

    for (const [productId, qty] of requested) {
      const product = (inventory.products || []).find((item) => String(item.id) === productId);
      const alreadyReserved = existingByProduct.get(productId) || 0;
      const available = Number(product?.availableStock ?? product?.stock ?? 0) + alreadyReserved;
      if (!product || available < qty) {
        const error = new Error(`Stock insuficiente para ${productId}. Disponible: ${Math.max(available, 0)}, solicitado: ${qty}`);
        error.code = "INSUFFICIENT_STOCK";
        error.productId = productId;
        throw error;
      }
    }

    await connection.beginTransaction();
    await connection.query(
      "UPDATE inventory_reservations SET status = 'released' WHERE order_id = ? AND status = 'active'",
      [order.id]
    );
    for (const [productId, qty] of requested) {
      await connection.query(
        `INSERT INTO inventory_reservations (order_id, product_id, qty, status, source)
         VALUES (?, ?, ?, 'active', ?)
         ON DUPLICATE KEY UPDATE qty = VALUES(qty), status = 'active', source = VALUES(source)`,
        [order.id, productId, qty, order.source || "bot"]
      );
    }
    await connection.commit();
    return { ok: true, orderId: order.id };
  } catch (error) {
    try {
      await connection.rollback();
    } catch {}
    throw error;
  } finally {
    try {
      await connection.query("SELECT RELEASE_LOCK(?)", [lockName]);
    } catch {}
    connection.release();
  }
}

async function releaseInventoryReservation(orderId) {
  const db = await getPool();
  await db.query(
    "UPDATE inventory_reservations SET status = 'released' WHERE order_id = ? AND status = 'active'",
    [orderId]
  );
}

async function consumeInventoryReservation(orderId) {
  const db = await getPool();
  await db.query(
    "UPDATE inventory_reservations SET status = 'consumed' WHERE order_id = ? AND status = 'active'",
    [orderId]
  );
}

function isTerminalOrderStatus(status) {
  const normalized = String(status || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return /cancelado|rechazado|anulado/.test(normalized);
}

async function updateOrderValidation(orderId, payload = {}) {
  const data = await readDb();
  const order = data.orders.find((item) => item.id === orderId);
  if (!order) return null;
  const now = new Date().toLocaleString("es-CO", { hour12: false });
  const nextOrder = {
    ...order,
    status: payload.status || order.status,
    paymentStatus: payload.paymentStatus || order.paymentStatus,
    dispatch: { ...order.dispatch, ...(payload.dispatch || {}) },
    validationStatus: payload.validationStatus || (payload.status === "Validado manualmente" ? "validado" : order.validationStatus),
    priority: payload.priority || order.priority,
    internalNotes: payload.internalNotes ?? order.internalNotes,
    validatedAt: payload.status === "Validado manualmente" && !order.validatedAt ? now : order.validatedAt,
    dispatchedAt: payload.status === "Despachado" && !order.dispatchedAt ? now : order.dispatchedAt
  };
  const shouldDeductInventory = nextOrder.status === "Despachado" && !order.inventoryDeducted;
  if (shouldDeductInventory) {
    await deductInventoryForOrder(nextOrder);
    await consumeInventoryReservation(nextOrder.id);
    nextOrder.inventoryDeducted = true;
  } else if (isTerminalOrderStatus(nextOrder.status)) {
    await releaseInventoryReservation(nextOrder.id);
  }
  return saveOrder(nextOrder);
}

async function createPaymentValidationRequest(payload = {}) {
  const db = await getPool();
  const order = payload.order || {};
  const validatorPhone = normalizePhone(payload.validatorPhone || "");
  await db.query(
    `INSERT INTO payment_validations
      (order_id, customer_id, customer_phone, validator_phone, status, proof_text, media_url, media_type)
     VALUES (?, ?, ?, ?, 'pendiente', ?, ?, ?)`,
    [
      order.id,
      order.customerId,
      normalizePhone(order.phone || ""),
      validatorPhone,
      payload.text || "",
      payload.mediaUrl || "",
      payload.mediaType || ""
    ]
  );
}

async function findPendingPaymentValidation(validatorPhone, text = "") {
  const db = await getPool();
  const normalizedValidator = normalizePhone(validatorPhone);
  const orderMatch = String(text || "").match(/\bPED-[A-Z0-9-]+\b/i);
  const params = [normalizedValidator];
  let where = "validator_phone = ? AND status = 'pendiente'";
  if (orderMatch) {
    where += " AND order_id = ?";
    params.push(orderMatch[0].toUpperCase());
  }
  const [rows] = await db.query(
    `SELECT id, order_id AS orderId, customer_id AS customerId, customer_phone AS customerPhone,
      validator_phone AS validatorPhone, proof_text AS proofText, media_url AS mediaUrl,
      media_type AS mediaType
     FROM payment_validations
     WHERE ${where}
     ORDER BY requested_at DESC
     LIMIT 1`,
    params
  );
  return rows[0] || null;
}

async function completePaymentValidation(validationId) {
  const db = await getPool();
  await db.query("UPDATE payment_validations SET status = 'validado', validated_at = ? WHERE id = ?", [
    new Date().toLocaleString("es-CO", { hour12: false }),
    validationId
  ]);
}

async function deductInventoryForOrder(order) {
  const db = await getPool();
  for (const item of order.items || []) {
    const productId = item.sku || item.productId;
    const qty = Number(item.qty || 0);
    if (!productId || qty <= 0) continue;
    await db.query("UPDATE products SET stock = GREATEST(stock - ?, 0) WHERE id = ?", [qty, productId]);
  }
}

async function readCart(customerId) {
  const db = await getPool();
  const [rows] = await db.query(
    `SELECT product_id AS sku, product_name AS name, category, brand, qty,
      unit_price AS price, line_total AS lineTotal, stock_snapshot AS stockSnapshot,
      wholesale_price_snapshot AS wholesalePrice,
      retail_price_snapshot AS retailPrice,
      price_tier AS priceTier, free_shipping AS freeShipping, deposito, puesto, status
     FROM cart_items WHERE customer_id = ? ORDER BY id ASC`,
    [customerId]
  );
  return { customerId, items: rows };
}

async function readCartPricingSettings(db) {
  const [rows] = await db.query(
    "SELECT `key`, value FROM settings WHERE `key` IN ('minimumWholesaleAmount', 'minimumWholesaleUnits', 'minimumWholesaleReferences', 'minimumWholesaleTotalUnits')"
  );
  const settings = rows.reduce((acc, row) => {
    acc[row.key] = decode(row.value, row.value);
    return acc;
  }, {});
  return getWholesalePolicy(settings);
}

async function repriceCart(customerId) {
  const db = await getPool();
  const policy = await readCartPricingSettings(db);
  const [rows] = await db.query(
    `SELECT product_id AS sku, qty,
      wholesale_price_snapshot AS wholesalePrice,
      retail_price_snapshot AS retailPrice
     FROM cart_items WHERE customer_id = ? ORDER BY id ASC`,
    [customerId]
  );
  const priced = priceBotCart(rows, policy);
  for (const item of priced.items) {
    await db.query(
      `UPDATE cart_items
       SET unit_price = ?, line_total = ?, price_tier = ?
       WHERE customer_id = ? AND product_id = ?`,
      [item.price, item.lineTotal, item.priceTier, customerId, item.sku]
    );
  }
  return readCart(customerId);
}

async function addCartItem(customerId, product, qty = 1) {
  const db = await getPool();
  const safeQty = Math.max(Math.round(Number(qty || 1)), 1);
  const wholesalePrice = getWholesalePrice(product);
  const retailPrice = getRetailPrice(product);
  await db.query("REPLACE INTO carts (customer_id, status) VALUES (?, 'active')", [customerId]);
  await db.query(
    `INSERT INTO cart_items
      (customer_id, product_id, product_name, category, brand, qty, unit_price,
       line_total, wholesale_price_snapshot, retail_price_snapshot, price_tier,
       free_shipping, stock_snapshot, deposito, puesto, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'detal', ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      qty = qty + VALUES(qty),
      unit_price = VALUES(unit_price),
      line_total = (qty + VALUES(qty)) * VALUES(unit_price),
      wholesale_price_snapshot = VALUES(wholesale_price_snapshot),
      retail_price_snapshot = VALUES(retail_price_snapshot),
      price_tier = 'detal',
      free_shipping = VALUES(free_shipping),
      stock_snapshot = VALUES(stock_snapshot),
      status = VALUES(status)`,
    [
      customerId,
      product.id,
      product.name,
      product.category || "",
      product.brand || "",
      safeQty,
      retailPrice,
      safeQty * retailPrice,
      wholesalePrice,
      retailPrice,
      cleanBoolean(product.freeShipping ?? product.free_shipping) ? 1 : 0,
      Number(product.availableStock ?? product.stock ?? 0),
      product.deposito || "",
      product.puesto || "",
      Number(product.availableStock ?? product.stock ?? 0) >= safeQty && retailPrice > 0 ? "prevalidado_bot" : "pendiente_validacion"
    ]
  );
  return repriceCart(customerId);
}

async function removeCartItem(customerId, productId, qty = 1) {
  const db = await getPool();
  const safeQty = Math.max(Math.round(Number(qty || 1)), 1);
  const [rows] = await db.query("SELECT qty FROM cart_items WHERE customer_id = ? AND product_id = ? LIMIT 1", [customerId, productId]);
  if (!rows.length) return readCart(customerId);
  const nextQty = Number(rows[0].qty || 0) - safeQty;
  if (nextQty > 0) {
    await db.query("UPDATE cart_items SET qty = ? WHERE customer_id = ? AND product_id = ?", [nextQty, customerId, productId]);
  } else {
    await db.query("DELETE FROM cart_items WHERE customer_id = ? AND product_id = ?", [customerId, productId]);
  }
  return repriceCart(customerId);
}

async function replaceCartWithItem(customerId, product, qty = 1) {
  await clearCart(customerId);
  return addCartItem(customerId, product, qty);
}

async function clearCart(customerId) {
  const db = await getPool();
  await db.query("DELETE FROM cart_items WHERE customer_id = ?", [customerId]);
  await db.query("DELETE FROM carts WHERE customer_id = ?", [customerId]);
}

module.exports = {
  appendConversation,
  addCartItem,
  clearCart,
  completePaymentValidation,
  consumeInventoryReservation,
  createPaymentValidationRequest,
  flagCustomerNeedsAdvisor,
  findPendingPaymentValidation,
  getPool,
  getDefaultCategoryIcon,
  init,
  readCart,
  readDb,
  refreshSaintInventoryMirror,
  releaseInventoryReservation,
  removeCartItem,
  replaceCartWithItem,
  reserveInventoryForOrder,
  saveOrder,
  updateProduct,
  updateCustomerBotMemory,
  updateCustomerManualAttention,
  updateOrderValidation,
  updateSettings,
  upsertWhatsappCustomer
};
