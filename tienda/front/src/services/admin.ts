import { API_URL } from "../config/api";
import { Product, Subcategory } from "../types";

interface CreateCategoryData {
  name: string;
  description?: string;
  icon?: string;
  subcategories?: Subcategory[];
}

interface UpdateUserData {
  full_name?: string;
  email?: string;
  phone?: string;
  role?: string;
  status?: boolean;
  password?: string;
}

interface GetSalesParams {
  page?: number;
  limit?: number;
  status?: string;
  month?: string;
  search?: string;
}

export const adminService = {
  async listUploads(
    bucket: "productos" | "facturas" | "videos",
    token?: string | null,
  ) {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${API_URL}/uploads/${bucket}`, {
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error((error as any).error || "Error al listar archivos");
    }

    return response.json();
  },

  async deleteUpload(
    bucket: "productos" | "facturas" | "videos",
    filename: string,
    token: string,
  ) {
    const response = await fetch(
      `${API_URL}/uploads/${bucket}/${encodeURIComponent(filename)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error((error as any).error || "Error al eliminar archivo");
    }

    return response.json();
  },
  async createProduct(product: Partial<Product>, token: string) {
    const response = await fetch(`${API_URL}/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(product),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Error al crear producto");
    }

    return response.json();
  },

  async updateProduct(id: string, product: Partial<Product>, token: string) {
    const response = await fetch(`${API_URL}/products/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(product),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Error al actualizar producto");
    }

    return response.json();
  },

  async deleteProduct(id: string, token: string) {
    const response = await fetch(`${API_URL}/products/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Error al eliminar producto");
    }

    return response.json();
  },

  async createCategory(
    category: CreateCategoryData,
    token: string,
  ) {
    const response = await fetch(`${API_URL}/categories`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(category),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error((data as any).error || "Error al crear categoría");
    }

    return data;
  },

  async updateCategory(
    id: string,
    category: CreateCategoryData,
    token: string,
  ) {
    const response = await fetch(`${API_URL}/categories/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(category),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error((data as any).error || "Error al actualizar categoría");
    }

    return data;
  },

  async deleteCategory(id: string, token: string) {
    const response = await fetch(`${API_URL}/categories/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error((data as any).error || "Error al eliminar categoría");
    }

    return data;
  },

  async uploadImage(file: File, token: string) {
    const formData = new FormData();
    formData.append("image", file);

    const response = await fetch(`${API_URL}/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || "Error al subir la imagen");
    }

    return response.json();
  },

  async uploadVideo(file: File, token: string) {
    const formData = new FormData();
    formData.append("video", file);

    const response = await fetch(`${API_URL}/upload_video`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      try {
        const error = JSON.parse(errorBody);
        throw new Error(error.error || "Error al subir el video");
      } catch {
        throw new Error(errorBody || "Error al subir el video");
      }
    }

    return response.json();
  },

  async getSettings() {
    const response = await fetch(`${API_URL}/settings`);
    if (!response.ok) {
      throw new Error("Error al obtener config");
    }
    return response.json();
  },

  async updateSettings(settings: Record<string, string>, token: string) {
    const response = await fetch(`${API_URL}/settings`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(settings),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || "Error al guardar config");
    }
    return response.json();
  },

  async getSales(token: string, params?: GetSalesParams) {
    let url = `${API_URL}/sales`;
    if (params) {
      const query = new URLSearchParams();
      if (params.page) query.append("page", params.page.toString());
      if (params.limit) query.append("limit", params.limit.toString());
      if (params.status) query.append("status", params.status);
      if (params.month) query.append("month", params.month);
      if (params.search) query.append("search", params.search);
      if (query.toString()) url += `?${query.toString()}`;
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Error al obtener pedidos");
    }

    return response.json();
  },

  async getSalesMonths(token: string) {
    const response = await fetch(`${API_URL}/sales/months`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Error al obtener meses");
    }

    return response.json();
  },

  async updateSaleStatus(id: string, status: string, token: string) {
    const response = await fetch(`${API_URL}/sales/${id}/status`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Error al actualizar estado");
    }

    return response.json();
  },

  async getUsers(token: string) {
    const response = await fetch(`${API_URL}/users/`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Error al obtener usuarios");
    }

    return response.json();
  },

  async updateUser(id: string, data: UpdateUserData, token: string) {
    const response = await fetch(`${API_URL}/users/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Error al actualizar usuario");
    }

    return response.json();
  },

  async updateProductStatus(id: string, status: boolean, token: string) {
    const response = await fetch(`${API_URL}/products/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ enabled: status }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Error al actualizar estado del producto");
    }

    return response.json();
  },

  async listUploadProductos(token: string) {
    return this.listUploads("productos", token);
  },

  async createAdmin(
    data: { full_name: string; email: string; password: string; phone?: string },
    token: string
  ) {
    const response = await fetch(`${API_URL}/users/create-admin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Error al crear administrador");
    }

    return response.json();
  },
};
