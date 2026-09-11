import React, { useState } from "react";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { Button } from "@heroui/button";

interface CreateAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateAdmin: (data: {
    full_name: string;
    email: string;
    password: string;
    phone?: string;
  }) => Promise<void>;
}

export const CreateAdminModal: React.FC<CreateAdminModalProps> = ({
  isOpen,
  onClose,
  onCreateAdmin,
}) => {
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user types
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.full_name.trim()) {
      newErrors.full_name = "El nombre es requerido";
    }

    if (!formData.email.trim()) {
      newErrors.email = "El email es requerido";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Email inválido";
    }

    if (!formData.password) {
      newErrors.password = "La contraseña es requerida";
    } else if (formData.password.length < 6) {
      newErrors.password = "Mínimo 6 caracteres";
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Las contraseñas no coinciden";
    }

    if (formData.phone.trim() && formData.phone.trim().length !== 10) {
      newErrors.phone = "El teléfono debe tener 10 dígitos";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      await onCreateAdmin({
        full_name: formData.full_name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        phone: formData.phone.trim() || undefined,
      });
      setSuccess(true);
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (error) {
      setErrors({ submit: "Error al crear admin. Intenta nuevamente." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({
      full_name: "",
      email: "",
      password: "",
      confirmPassword: "",
      phone: "",
    });
    setErrors({});
    setSuccess(false);
    setShowPassword(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
      size="lg"
      backdrop="blur"
      className="dark:bg-[#0a0a0a] bg-white"
      isDismissable={!isSubmitting}
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="border-b border-black/5 dark:border-white/10">
              <div>
                <h3 className="text-xl font-black text-black dark:text-white">
                  Crear Nuevo Admin
                </h3>
                <p className="text-xs text-black/50 dark:text-white/50 font-normal mt-1">
                  Completa la información del nuevo administrador
                </p>
              </div>
            </ModalHeader>

            <ModalBody className="py-6">
              {success ? (
                <div className="p-8 rounded-2xl bg-success/10 text-success text-center">
                  <p className="text-5xl mb-3">✅</p>
                  <p className="font-bold text-lg">¡Admin creado con éxito!</p>
                  <p className="text-xs opacity-70 mt-1">
                    El nuevo administrador puede iniciar sesión ahora
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {errors.submit && (
                    <div className="p-3 rounded-xl bg-danger/10 text-danger text-sm font-bold text-center">
                      {errors.submit}
                    </div>
                  )}

                  <div>
                    <label className="text-[10px] uppercase font-bold tracking-widest text-black/40 dark:text-white/40 mb-2 block">
                      Nombre Completo *
                    </label>
                    <input
                      type="text"
                      value={formData.full_name}
                      onChange={(e) => handleChange("full_name", e.target.value)}
                      placeholder="Juan Pérez"
                      className={`w-full px-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 border ${
                        errors.full_name
                          ? "border-danger"
                          : "border-black/10 dark:border-white/10"
                      } text-sm outline-none focus:border-primary/40 transition-colors text-black dark:text-white`}
                    />
                    {errors.full_name && (
                      <p className="text-xs text-danger font-bold mt-1">
                        {errors.full_name}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold tracking-widest text-black/40 dark:text-white/40 mb-2 block">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleChange("email", e.target.value)}
                      placeholder="admin@ejemplo.com"
                      className={`w-full px-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 border ${
                        errors.email
                          ? "border-danger"
                          : "border-black/10 dark:border-white/10"
                      } text-sm outline-none focus:border-primary/40 transition-colors text-black dark:text-white`}
                    />
                    {errors.email && (
                      <p className="text-xs text-danger font-bold mt-1">
                        {errors.email}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold tracking-widest text-black/40 dark:text-white/40 mb-2 block">
                      Teléfono (Opcional)
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        if (val.length <= 10) handleChange("phone", val);
                      }}
                      maxLength={10}
                      placeholder="+57 300 123 4567"
                      className={`w-full px-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 border ${
                        errors.phone
                          ? "border-danger"
                          : "border-black/10 dark:border-white/10"
                      } text-sm outline-none focus:border-primary/40 transition-colors text-black dark:text-white`}
                    />
                    {errors.phone && (
                      <p className="text-xs text-danger font-bold mt-1">
                        {errors.phone}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold tracking-widest text-black/40 dark:text-white/40 mb-2 block">
                      Contraseña *
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={formData.password}
                        onChange={(e) => handleChange("password", e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className={`w-full px-4 py-3 pr-12 rounded-xl bg-black/5 dark:bg-white/5 border ${
                          errors.password
                            ? "border-danger"
                            : "border-black/10 dark:border-white/10"
                        } text-sm outline-none focus:border-primary/40 transition-colors text-black dark:text-white`}
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-black/30 dark:text-white/30 hover:text-black dark:hover:text-white transition-colors text-xs font-bold"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? "🙈" : "👁️"}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-xs text-danger font-bold mt-1">
                        {errors.password}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold tracking-widest text-black/40 dark:text-white/40 mb-2 block">
                      Confirmar Contraseña *
                    </label>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={formData.confirmPassword}
                      onChange={(e) =>
                        handleChange("confirmPassword", e.target.value)
                      }
                      placeholder="Repite la contraseña"
                      className={`w-full px-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 border ${
                        errors.confirmPassword
                          ? "border-danger"
                          : "border-black/10 dark:border-white/10"
                      } text-sm outline-none focus:border-primary/40 transition-colors text-black dark:text-white`}
                    />
                    {errors.confirmPassword && (
                      <p className="text-xs text-danger font-bold mt-1">
                        {errors.confirmPassword}
                      </p>
                    )}
                  </div>

                  {formData.password &&
                    formData.confirmPassword &&
                    !errors.password &&
                    !errors.confirmPassword && (
                      <div
                        className={`text-xs font-bold text-center p-2 rounded-lg ${
                          formData.password === formData.confirmPassword
                            ? "text-success bg-success/10"
                            : "text-danger bg-danger/10"
                        }`}
                      >
                        {formData.password === formData.confirmPassword
                          ? "✓ Las contraseñas coinciden"
                          : "✗ Las contraseñas no coinciden"}
                      </div>
                    )}
                </div>
              )}
            </ModalBody>

            {!success && (
              <ModalFooter className="border-t border-black/5 dark:border-white/10">
                <Button
                  variant="flat"
                  onClick={handleClose}
                  isDisabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button
                  color="primary"
                  variant="shadow"
                  className="font-bold"
                  onClick={handleSubmit}
                  isLoading={isSubmitting}
                  isDisabled={
                    !formData.full_name ||
                    !formData.email ||
                    !formData.password ||
                    !formData.confirmPassword
                  }
                >
                  Crear Admin
                </Button>
              </ModalFooter>
            )}
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
