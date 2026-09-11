import { useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTheme } from "next-themes";
import { useAuth } from "../context/AuthContext";
import { authService } from "../services/auth";

export type AuthView = "login" | "register" | "forgot";

export function useAuthForm() {
  const { theme, setTheme } = useTheme();
  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");
  
  const [view, setView] = useState<AuthView>("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [showDeactivatedModal, setShowDeactivatedModal] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  
  const toggleVisibility = () => setIsVisible(!isVisible);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const reset = useCallback(() => {
    setError("");
    setSuccess("");
  }, []);

  const handleGoogleSuccess = useCallback(async (credentialResponse: any) => {
    setIsLoading(true);
    setError("");
    try {
      const response = await authService.googleLogin(credentialResponse.credential);
      
      // Solo redirigir a perfil si es un usuario NUEVO (recién creado)
      if ((response as any).is_new_user) {
        // Pasar estado para activar modo edición automáticamente
        login(response, "/profile", { autoEdit: true });
      } else {
        // Usuario existente, redirigir normalmente
        const from = location.state?.from;
        login(response, from?.pathname || "/", from?.state);
      }
    } catch (err: any) {
      if (err.message && err.message.includes("desactivada")) {
        setShowDeactivatedModal(true);
      } else {
        setError(err.message || "Error al iniciar sesión con Google");
      }
    } finally {
      setIsLoading(false);
    }
  }, [location.state, login]);

  const handleLoginRegister = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    reset();

    if (view === "register") {
      if (!fullName.trim()) { setError("El nombre completo es obligatorio"); return; }
      if (!email.trim()) { setError("El correo electrónico es obligatorio"); return; }
      if (!phone.trim() || phone.length !== 10) { setError("El teléfono debe tener 10 dígitos"); return; }
      if (!password.trim()) { setError("La contraseña es obligatoria"); return; }
      setShowConfirm(true);
      return;
    }

    if (!email.trim()) { setError("Ingresa tu correo electrónico"); return; }
    if (!password.trim()) { setError("Ingresa tu contraseña"); return; }

    setIsLoading(true);
    try {
      const response = await authService.login(email, password);
      const from = location.state?.from;
      login(response, from?.pathname || "/", from?.state);
    } catch (err: any) {
      if (err.message && err.message.includes("desactivada")) {
        setShowDeactivatedModal(true);
      } else {
        setError(err.message || "Ocurrió un error");
      }
    } finally {
      setIsLoading(false);
    }
  }, [view, fullName, email, phone, password, location.state, login, reset]);

  const handleConfirmRegister = useCallback(async () => {
    setIsLoading(true);
    setShowConfirm(false);
    try {
      await authService.register(fullName, email, password, phone);
      const response = await authService.login(email, password);
      const from = location.state?.from;
      login(response, from?.pathname || "/", from?.state);
    } catch (err: any) {
      setError(err.message || "Ocurrió un error al crear la cuenta");
    } finally {
      setIsLoading(false);
    }
  }, [fullName, email, phone, password, location.state, login]);

  const handleForgotPassword = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) { setError("Ingresa tu correo electrónico"); return; }
    setIsLoading(true);
    reset();
    try {
      const res = await authService.forgotPassword(forgotEmail);
      setSuccess(res.message);
    } catch (err: any) {
      setError(err.message || "Error al procesar la solicitud");
    } finally {
      setIsLoading(false);
    }
  }, [forgotEmail, reset]);

  const switchView = useCallback((newView: AuthView) => {
    setView(newView);
    reset();
  }, [reset]);

  const subtitle: Record<AuthView, string> = {
    login: "Ingresa tus credenciales para continuar",
    register: "Crea tu cuenta de cliente",
    forgot: "Te enviaremos un enlace de recuperación",
  };

  return {
    // Theme
    theme,
    toggleTheme,
    
    // View
    view,
    setView,
    switchView,
    subtitle,
    
    // Form data
    fullName,
    setFullName,
    email,
    setEmail,
    phone,
    setPhone,
    password,
    setPassword,
    forgotEmail,
    setForgotEmail,
    
    // UI state
    isLoading,
    error,
    success,
    isVisible,
    toggleVisibility,
    showConfirm,
    setShowConfirm,
    showDeactivatedModal,
    setShowDeactivatedModal,
    
    // Handlers
    handleGoogleSuccess,
    handleLoginRegister,
    handleConfirmRegister,
    handleForgotPassword,
    reset,
    navigate,
  };
}
