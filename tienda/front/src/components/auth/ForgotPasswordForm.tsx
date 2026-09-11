import { motion } from "framer-motion";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";

interface ForgotPasswordFormProps {
  forgotEmail: string;
  setForgotEmail: (value: string) => void;
  error: string;
  success: string;
  isLoading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
}

export function ForgotPasswordForm({
  forgotEmail,
  setForgotEmail,
  error,
  success,
  isLoading,
  onSubmit,
  onBack,
}: ForgotPasswordFormProps) {
  return (
    <motion.form
      key="forgot"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.25 }}
      onSubmit={onSubmit}
      className="flex flex-col gap-4"
    >
      <Input
        type="email"
        label="Correo electrónico"
        variant="bordered"
        value={forgotEmail}
        onChange={(e) => setForgotEmail(e.target.value)}
        isRequired
        autoFocus
        classNames={{
          inputWrapper: "border-black/10 dark:border-white/10 hover:border-primary transition-colors",
        }}
      />

      {error && (
        <p className="text-danger text-xs font-medium bg-danger/10 p-2 rounded-lg text-center">{error}</p>
      )}
      {success && (
        <p className="text-success text-xs font-medium bg-success/10 p-2 rounded-lg text-center">{success}</p>
      )}

      <Button
        type="submit"
        color="primary"
        className="mt-2 font-bold text-white shadow-lg shadow-primary/20 h-12"
        isLoading={isLoading}
        isDisabled={!!success}
      >
        Enviar enlace de recuperación
      </Button>

      <div className="text-center mt-2">
        <button
          type="button"
          className="text-xs text-primary font-bold hover:underline"
          onClick={onBack}
        >
          ← Volver al inicio de sesión
        </button>
      </div>
    </motion.form>
  );
}
