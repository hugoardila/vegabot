
-- IMPROVED FOR POSTGRESQL 10+
-- ALL BUSINESS LOGIC &amp; VALIDATION REMOVED (TO BE HANDLED BY API)
-- ==========================================================

-- ==========================================================
-- ACTIVAR EXTENSIÓN PARA UUIDs
-- ==========================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ==========================================================
-- ENUMS
-- ==========================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('admin', 'cliente', 'super_admin');
    END IF;
END $$;

-- ==========================================================
-- 1. USERS
-- ==========================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE,
    google_id VARCHAR(255) UNIQUE,
    avatar_url TEXT,
    password_hash TEXT,
    phone VARCHAR(20),
    id_number VARCHAR(20),
    role user_role DEFAULT 'cliente',
    status BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);


-- ==========================================================
-- 2. SUPPLIERS (SIMPLIFICADO)
-- ==========================================================
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    contact_name VARCHAR(150),
    address TEXT,
    city VARCHAR(100),
    phone VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================================
-- 3. CATEGORIES
-- ==========================================================
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================================
-- 3. PRODUCTS
-- ==========================================================
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(12,2) NOT NULL,
    stock INT DEFAULT 0,
    is_digital BOOLEAN DEFAULT FALSE,
    sku VARCHAR(50) UNIQUE,
    status BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================================
-- 4. PRODUCT MEDIA
-- ==========================================================
CREATE TABLE IF NOT EXISTS product_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    media_type VARCHAR(10),
    is_main BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================================
-- 5. DIGITAL LICENSES
-- ==========================================================
CREATE TABLE IF NOT EXISTS digital_licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    license_key VARCHAR(255) NOT NULL UNIQUE,
    is_sold BOOLEAN DEFAULT FALSE,
    sold_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================================
-- 6. SALES
-- ==========================================================
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES users(id),
    customer_name VARCHAR(150),
    customer_email VARCHAR(150),
    total_amount DECIMAL(12,2) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    customer_id_number VARCHAR(20),
    delivery_address TEXT DEFAULT '',
    delivery_country VARCHAR(100) DEFAULT 'Colombia',
    delivery_department VARCHAR(100),
    delivery_city VARCHAR(100),
    delivery_additional_info TEXT,
    payment_method VARCHAR(50),
    status VARCHAR(50) DEFAULT 'PENDIENTE',
    whatsapp_sent_customer BOOLEAN DEFAULT FALSE,
    whatsapp_sent_admin BOOLEAN DEFAULT FALSE,
    receipts TEXT[] DEFAULT '{}',
    wompi_transaction_id VARCHAR(100),
    wompi_reference VARCHAR(100),
    wompi_payment_link_id VARCHAR(100),
    idempotency_key VARCHAR(100) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================================
-- 7. SALE ITEMS
-- ==========================================================
CREATE TABLE IF NOT EXISTS sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    product_name TEXT NOT NULL DEFAULT 'Producto',
    quantity INT NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL
);

-- ==========================================================
-- ÍNDICES
-- ==========================================================
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_city ON suppliers(city);
CREATE INDEX IF NOT EXISTS idx_licenses_product ON digital_licenses(product_id) WHERE is_sold = FALSE;
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_phone);
CREATE INDEX IF NOT EXISTS idx_sales_user ON sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_wompi_transaction ON sales(wompi_transaction_id);
CREATE INDEX IF NOT EXISTS idx_sales_wompi_payment_link ON sales(wompi_payment_link_id);
CREATE INDEX IF NOT EXISTS idx_sales_delivery_department ON sales(delivery_department);
CREATE INDEX IF NOT EXISTS idx_sales_delivery_city ON sales(delivery_city);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id_number ON sales(customer_id_number);

-- ==========================================================
-- 8. PRODUCT REVIEWS
-- ==========================================================
CREATE TABLE IF NOT EXISTS product_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewer_name VARCHAR(100) NOT NULL DEFAULT 'Anónimo',
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (product_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON product_reviews(product_id);

-- ==========================================================
-- 9. STORE SETTINGS
-- ==========================================================
CREATE TABLE IF NOT EXISTS store_settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value TEXT NOT NULL
);

INSERT INTO store_settings (setting_key, setting_value) 
VALUES ('hero_banner_url', '') 
ON CONFLICT (setting_key) DO NOTHING;

-- Agregar escenas independientes para videos
INSERT INTO store_settings (setting_key, setting_value) 
VALUES ('escena_1_url', '') 
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO store_settings (setting_key, setting_value) 
VALUES ('escena_2_url', '') 
ON CONFLICT (setting_key) DO NOTHING;

-- ==========================================================
-- 10. PASSWORD RESETS (recuperación de contraseña por email)
-- Tabla ligera y desacoplada: trata el email como identificador
-- de acceso local. No depende de users ni de roles.
-- ==========================================================
CREATE TABLE IF NOT EXISTS password_resets (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email      VARCHAR(150) NOT NULL,
    token      UUID         NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    expires_at TIMESTAMPTZ  NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '15 minutes'),
    created_at TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Índice para validar tokens rápidamente
CREATE INDEX IF NOT EXISTS idx_password_resets_token
    ON password_resets(token);

-- Índice para limpiar tokens viejos por email
CREATE INDEX IF NOT EXISTS idx_password_resets_email
    ON password_resets(email);

-- ==========================================================
-- 11. ADDITIONAL INDEXES FOR SCALABILITY
-- ==========================================================
CREATE INDEX IF NOT EXISTS idx_sales_created_at_desc ON sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_idempotency_key ON sales(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ==========================================================
-- 12. ACTUALIZACIÓN DE ESTADOS PARA MÁQUINA DE ESTADOS
-- ==========================================================
-- Convertir ventas existentes con estado APPROVED a PAID
-- (PAID es el nuevo estado canónico para pagos aprobados)
UPDATE sales SET status = 'PAID' WHERE status = 'APPROVED';

-- Nota: El estado APPROVED se mantiene como alias por compatibilidad
-- pero internamente el sistema usa PAID para pagos aprobados
