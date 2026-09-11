import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useApp } from "../context/AppContext";
import { Category } from "../types";
import { DeliveryMethod, CheckoutErrors, CheckoutStatus } from "../types/checkout";
import { API_URL, WOMPI_PUBLIC_KEY } from "../config/api";
import { CARRIERS, DEPARTMENTS, CITIES_BY_DEPARTMENT } from "./useCheckout";
import { isValidCheckoutPhone, normalizeCheckoutPhone } from "../utils/phone";
import { getCheckoutProfile } from "../utils/checkoutProfile";

export { CARRIERS, DEPARTMENTS, CITIES_BY_DEPARTMENT };

export function useCheckoutWompi() {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const { clearCart, cart, subtotal } = useApp();
  const checkoutProfile = getCheckoutProfile();
  const profileFullName = user?.full_name || checkoutProfile.fullName;

  // Estados para categorías
  const [categoriesData, setCategoriesData] = useState<Category[]>([]);

  // Pre-fill from user profile
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
  const [email, setEmail] = useState(user?.email || checkoutProfile.email || "");
  const [idNumber, setIdNumber] = useState(user?.id_number || checkoutProfile.idNumber || "");
  const [address, setAddress] = useState("");
  const [department, setDepartment] = useState("");
  const [city, setCity] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [delivery, setDelivery] = useState<DeliveryMethod | null>(null);
  const [carrier, setCarrier] = useState<string | null>(null);
  const [pendingCarrier, setPendingCarrier] = useState<string | null>(null);
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<CheckoutStatus | null>(null);
  
  // Modal states
  const [isCarrierModalOpen, setIsCarrierModalOpen] = useState(false);
  const [isDepartmentModalOpen, setIsDepartmentModalOpen] = useState(false);
  const [departmentSearchQuery, setDepartmentSearchQuery] = useState<string>("");
  const [isCityModalOpen, setIsCityModalOpen] = useState(false);
  const [citySearchQuery, setCitySearchQuery] = useState<string>("");
  const [pendingDepartment, setPendingDepartment] = useState<string>("");
  const [pendingCity, setPendingCity] = useState<string>("");
  const carrierConfirmedRef = useRef(false);

  const availableCities = department ? (CITIES_BY_DEPARTMENT[department] || []) : [];
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
    const profileEmail = user?.email || checkoutProfile.email;
    const profileIdNumber = user?.id_number || checkoutProfile.idNumber;
    if (profilePhone && !phone) setPhone(normalizeCheckoutPhone(profilePhone));
    if (profileEmail && !email) setEmail(profileEmail);
    if (profileIdNumber && !idNumber) setIdNumber(profileIdNumber);
  }, [user, checkoutProfile.fullName, checkoutProfile.phone, checkoutProfile.email, checkoutProfile.idNumber, firstName, lastName, phone, email, idNumber]);

  // Cargar categorías
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

  const validate = useCallback(() => {
    const e: CheckoutErrors = {};
    if (!firstName.trim()) e.firstName = "Nombre requerido";
    if (!lastName.trim()) e.lastName = "Apellido requerido";
    if (!phone.trim()) e.phone = "Teléfono requerido";
    else if (!isValidCheckoutPhone(phone)) e.phone = "Ingresa exactamente 10 dígitos";
    if (!idNumber.trim()) e.idNumber = "Número de cédula requerido";
    if (!email.trim()) e.email = "Email requerido";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Email inválido";
    
    if (delivery === "shipping") {
      if (!department) e.department = "Selecciona un departamento";
      if (!city) e.city = "Selecciona un municipio";
      if (!address.trim()) e.address = "Dirección requerida";
      if (!carrier) e.carrier = "Selecciona la transportadora";
    }
    
    if (!delivery) e.delivery = "Selecciona cómo recibirás tu pedido";
    
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [firstName, lastName, phone, idNumber, email, delivery, department, city, address, carrier]);

  const handlePayWithWompi = useCallback(async () => {
    if (!validate()) return;
    
    if (total < 1500) {
      setStatus({ success: false, message: "El monto mínimo para pagar con Wompi es $1,500 COP" });
      return;
    }
    
    if (!WOMPI_PUBLIC_KEY) {
      setStatus({ success: false, message: "Error: Wompi no está configurado. Contacta al administrador." });
      return;
    }

    setIsSubmitting(true);
    setStatus(null);

    try {
      const fullName = `${firstName} ${lastName}`.trim();
      const deliveryString = delivery === "pickup" ? "Recoger en tienda" : carrier ?? "Envío";
      const isPickup = delivery === "pickup";
      const fullAddress = isPickup 
        ? "Recoger en tienda"
        : additionalInfo 
          ? `${address}, ${city}, ${department} - ${additionalInfo}`
          : `${address}, ${city}, ${department}`;
      
      const shippingAddress = isPickup
        ? { address_line_1: "Recoger en tienda", country: "CO", phone_number: phone }
        : { address_line_1: fullAddress, country: "CO", phone_number: phone };

      const transactionData = {
        amount_in_cents: Math.round(total * 100),
        currency: "COP",
        customer_email: email,
        customer_data: {
          full_name: fullName,
          phone_number: phone,
          legal_id: idNumber,
          legal_id_type: "CC"
        },
        customer_id_number: idNumber,
        shipping_address: shippingAddress,
        delivery_department: isPickup ? null : department,
        delivery_city: isPickup ? null : city,
        delivery_additional_info: isPickup ? null : additionalInfo,
        redirect_url: `${window.location.origin}/tienda/payment-result`,
        reference: `ORDER-${Date.now()}`,
        delivery_method: deliveryString,
        shipping_amount: shippingCost,
        items: cart.map((item) => ({
          product_id: item.product.id,
          product_name: item.product.name,
          quantity: item.quantity,
          unit_price: item.product.price,
        })),
      };

      const res = await fetch(`${API_URL}/wompi/create-payment-link`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(transactionData),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Error al crear la transacción");
      }

      const data = await res.json();
      
      if (data.payment_url) {
        clearCart();
        localStorage.removeItem("pos_cart");
        window.location.href = data.payment_url;
        setStatus({ success: true, message: "Redirigiendo a Wompi..." });
      } else if (data.payment_link_id) {
        const paymentUrl = `https://checkout.wompi.co/l/${data.payment_link_id}`;
        clearCart();
        localStorage.removeItem("pos_cart");
        window.location.href = paymentUrl;
        setStatus({ success: true, message: "Redirigiendo a Wompi..." });
      } else {
        throw new Error("No se recibió la información necesaria del servidor");
      }
    } catch (error) {
      console.error("Error:", error);
      setStatus({ 
        success: false, 
        message: error instanceof Error ? error.message : "Error al procesar el pago. Intenta de nuevo." 
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [validate, token, total, shippingCost, firstName, lastName, phone, email, idNumber, delivery, carrier, address, city, department, additionalInfo, cart]);

  // Modal handlers
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

  const openCarrierModal = useCallback(() => {
    setPendingCarrier(carrier);
    setIsCarrierModalOpen(true);
  }, [carrier]);

  const confirmCarrier = useCallback(() => {
    carrierConfirmedRef.current = true;
    setCarrier(pendingCarrier);
    setIsCarrierModalOpen(false);
  }, [pendingCarrier]);

  const itemCount = cart.reduce((a, b) => a + b.quantity, 0);

  return {
    // Data
    cart,
    subtotal,
    shippingCost,
    total,
    itemCount,
    categoriesData,
    
    // Form states
    firstName,
    setFirstName,
    lastName,
    setLastName,
    phone,
    setPhone,
    email,
    setEmail,
    idNumber,
    setIdNumber,
    address,
    setAddress,
    department,
    setDepartment,
    city,
    setCity,
    additionalInfo,
    setAdditionalInfo,
    delivery,
    setDelivery,
    carrier,
    setCarrier,
    
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
    
    // Constants
    availableCities,
    DEPARTMENTS,
    CARRIERS,
    
    // Handlers
    handlePayWithWompi,
    openDepartmentModal,
    confirmDepartment,
    openCityModal,
    confirmCity,
    openCarrierModal,
    confirmCarrier,
    validate,
    navigate,
  };
}
