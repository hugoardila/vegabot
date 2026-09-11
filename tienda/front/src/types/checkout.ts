import { CartItem } from "./index";

export type DeliveryMethod = "pickup" | "shipping";

export interface LocationState {
  cart: CartItem[];
  subtotal: number;
  total: number;
}

export interface SaleItemData {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

export interface SaleData {
  customer_phone: string;
  customer_id_number: string;
  delivery_address: string;
  delivery_department: string;
  delivery_city: string;
  delivery_additional_info: string;
  payment_method: string;
  shipping_amount?: number;
  amount_in_cents?: number;
  receipts: string[];
  items: SaleItemData[];
}

export interface Carrier {
  id: string;
  name: string;
  img: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  emoji: string;
  img: string;
}

export interface CheckoutErrors {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  idNumber?: string;
  department?: string;
  city?: string;
  address?: string;
  delivery?: string;
  carrier?: string;
  payment?: string;
  receipts?: string;
}

export interface CheckoutStatus {
  success: boolean;
  message: string;
}
