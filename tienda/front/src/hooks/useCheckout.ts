import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useApp } from "../context/AppContext";
import { Category } from "../types";
import { DeliveryMethod, CheckoutErrors, CheckoutStatus, SaleData } from "../types/checkout";
import { COLOMBIA_DEPARTMENTS, MUNICIPALITIES_BY_DEPARTMENT } from "../utils/colombiaGeography";
import { isValidCheckoutPhone, normalizeCheckoutPhone } from "../utils/phone";
import { getCheckoutProfile } from "../utils/checkoutProfile";

export { CARRIERS } from "../data/carriers";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

export const DEPARTMENTS = COLOMBIA_DEPARTMENTS;

export const CITIES_BY_DEPARTMENT = MUNICIPALITIES_BY_DEPARTMENT;

export const PAYMENT_METHODS: Array<{
  id: string;
  name: string;
  emoji: string;
  img: string;
  note?: string;
}> = [
  { id: "nequi", name: "Nequi", emoji: "📱", img: "/img/Nequi.jpg" },
  { id: "bancolombia", name: "Bancolombia", emoji: "🏦", img: "/img/Bancolombia.png" },
  { id: "contraentrega", name: "Contraentrega", emoji: "$", img: "", note: "Paga al recibir" },
];

export const MAX_RECEIPTS = 2;

