import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { motion, AnimatePresence } from "framer-motion";
import { SunIcon, MoonIcon } from "../components/atoms/icons";
import { useAuthForm } from "../hooks/useAuthForm";
import {
  ForgotPasswordForm,
  LoginRegisterForm,
  ConfirmRegisterModal,
  DeactivatedModal,
} from "../components/auth";

export default function LoginPage() {
  const {
    theme,
    toggleTheme,
    view,
    switchView,
    subtitle,
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
    isLoading,
    error,
    success,
    isVisible,
    toggleVisibility,
    showConfirm,
    setShowConfirm,
    showDeactivatedModal,
    setShowDeactivatedModal,
    handleGoogleSuccess,
    handleLoginRegister,
    handleConfirmRegister,
    handleForgotPassword,
    navigate,
  } = useAuthForm();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#f8f9fa] dark:bg-[#0a0a0a] p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="border-none shadow-2xl bg-white/80 dark:bg-white/5 backdrop-blur-xl relative">
          <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
            <Button
              isIconOnly
              className="bg-black/5 dark:bg-white/5 text-black hover:bg-black/10 dark:text-white dark:hover:bg-white/10"
              size="sm"
              variant="flat"
              onClick={toggleTheme}
              title="Alternar Modo Claro/Oscuro"
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </Button>
            <Button
              className="bg-black/5 dark:bg-white/5 text-[10px] sm:text-xs font-bold hover:bg-black/10 dark:hover:bg-white/10 px-3"
              size="sm"
              variant="flat"
              onClick={() => navigate("/")}
              title="Explorar Catálogo como Invitado"
            >
              Explorar 🛍️
            </Button>
          </div>

          <CardHeader className="flex flex-col gap-1 items-center pt-8 pb-4">
            <div className="size-12 bg-yellow-400 rounded-2xl flex items-center justify-center font-bold text-2xl text-black mb-4 shadow-lg shadow-yellow-400/20">
              V
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-black dark:text-white">Vega</h1>
            <p className="text-black/50 dark:text-white/50 text-sm text-center">
              {subtitle[view]}
            </p>
          </CardHeader>

          <CardBody className="px-8 pb-10">
            <AnimatePresence mode="wait">
              {view === "forgot" ? (
                <ForgotPasswordForm
                  forgotEmail={forgotEmail}
                  setForgotEmail={setForgotEmail}
                  error={error}
                  success={success}
                  isLoading={isLoading}
                  onSubmit={handleForgotPassword}
                  onBack={() => switchView("login")}
                />
              ) : (
                <LoginRegisterForm
                  view={view}
                  fullName={fullName}
                  setFullName={setFullName}
                  email={email}
                  setEmail={setEmail}
                  phone={phone}
                  setPhone={setPhone}
                  password={password}
                  setPassword={setPassword}
                  isVisible={isVisible}
                  toggleVisibility={toggleVisibility}
                  error={error}
                  success={success}
                  isLoading={isLoading}
                  onSubmit={handleLoginRegister}
                  onSwitchView={() => switchView(view === "register" ? "login" : "register")}
                  onForgotClick={() => switchView("forgot")}
                  onGoogleSuccess={handleGoogleSuccess}
                  onGoogleError={() => {}}
                />
              )}
            </AnimatePresence>
          </CardBody>
        </Card>
      </motion.div>

      <ConfirmRegisterModal
        isOpen={showConfirm}
        onOpenChange={setShowConfirm}
        fullName={fullName}
        email={email}
        phone={phone}
        isLoading={isLoading}
        onConfirm={handleConfirmRegister}
      />

      <DeactivatedModal
        isOpen={showDeactivatedModal}
        onOpenChange={setShowDeactivatedModal}
      />
    </div>
  );
}
