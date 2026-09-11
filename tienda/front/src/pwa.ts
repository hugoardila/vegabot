const OFFLINE_CATALOG_UPDATED_KEY = "vega_offline_catalog_updated_at";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;

export function registerStorePwa() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event as BeforeInstallPromptEvent;
    window.dispatchEvent(new Event("vega-pwa-install-available"));
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    window.dispatchEvent(new Event("vega-pwa-installed"));
  });

  const register = () => {
    navigator.serviceWorker.register("/tienda-sw.js", { scope: "/" }).catch(() => undefined);
  };

  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}

export function canInstallStorePwa() {
  return Boolean(deferredInstallPrompt);
}

export async function promptInstallStorePwa() {
  if (!deferredInstallPrompt) return false;
  await deferredInstallPrompt.prompt();
  const choice = await deferredInstallPrompt.userChoice;
  if (choice.outcome === "accepted") deferredInstallPrompt = null;
  return choice.outcome === "accepted";
}

export function getOfflineCatalogUpdatedAt() {
  return window.localStorage.getItem(OFFLINE_CATALOG_UPDATED_KEY) || "";
}

export async function updateOfflineCatalog(): Promise<{ products: number; images: number }> {
  const registration = await navigator.serviceWorker.ready;
  const worker = navigator.serviceWorker.controller || registration.active;
  if (!worker) throw new Error("La aplicacion aun se esta preparando. Intenta de nuevo en unos segundos.");

  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timeout = window.setTimeout(() => reject(new Error("La descarga del catalogo tomo demasiado tiempo.")), 120000);
    channel.port1.onmessage = (event) => {
      window.clearTimeout(timeout);
      const result = event.data || {};
      if (!result.ok) {
        reject(new Error(result.error || "No fue posible actualizar el catalogo."));
        return;
      }
      const updatedAt = new Date().toISOString();
      window.localStorage.setItem(OFFLINE_CATALOG_UPDATED_KEY, updatedAt);
      resolve({ products: Number(result.products || 0), images: Number(result.images || 0) });
    };
    worker.postMessage({ type: "CACHE_STORE_CATALOG" }, [channel.port2]);
  });
}