export function useCheckout() {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const { clearCart, cart, subtotal } = useApp();
  const checkoutProfile = getCheckoutProfile();
  const profileFullName = user?.full_name || checkoutProfile.fullName;

  // Form states
  const [firstName, setFirstName] = useState(() => {
    const fullName = profileFullName;
    return fullName.split(" ")[0] || "";
  });
  const [lastName, setLastName] = useState(() => {
    const fullName = profileFullName;
    const parts = fullName.split(" ");
    return parts.slice(1).join(" ") || "";
  });
  const [phone, setPhone] = useState(() => normalizeCheckoutPhone(user?.phone || checkoutProfile.phone));
  const [idNumber, setIdNumber] = useState(user?.id_number || checkoutProfile.idNumber || "");
  const [department, setDepartment] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [delivery, setDelivery] = useState<DeliveryMethod | null>(null);
  const [carrier, setCarrier] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<File[]>([]);
  
  // Modal states
  const [pendingCarrier, setPendingCarrier] = useState<string | null>(null);
  const [isCarrierModalOpen, setIsCarrierModalOpen] = useState(false);
  const [pendingDepartment, setPendingDepartment] = useState<string>("");
  const [isDepartmentModalOpen, setIsDepartmentModalOpen] = useState(false);
  const [departmentSearchQuery, setDepartmentSearchQuery] = useState<string>("");
  const [pendingCity, setPendingCity] = useState<string>("");
  const [isCityModalOpen, setIsCityModalOpen] = useState(false);
  const [citySearchQuery, setCitySearchQuery] = useState<string>("");
  
  // Other states
  const carrierConfirmedRef = useRef(false);
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<CheckoutStatus | null>(null);
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);
  const [categoriesData, setCategoriesData] = useState<Category[]>([]);
  const [paymentSettings, setPaymentSettings] = useState({
    bankInfo: "",
    paymentTerms: "",
  });

  const availableCities = department ? (MUNICIPALITIES_BY_DEPARTMENT[department] || []) : [];
  const shippingCost = 0;
  const total = subtotal;

  // Keep in sync if user loads after component mounts
  useEffect(() => {
    const fullName = user?.full_name || checkoutProfile.fullName;
    if (fullName) {
      const parts = fullName.split(" ");
      if (!firstName) setFirstName(parts[0] || "");
      if (!lastName) setLastName(parts.slice(1).join(" ") || "");
    }
    const profilePhone = user?.phone || checkoutProfile.phone;
    const profileIdNumber = user?.id_number || checkoutProfile.idNumber;
    if (profilePhone && !phone) setPhone(normalizeCheckoutPhone(profilePhone));
    if (profileIdNumber && !idNumber) setIdNumber(profileIdNumber);
  }, [user, checkoutProfile.fullName, checkoutProfile.phone, checkoutProfile.idNumber, firstName, lastName, phone, idNumber]);

  // Load categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch(`${API_URL}/categories`);
        if (res.ok) {
          const data: Category[] = await res.json();
          setCategoriesData(data);
        }
      } catch (error) {
        console.error("Error loading categories:", error);
      }
    };
    fetchCategories();
  }, []);

  // Read the latest payment instructions when the customer opens checkout.
  useEffect(() => {
    const fetchPaymentSettings = async () => {
      try {
        const res = await fetch(`${API_URL}/settings`, { cache: "no-store" });
        if (!res.ok) return;

        const data = await res.json();
        setPaymentSettings({
          bankInfo: typeof data.bankInfo === "string" ? data.bankInfo.trim() : "",
          paymentTerms: typeof data.paymentTerms === "string" ? data.paymentTerms.trim() : "",
        });
      } catch (error) {
        console.error("Error loading payment settings:", error);
      }
    };

    fetchPaymentSettings();
  }, []);

  const validate = useCallback(() => {
    const e: CheckoutErrors = {};
    if (!firstName.trim()) e.firstName = "Nombre requerido";
    if (!lastName.trim()) e.lastName = "Apellido requerido";
    if (!phone.trim()) e.phone = "Teléfono requerido";
    else if (!isValidCheckoutPhone(phone)) e.phone = "Ingresa exactamente 10 dígitos";
    if (!idNumber.trim()) e.idNumber = "Número de cédula requerido";
    
    if (delivery === "shipping") {
      if (!department.trim()) e.department = "Departamento requerido";
      if (!city.trim()) e.city = "Municipio requerido";
      if (!address.trim()) e.address = "Dirección requerida";
      if (!carrier) e.carrier = "Selecciona la transportadora";
    }
    
    if (!delivery) e.delivery = "Selecciona cómo recibirás tu pedido";
    if (!paymentMethod) e.payment = "Selecciona el método de pago";
    if (paymentMethod && paymentMethod !== "Contraentrega" && receipts.length < 1) {
      e.receipts = "Debes subir al menos 1 foto del comprobante";
    }
    
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [firstName, lastName, phone, idNumber, delivery, department, city, address, carrier, paymentMethod, receipts.length]);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedNumber(text);
    setTimeout(() => setCopiedNumber(null), 2000);
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setReceipts((prev) => {
        if (prev.length >= MAX_RECEIPTS) {
          setErrors((errs) => ({ ...errs, receipts: `Máximo ${MAX_RECEIPTS} fotos permitidas` }));
          return prev;
        }
        const combined = [...prev, ...filesArray].slice(0, MAX_RECEIPTS);
        if (combined.length >= 1) {
          setErrors((errs) => {
            const newE = { ...errs };
            delete newE.receipts;
            return newE;
          });
        }
        return combined;
      });
      e.target.value = "";
    }
  }, []);

  const removeFile = useCallback((index: number) => {
    setReceipts((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Modal handlers
  const openCarrierModal = useCallback(() => {
    setPendingCarrier(carrier);
    setIsCarrierModalOpen(true);
  }, [carrier]);

  const confirmCarrier = useCallback(() => {
    carrierConfirmedRef.current = true;
    setCarrier(pendingCarrier);
    setIsCarrierModalOpen(false);
  }, [pendingCarrier]);

  const openDepartmentModal = useCallback(() => {
    setPendingDepartment(department);
    setDepartmentSearchQuery("");
    setIsDepartmentModalOpen(true);
  }, [department]);

  const confirmDepartment = useCallback(() => {
    setDepartment(pendingDepartment);
    if (pendingDepartment !== department) {
      setCity("");
    }
    setIsDepartmentModalOpen(false);
  }, [pendingDepartment, department]);

  const openCityModal = useCallback(() => {
    if (!department) return;
    setPendingCity(city);
    setCitySearchQuery("");
    setIsCityModalOpen(true);
  }, [department, city]);

  const confirmCity = useCallback(() => {
    setCity(pendingCity);
    setIsCityModalOpen(false);
  }, [pendingCity]);

  const handleConfirm = useCallback(async () => {
    if (!validate()) return;
    setIsSubmitting(true);
    setStatus(null);

    let finalReceiptUrls: string[] = [];

    if (paymentMethod !== "Contraentrega" && receipts.length > 0) {
      const formData = new FormData();
      receipts.forEach((file) => formData.append("receipts", file));

      try {
        const uploadRes = await fetch(`${API_URL}/upload_receipts`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}` },
          body: formData,
        });

        if (!uploadRes.ok) throw new Error("Unable to upload images");

        const uploadData = await uploadRes.json();
        finalReceiptUrls = uploadData.urls || [];
      } catch (err) {
        setStatus({ success: false, message: "Error al subir tus comprobantes. Intenta nuevamente." });
        setIsSubmitting(false);
        return;
      }
    }

    const deliveryString = delivery === "pickup" ? "Recoger en tienda" : carrier ?? "Envío";
    const isPickup = delivery === "pickup";
    
    const saleData: SaleData = {
      customer_phone: phone || "0000000000",
      customer_id_number: idNumber || "",
      delivery_address: isPickup ? "Recoger en tienda" : (address || ""),
      delivery_department: isPickup ? "" : (department || ""),
      delivery_city: isPickup ? "" : (city || ""),
      delivery_additional_info: isPickup ? "" : (additionalInfo || ""),
      payment_method: `${paymentMethod} – ${deliveryString}`,
      shipping_amount: shippingCost,
      amount_in_cents: Math.round(total * 100),
      receipts: finalReceiptUrls,
      items: cart.map((item) => ({
        product_id: item.product.id,
        product_name: item.product.name,
        quantity: item.quantity,
        unit_price: item.product.price,
      })),
    };

    try {
      const res = await fetch(`${API_URL}/sales`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(saleData),
      });

      if (res.ok) {
        const resData = await res.json();
        const saleId = resData.id ? `#${String(resData.id).padStart(5, "0")}` : "#NUEVO";

        const deliveryLine = delivery === "pickup"
          ? "🏪 Recoger en tienda"
          : `📦 Envío por: *${carrier ?? "Transportadora"}*`;

        const fullAddress = [
          address,
          city && department ? `${city}, ${department}` : "",
          additionalInfo
        ].filter(Boolean).join(" | ");

        const addressLine = fullAddress ? `📍 Dirección: ${fullAddress}` : "";

        const itemLines = cart
          .map((i) => `  • ${i.product.name} × ${i.quantity} = $${(i.product.price * i.quantity).toLocaleString("es-CO")}`)
          .join("\n");

        const fullName = `${firstName} ${lastName}`.trim();
        const paymentConfirmationLine = paymentMethod === "Contraentrega"
          ? "✅ Pedido contraentrega confirmado — el pago se realizará al recibir."
          : "✅ Pedido confirmado — por favor verificar comprobante de pago.";

        const waMsg = [
          `🛒 *NUEVO PEDIDO ${saleId}*`,
          `——————————————————————`,
          `👤 *Cliente:* ${fullName || "Sin nombre"}`,
          `📞 *Teléfono:* ${phone}`,
          ``,
          `*Entrega:*`,
          deliveryLine,
          addressLine,
          ``,
          `*Pago:* ${paymentMethod}`,
          ``,
          `*Productos:*`,
          itemLines,
          ``,
          `💰 *TOTAL: $${total.toLocaleString("es-CO")}*`,
          `——————————————————————`,
          paymentConfirmationLine,
        ].filter(Boolean).join("\n");

        const ADMIN_PHONE = "573214815817";
        const waUrl = `https://wa.me/${ADMIN_PHONE}?text=${encodeURIComponent(waMsg)}`;

        setStatus({ success: true, message: `¡Pedido confirmado${fullName ? `, ${fullName}` : ""}! Redirigiendo a WhatsApp...` });
        clearCart();
        localStorage.removeItem("pos_cart");

        setTimeout(() => {
          window.open(waUrl, "_blank");
          navigate("/", { replace: true });
        }, 1500);
      } else {
        const errData = await res.json();
        setStatus({ success: false, message: errData.error || "Error al procesar el pedido" });
      }
    } catch {
      setStatus({ success: false, message: "Error de conexión. Intenta de nuevo." });
    } finally {
      setIsSubmitting(false);
    }
  }, [validate, token, receipts, delivery, carrier, phone, idNumber, address, department, city, additionalInfo, paymentMethod, cart, shippingCost, total, firstName, lastName, navigate]);

  const itemCount = cart.reduce((a, b) => a + b.quantity, 0);

  return {
    // Data
    cart,
    subtotal,
    shippingCost,
    total,
    itemCount,
    user,
    token,
    categoriesData,
    paymentSettings,
    
    // Form states
    firstName,
    setFirstName,
    lastName,
    setLastName,
    phone,
    setPhone,
    idNumber,
    setIdNumber,
    department,
    setDepartment,
    city,
    setCity,
    address,
    setAddress,
    additionalInfo,
    setAdditionalInfo,
    delivery,
    setDelivery,
    carrier,
    setCarrier,
    paymentMethod,
    setPaymentMethod,
    receipts,
    setReceipts,
    
    // Modal states
    pendingCarrier,
    setPendingCarrier,
    isCarrierModalOpen,
    setIsCarrierModalOpen,
    pendingDepartment,
    setPendingDepartment,
    isDepartmentModalOpen,
    setIsDepartmentModalOpen,
    departmentSearchQuery,
    setDepartmentSearchQuery,
    pendingCity,
    setPendingCity,
    isCityModalOpen,
    setIsCityModalOpen,
    citySearchQuery,
    setCitySearchQuery,
    carrierConfirmedRef,
    
    // Other states
    errors,
    isSubmitting,
    status,
    copiedNumber,
    
    // Constants
    availableCities,
    DEPARTMENTS,
    
    // Handlers
    handleCopy,
    handleFileChange,
    removeFile,
    openCarrierModal,
    confirmCarrier,
    openDepartmentModal,
    confirmDepartment,
    openCityModal,
    confirmCity,
    handleConfirm,
    navigate,
  };
}
