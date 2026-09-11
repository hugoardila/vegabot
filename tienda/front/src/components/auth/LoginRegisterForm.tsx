import { motion } from "framer-motion";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { GoogleLogin } from "@react-oauth/google";
import { AuthView } from "../../hooks/useAuthForm";
import { GOOGLE_CLIENT_ID } from "../../config/api";

interface LoginRegisterFormProps {
  view: AuthView;
  fullName: string;
  setFullName: (value: string) => void;
  email: string;
  setEmail: (value: string) => void;
  phone: string;
  setPhone: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  isVisible: boolean;
  toggleVisibility: () => void;
  error: string;
  success: string;
  isLoading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onSwitchView: () => void;
  onForgotClick: () => void;
  onGoogleSuccess: (credentialResponse: any) => void;
  onGoogleError: () => void;
}

export function LoginRegisterForm({
  view,
  fullName,
  setFullName,
  email,
  setEmail,
  phone,
  setPhone,
  password,
  setPassword,
  isVisible,
  toggleVisibility,
  error,
  success,
  isLoading,
  onSubmit,
  onSwitchView,
  onForgotClick,
  onGoogleSuccess,
  onGoogleError,
}: LoginRegisterFormProps) {
  return (
    <motion.form
      key="login-register"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.25 }}
      onSubmit={onSubmit}
      className="flex flex-col gap-4"
    >
      {view === "register" && (
        <>
          <Input
            label="Nombre Completo"
            variant="bordered"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            isRequired
            classNames={{
              inputWrapper: "border-black/10 dark:border-white/10 hover:border-primary transition-colors",
            }}
          />
          <Input
            type="tel"
            label="Teléfono"
            variant="bordered"
            value={phone}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, "");
              if (val.length <= 10) setPhone(val);
            }}
            maxLength={10}
            isRequired
            classNames={{
              inputWrapper: "border-black/10 dark:border-white/10 hover:border-primary transition-colors",
            }}
          />
        </>
      )}

      <Input
        type="email"
        label="Correo Electrónico"
        variant="bordered"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        isRequired
        classNames={{
          inputWrapper: "border-black/10 dark:border-white/10 hover:border-primary transition-colors",
        }}
      />

      <Input
        type={isVisible ? "text" : "password"}
        label="Contraseña"
        variant="bordered"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        isRequired
        endContent={
          <button className="focus:outline-none" type="button" onClick={toggleVisibility} aria-label="toggle password visibility">
            {isVisible ? (
              <svg className="w-5 h-5 text-black/40 hover:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-black/40 hover:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        }
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
        className="mt-4 font-bold text-white shadow-lg shadow-primary/20 h-12"
        isLoading={isLoading}
      >
        {view === "register" ? "Crear Cuenta" : "Iniciar Sesión"}
      </Button>

      {view === "login" && (
        <>
          <div className="text-center -mt-1">
            <button
              type="button"
              className="text-xs text-black/40 dark:text-white/40 hover:text-primary transition-colors"
              onClick={onForgotClick}
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          {GOOGLE_CLIENT_ID && (
            <>
              <div className="flex items-center gap-4 my-1">
                <div className="h-px w-full bg-black/5 dark:bg-white/5" />
                <span className="text-[10px] text-black/30 dark:text-white/30 font-bold uppercase tracking-widest">O</span>
                <div className="h-px w-full bg-black/5 dark:bg-white/5" />
              </div>

              <div className="flex justify-center w-full min-h-[40px]">
                <GoogleLogin
                  onSuccess={onGoogleSuccess}
                  onError={onGoogleError}
                  theme="filled_blue"
                  shape="pill"
                  text="continue_with"
                />
              </div>
            </>
          )}
        </>
      )}

      <div className="text-center mt-2">
        <button
          type="button"
          className="text-xs text-primary font-bold hover:underline"
          onClick={onSwitchView}
        >
          {view === "register" ? "¿Ya tienes cuenta? Inicia sesión" : "¿No tienes cuenta? Regístrate"}
        </button>
      </div>
    </motion.form>
  );
}
