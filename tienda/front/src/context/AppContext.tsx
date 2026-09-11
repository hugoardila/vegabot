import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Product, Category, User, Sale } from "../types";
import { API_URL } from "../config/api";
import { useAuth } from "./AuthContext";
import { adminService } from "../services/admin";
import { DEFAULT_WHOLESALE_POLICY, getWholesalePolicy, priceStoreCart } from "../utils/pricing";

interface AppContextType {
  cart: Array<{ product: Product; quantity: number }>;
  addToCart: (product: Product) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, delta: number) => void;
  clearCart: () => void;
  subtotal: number;
  shippingCost: number;
  total: number;
  products: Product[];
  categories: string[];
  categoriesData: Category[];
  isAuthenticated: boolean;
  isAdmin: boolean;
  user: User | null;
  isMenuOpen: boolean;
  setIsMenuOpen: (open: boolean) => void;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  heroBannerUrl: string | null;
  escena1Url: string | null;
  escena2Url: string | null;
  activeView: string;
  setActiveView: (view: string) => void;
  activeCategory: string;
  setActiveCategory: (category: string) => void;
  activeSubcategory: string;
  setActiveSubcategory: (subcategory: string) => void;
  sales: Sale[];
  users: User[];
  statusCounts: Record<string, number>;
  isSalesLoading: boolean;
  isUsersLoading: boolean;
  isSubmitting: boolean;
  editingProduct: Partial<Product> | null;
  setEditingProduct: (product: Partial<Product> | null) => void;
  isProductModalOpen: boolean;
  setIsProductModalOpen: (open: boolean) => void;
  editingCategory: (Category & { icon?: string }) | null;
  setEditingCategory: React.Dispatch<React.SetStateAction<(Category & { icon?: string }) | null>>;
  isCategoryModalOpen: boolean;
  setIsCategoryModalOpen: (open: boolean) => void;
  isPaymentModalOpen: boolean;
  setIsPaymentModalOpen: (open: boolean) => void;
  checkoutStatus: { success: boolean; message: string } | null;
  setCheckoutStatus: (status: { success: boolean; message: string } | null) => void;

  selectedReviewsProduct: Product | null;
  setSelectedReviewsProduct: (product: Product | null) => void;
  selectedProduct: Product | null;
  setSelectedProduct: (product: Product | null) => void;
  searchResults: Product[];
  setSearchResults: (products: Product[]) => void;
  fetchData: () => Promise<void>;
  fetchSales: () => Promise<void>;
  fetchUsers: () => Promise<void>;
  handleUpdateUser: (id: string, data: { role?: string; status?: boolean; password?: string; email?: string }) => Promise<void>;
  handleCreateAdmin: (data: { full_name: string; email: string; password: string; phone?: string }) => Promise<void>;
  handleViewProduct: (product: Product) => void;
  handleOpenProductModal: (product?: Product) => void;
  handleDeleteProduct: (id: string) => Promise<void>;
  handleSaveProduct: () => Promise<void>;
  handleSaveCategory: (icon: string) => Promise<void>;
  handleEditCategory: (cat: Category) => void;
  handleDeleteCategory: (id: string) => Promise<void>;
  handleInitiateCheckout: () => void;
  handleDirectOwner: () => void;
  handleWompiCheckout: () => void;
  handleCheckout: (method?: string) => Promise<void>;
  handleUpdateStatus: (id: string, status: string) => Promise<void>;
  handleUpdateProductStatus: (id: string, status: boolean) => Promise<void>;
  mounted: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mounted, setMounted] = useState(false);
  const [cart, setCart] = useState<Array<{ product: Product; quantity: number }>>(() => {
    const saved = localStorage.getItem("pos_cart");
    return saved ? JSON.parse(saved) : [];
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>(["Todos"]);
  const [categoriesData, setCategoriesData] = useState<Category[]>([]);
  const [heroBannerUrl, setHeroBannerUrl] = useState<string | null>(null);
  const [escena1Url, setEscena1Url] = useState<string | null>(null);
  const [escena2Url, setEscena2Url] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<string>(() => {
    const saved = localStorage.getItem("pos_active_view");
    return saved || "products";
  });
  const [activeCategory, setActiveCategory] = useState<string>("Todos");
  const [activeSubcategory, setActiveSubcategory] = useState<string>("Todos");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [sales, setSales] = useState<Sale[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [isSalesLoading, setIsSalesLoading] = useState(false);
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<(Category & { icon?: string }) | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [checkoutStatus, setCheckoutStatus] = useState<{ success: boolean; message: string } | null>(null);

  const [selectedReviewsProduct, setSelectedReviewsProduct] = useState<Product | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [cartNotice, setCartNotice] = useState<{ id: string; name: string; price: number } | null>(null);
  const [wholesalePolicy, setWholesalePolicy] = useState(DEFAULT_WHOLESALE_POLICY);

  const { isAuthenticated, user, token } = useAuth();
  const navigate = useNavigate();

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const cartPricing = useMemo(() => priceStoreCart(cart, wholesalePolicy), [cart, wholesalePolicy]);
  const pricedCart = cartPricing.items;
  const subtotal = cartPricing.subtotal;
  const shippingCost = 0;
  const total = subtotal;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem("pos_cart", JSON.stringify(cart));
    }
  }, [cart, mounted]);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem("pos_active_view", activeView);
    }
  }, [activeView, mounted]);

  const addToCart = (product: Product) => {
    const existingCartItem = cart.find((item) => item.product.id === product.id);
    if (product.stock <= 0 || (existingCartItem && existingCartItem.quantity >= product.stock)) {
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    setCartNotice({ id: `${product.id}-${Date.now()}`, name: product.name, price: product.price });
  };

  useEffect(() => {
    if (!cartNotice) return;
    const timer = window.setTimeout(() => setCartNotice(null), 1800);
    return () => window.clearTimeout(timer);
  }, [cartNotice]);

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== id));
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.product.id !== id) return item;
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          if (newQty > item.product.stock) return item;
          return { ...item, quantity: newQty };
        })
        .filter((item): item is { product: Product; quantity: number } => item !== null);   
    });
  };

  const clearCart = () => setCart([]);

  const fetchData = async () => {
    try {
      const [prodRes, catRes, settingsRes] = await Promise.all([
        fetch(`${API_URL}/products`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        }),
        fetch(`${API_URL}/categories`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        }),
        adminService.getSettings().catch(() => ({})),
      ]);

      if (prodRes.ok) {
        const freshProducts: Product[] = await prodRes.json();
        const productsById = new Map(freshProducts.map((product) => [String(product.id), product]));
        setProducts(freshProducts);
        setCart((currentCart) => currentCart
          .map((item) => {
            const freshProduct = productsById.get(String(item.product.id));
            return freshProduct ? { ...item, product: freshProduct } : null;
          })
          .filter((item): item is { product: Product; quantity: number } => item !== null));
      }

      if (catRes.ok) {
        const data: Category[] = await catRes.json();
        setCategories(["Todos", ...data.map((c) => c.name)]);
        setCategoriesData(data);
      }

      if (settingsRes?.hero_banner_url) {
        setHeroBannerUrl(settingsRes.hero_banner_url);
      }
      if (settingsRes?.escena_1_url) {
        setEscena1Url(settingsRes.escena_1_url);
      }
      if (settingsRes?.escena_2_url) {
        setEscena2Url(settingsRes.escena_2_url);
      }
      setWholesalePolicy(getWholesalePolicy(settingsRes || {}));
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const fetchSales = async () => {
    if (!token) return;
    setIsSalesLoading(true);
    try {
      const resp = await adminService.getSales(token, { limit: 10 });
      setSales(resp.data);
      if (resp.status_counts) setStatusCounts(resp.status_counts);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSalesLoading(false);
    }
  };

  const fetchUsers = async () => {
    if (!token) return;
    setIsUsersLoading(true);
    try {
      const data = await adminService.getUsers(token);
      setUsers(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsUsersLoading(false);
    }
  };

  const handleUpdateUser = async (id: string, data: { role?: string; status?: boolean; password?: string; email?: string }) => {
    if (!token) return;
    try {
      await adminService.updateUser(id, data, token);
      fetchUsers();
    } catch (error) {
      console.error(error);
      alert("Error al actualizar usuario");
    }
  };

  const handleCreateAdmin = async (data: { full_name: string; email: string; password: string; phone?: string }) => {
    if (!token) return;
    try {
      await adminService.createAdmin(data, token);
      fetchUsers();
    } catch (error: any) {
      console.error(error);
      throw error;
    }
  };

  const handleViewProduct = (product: Product) => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setSelectedProduct(product);
  };

  const handleOpenProductModal = (product?: Product) => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    if (product) {
      setEditingProduct(product);
    } else {
      setEditingProduct({
        name: "",
        price: 0,
        stock: 0,
        images: [],
        category_id: categoriesData[0]?.id,
        subcategory_id: "",
        free_shipping: false,
        promotion_enabled: false,
        promotion_percent: 0,
        enabled: true,
      });
    }
    setIsProductModalOpen(true);
  };

  const handleDeleteProduct = async (id: string) => {
    if (!token) return;
    if (!confirm("¿Estás seguro de que quieres eliminar este producto?"))
      return;
    setIsSubmitting(true);
    try {
      await adminService.deleteProduct(id, token);
      fetchData();
    } catch (error) {
      console.error(error);
      alert("Error al eliminar el producto");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveProduct = async () => {
    if (!editingProduct || !token) return;
    setIsSubmitting(true);
    try {
      if (editingProduct.id) {
        await adminService.updateProduct(
          editingProduct.id,
          editingProduct,
          token,
        );
      } else {
        await adminService.createProduct(editingProduct, token);
      }
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      setIsProductModalOpen(false);
      fetchData();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveCategory = async (icon: string) => {
    if (!editingCategory?.name.trim() || !token) return;
    setIsSubmitting(true);
    try {
      if (editingCategory.id) {
        const updated = await adminService.updateCategory(
          editingCategory.id,
          {
            name: editingCategory.name,
            icon,
            subcategories: editingCategory.subcategories || [],
          },
          token,
        );
        setCategoriesData((prev) =>
          prev.map((c) => (c.id === updated.id ? updated : c)),
        );
        setCategories((prev) =>
          prev.map((name) =>
            name === editingCategory.name ? updated.name : name,
          ),
        );
      } else {
        const created = await adminService.createCategory(
          {
            name: editingCategory.name,
            icon,
            subcategories: editingCategory.subcategories || [],
          },
          token,
        );
        setCategoriesData((prev) => [...prev, created]);
        setCategories((prev) => [...prev, created.name]);
      }
      setIsCategoryModalOpen(false);
      setEditingCategory(null);
    } catch (error) {
      console.error(error);
      alert("Error al guardar la categoría: " + (error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditCategory = (cat: Category) => {
    setEditingCategory({
      ...cat,
      subcategories: (cat.subcategories || []).map((subcategory) => ({ ...subcategory })),
    });
    setIsCategoryModalOpen(true);
  };

  const handleDeleteCategory = async (id: string) => {
    if (!token) return;
    if (
      !confirm(
        "¿Estás seguro de que quieres eliminar esta categoría? Se eliminarán los productos asociados o quedarán sin categoría.",
      )
    )
      return;
    setIsSubmitting(true);
    try {
      await adminService.deleteCategory(id, token);
      fetchData();
    } catch (error) {
      console.error(error);
      alert("Error al eliminar la categoría");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInitiateCheckout = () => {
    if (cart.length === 0) return;
    setCheckoutStatus(null);
    setIsPaymentModalOpen(true);
  };

  const handleDirectOwner = () => {
    setIsPaymentModalOpen(false);
    if (!isAuthenticated) {
      navigate("/login", { state: { from: { pathname: "/checkout", state: { cart: pricedCart, subtotal, total } } } });
      return;
    }
    navigate("/checkout", { state: { cart: pricedCart, subtotal, total } });
  };

  const handleWompiCheckout = () => {
    setIsPaymentModalOpen(false);
    if (!isAuthenticated) {
      navigate("/login", { state: { from: { pathname: "/checkout-wompi", state: { cart: pricedCart, subtotal, total } } } });
      return;
    }
    navigate("/checkout-wompi", { state: { cart: pricedCart, subtotal, total } });
  };

  const handleCheckout = async (method: string = "Efectivo") => {
    if (cart.length === 0) return;
    setIsSubmitting(true);
    setCheckoutStatus(null);

    const saleData = {
      customer_phone: "0000000000",
      payment_method: method,
      items: pricedCart.map((item) => ({
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.product.price,
      })),
    };

    try {
      const res = await fetch(`${API_URL}/sales`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(saleData),
      });
      if (res.ok) {
        setCart([]);
        setCheckoutStatus({
          success: true,
          message: "¡Venta realizada con éxito!",
        });
        setIsCartOpen(false);
        fetchData();
      } else {
        const errData = await res.json();
        setCheckoutStatus({
          success: false,
          message: errData.message || "Error al procesar la venta",
        });
      }
    } catch (error) {
      setCheckoutStatus({
        success: false,
        message: "Error de conexión al servidor",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    if (!token) return;
    try {
      await adminService.updateSaleStatus(id, status, token);
      fetchSales();
    } catch (error) {
      console.error(error);
    }
  };

  const handleUpdateProductStatus = async (id: string, status: boolean) => {
    if (!token) return;
    try {
      await adminService.updateProductStatus(id, status, token);
      fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  // Sync search results with products when products change
  useEffect(() => {
    setSearchResults(products);
  }, [products]);

  useEffect(() => {
    if (activeSubcategory === "Todos") return;
    const selectedCategory = categoriesData.find((category) => category.name === activeCategory);
    const subcategoryExists = selectedCategory?.subcategories?.some(
      (subcategory) => subcategory.id === activeSubcategory,
    );
    if (!subcategoryExists) setActiveSubcategory("Todos");
  }, [activeCategory, activeSubcategory, categoriesData]);

  useEffect(() => {
    if (isAdmin) {
      fetchSales();
      fetchUsers();
    }
  }, [isAdmin, token]);

  return (
    <AppContext.Provider
      value={{
        cart: pricedCart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        subtotal,
        shippingCost,
        total,
        products,
        categories,
        categoriesData,
        isAuthenticated,
        isAdmin,
        user,
        isMenuOpen,
        setIsMenuOpen,
        isCartOpen,
        setIsCartOpen,
        heroBannerUrl,
        escena1Url,
        escena2Url,
        activeView,
        setActiveView,
        activeCategory,
        setActiveCategory,
        activeSubcategory,
        setActiveSubcategory,
        sales,
        users,
        statusCounts,
        isSalesLoading,
        isUsersLoading,
        isSubmitting,
        editingProduct,
        setEditingProduct,
        isProductModalOpen,
        setIsProductModalOpen,
        editingCategory,
        setEditingCategory,
        isCategoryModalOpen,
        setIsCategoryModalOpen,
        isPaymentModalOpen,
        setIsPaymentModalOpen,
        checkoutStatus,
        setCheckoutStatus,

        selectedReviewsProduct,
        setSelectedReviewsProduct,
        selectedProduct,
        setSelectedProduct,
        searchResults,
        setSearchResults,
        fetchData,
        fetchSales,
        fetchUsers,
        handleUpdateUser,
        handleCreateAdmin,
        handleViewProduct,
        handleOpenProductModal,
        handleDeleteProduct,
        handleSaveProduct,
        handleSaveCategory,
        handleEditCategory,
        handleDeleteCategory,
        handleInitiateCheckout,
        handleDirectOwner,
        handleWompiCheckout,
        handleCheckout,
        handleUpdateStatus,
        handleUpdateProductStatus,
        mounted,
      }}
    >
      {children}
      <AnimatePresence>
        {cartNotice && (
          <motion.div
            key={cartNotice.id}
            initial={{ opacity: 0, y: 28, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.96 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="fixed left-3 right-3 bottom-4 sm:left-auto sm:right-5 sm:w-[360px] z-[9999] pointer-events-none"
          >
            <div className="rounded-2xl border border-emerald-400/30 bg-white/95 dark:bg-zinc-950/95 shadow-2xl shadow-emerald-500/15 backdrop-blur-xl p-3 flex items-center gap-3">
              <motion.div
                initial={{ rotate: -18, scale: 0.7 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 520, damping: 18 }}
                className="size-11 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-black text-lg shrink-0"
              >
                +
              </motion.div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                  Agregado al carrito
                </p>
                <p className="text-sm font-semibold text-black/80 dark:text-white/85 truncate">
                  {cartNotice.name}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
};
