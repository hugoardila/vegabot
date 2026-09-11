import type { NavigateOptions } from "react-router-dom";

import { HeroUIProvider } from "@heroui/system";
import { useHref, useNavigate } from "react-router-dom";
import { ThemeProvider as NextThemesProvider } from "next-themes";

declare module "@react-types/shared" {
  interface RouterConfig {
    routerOptions: NavigateOptions;
  }
}

import { AuthProvider } from "./context/AuthContext";
import { AppProvider } from "./context/AppContext";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { GOOGLE_CLIENT_ID } from "./config/api";

import { ToastProvider } from "@heroui/toast";

export function Provider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  // Si no hay GOOGLE_CLIENT_ID, mostrar advertencia en desarrollo
  if (!GOOGLE_CLIENT_ID && import.meta.env.DEV) {
    console.warn("⚠️ VITE_GOOGLE_CLIENT_ID no está configurado. El login con Google no funcionará.");
  }

  return (
    <NextThemesProvider attribute="class" defaultTheme="light">
      {GOOGLE_CLIENT_ID ? (
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
          <AuthProvider>
            <AppProvider>
              <HeroUIProvider navigate={navigate} useHref={useHref}>
                <ToastProvider 
                  placement="top-center" 
                  toastProps={{
                    classNames: {
                      base: "bg-white text-black dark:bg-black dark:text-blue-500 font-bold border border-black/10 dark:border-white/10",
                      description: "opacity-100 font-bold"
                    }
                  }}
                />
                {children}
              </HeroUIProvider>
            </AppProvider>
          </AuthProvider>
        </GoogleOAuthProvider>
      ) : (
        <AuthProvider>
          <AppProvider>
            <HeroUIProvider navigate={navigate} useHref={useHref}>
              <ToastProvider 
                placement="top-center" 
                toastProps={{
                  classNames: {
                    base: "bg-white text-black dark:bg-black dark:text-blue-500 font-bold border border-black/10 dark:border-white/10",
                    description: "opacity-100 font-bold"
                  }
                }}
              />
              {children}
            </HeroUIProvider>
          </AppProvider>
        </AuthProvider>
      )}
    </NextThemesProvider>
  );
}
