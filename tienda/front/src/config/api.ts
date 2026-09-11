declare global {
  interface Window {
    __VEGA_STORE_CONFIG__?: {
      googleClientId?: string;
      wompiPublicKey?: string;
      whatsappSupport?: string;
      whatsappSales?: string;
    };
  }
}

const runtimeConfig = typeof window !== "undefined" ? window.__VEGA_STORE_CONFIG__ || {} : {};

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080/api";
export const GOOGLE_CLIENT_ID = runtimeConfig.googleClientId || import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
export const WHATSAPP_SUPPORT_NUMBER = runtimeConfig.whatsappSupport || import.meta.env.VITE_WHATSAPP_SUPPORT || "573123756979";
export const WHATSAPP_SALES_NUMBER = runtimeConfig.whatsappSales || import.meta.env.VITE_WHATSAPP_SALES || "573115401997";
export const WOMPI_PUBLIC_KEY = runtimeConfig.wompiPublicKey || import.meta.env.VITE_WOMPI_PUBLIC_KEY || "";
export const WOMPI_WIDGET_URL = "https://checkout.wompi.co/p/";
export const JWT_EXPIRATION_TIME = 24 * 60 * 60 * 1000;
