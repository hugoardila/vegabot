import { API_URL } from "../config/api";
import { User } from "../types";

export interface AuthResponse {
  token: string;
  user: User;
}

export interface SaintCustomerMatch {
  code: string;
  full_name: string;
  id_number: string;
  phone: string;
  email: string;
}

export const authService = {
  async searchSaintCustomers(query: string): Promise<SaintCustomerMatch[]> {
    const response = await fetch(`${API_URL}/saint-customers/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || "No fue posible consultar los clientes");
    }
    const data = await response.json();
    return Array.isArray(data.items) ? data.items : [];
  },

  async loginWithSaintCustomer(client_code: string, email?: string): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/auth/saint-client`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_code, email }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || "No fue posible iniciar sesión");
    }
    return response.json();
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Error al iniciar sesión");
    }

    return response.json();
  },

  async register(full_name: string, email: string, password: string, phone: string): Promise<User> {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name, email, password, phone }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Error al registrarse");
    }

    return response.json();
  },

  async googleLogin(token: string): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Error al iniciar sesión con Google");
    }

    return response.json();
  },

  async updateProfile(token: string, data: Partial<User>): Promise<{ message: string }> {
    const response = await fetch(`${API_URL}/users/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Error al actualizar perfil");
    }

    return response.json();
  },

  // ── Password Reset ────────────────────────────────────────────────────────

  /** Solicita un token de recuperación; siempre retorna 200 por seguridad */
  async forgotPassword(email: string): Promise<{ message: string }> {
    const response = await fetch(`${API_URL}/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Error al procesar la solicitud");
    }

    return response.json();
  },

  /** Verifica si un token UUID es válido y no ha expirado */
  async verifyResetToken(token: string): Promise<{ valid: boolean; email: string; expires_at: string }> {
    const response = await fetch(
      `${API_URL}/auth/verify-reset-token?token=${encodeURIComponent(token)}`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Token inválido o expirado");
    }

    return response.json();
  },

  /** Restablece la contraseña usando el token UUID recibido por email */
  async resetPassword(token: string, password: string): Promise<{ message: string }> {
    const response = await fetch(`${API_URL}/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Error al restablecer la contraseña");
    }

    return response.json();
  },

  async getMySales(token: string) {
    const response = await fetch(`${API_URL}/sales/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Error al obtener tus pedidos");
    }

    return response.json();
  },
};
