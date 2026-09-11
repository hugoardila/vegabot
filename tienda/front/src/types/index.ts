export interface Product {
  id: string;
  name: string;
  saint_name?: string;
  category_id?: string;
  category_name?: string;
  subcategory_id?: string;
  subcategory_name?: string;
  price: number;
  price_1?: number;
  price_2?: number;
  price_level?: 1 | 2;
  free_shipping?: boolean;
  promotion_enabled?: boolean;
  promotion_percent?: number;
  enabled?: boolean;
  status?: boolean;
  stock: number;
  images: string[];
  description?: string;
}

export interface Subcategory {
  id: string;
  category_id?: string;
  category_name?: string;
  name: string;
  icon?: string;
  product_count?: number;
}

export interface Category {
  id: string;
  name: string;
  icon?: string;
  subcategories?: Subcategory[];
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  product_name?: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  product?: Product; // Optional for details
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Sale {
  id: string;
  customer_id?: string;
  customer_name?: string;
  customer_email?: string;
  total_amount: number;
  customer_phone: string;
  customer_id_number?: string;
  delivery_address?: string;
  delivery_country?: string;
  delivery_department?: string;
  delivery_city?: string;
  delivery_additional_info?: string;
  payment_method: string;
  status: string;
  whatsapp_sent_customer: boolean;
  whatsapp_sent_admin: boolean;
  receipts?: string[];
  created_at: string;
  updated_at: string;
  items?: SaleItem[];
}

export interface User {
  id: string;
  full_name: string;
  email: string;
  role: 'admin' | 'cliente' | 'super_admin';
  status: boolean;
  phone?: string;
  id_number?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}
