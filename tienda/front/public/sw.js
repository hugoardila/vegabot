const APP_CACHE = "vega-store-app-v1";
const DATA_CACHE = "vega-store-data-v1";
const IMAGE_CACHE = "vega-store-images-v1";
const APP_SHELL = ["/tienda/", "/tienda/manifest.webmanifest", "/tienda/v-cuadrada.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(cacheAppShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_STORE_CATALOG") return;
  event.waitUntil(cacheCatalog()
    .then((result) => event.ports[0]?.postMessage({ ok: true, ...result }))
    .catch((error) => event.ports[0]?.postMessage({ ok: false, error: error.message || "No fue posible descargar el catalogo." })));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate" && url.pathname.startsWith("/tienda")) {
    event.respondWith(networkFirst(request, APP_CACHE, "/tienda/"));
    return;
  }

  if (url.pathname.startsWith("/tienda-api/api/products") || url.pathname.startsWith("/tienda-api/api/categories") || url.pathname.startsWith("/tienda-api/api/settings")) {
    event.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }

  if (url.pathname.startsWith("/tienda-api/uploads/") || url.pathname.startsWith("/tienda/assets/") || url.pathname === "/tienda/v-cuadrada.svg") {
    event.respondWith(cacheFirst(request, url.pathname.startsWith("/tienda-api/uploads/") ? IMAGE_CACHE : APP_CACHE));
  }
});

async function cacheAppShell() {
  const cache = await caches.open(APP_CACHE);
  await cache.addAll(APP_SHELL);
  const response = await fetch("/tienda/", { cache: "no-store" });
  if (!response.ok) return;
  await cache.put("/tienda/", response.clone());
  const html = await response.text();
  const assetPaths = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map((match) => new URL(match[1], self.location.origin).pathname);
  await Promise.all(assetPaths.map(async (assetPath) => {
    const assetResponse = await fetch(assetPath, { cache: "no-store" });
    if (assetResponse.ok) await cache.put(assetPath, assetResponse);
  }));
}

async function cacheCatalog() {
  const cache = await caches.open(DATA_CACHE);
  const [productsResponse, categoriesResponse, settingsResponse] = await Promise.all([
    fetch("/tienda-api/api/products", { cache: "no-store" }),
    fetch("/tienda-api/api/categories", { cache: "no-store" }),
    fetch("/tienda-api/api/settings", { cache: "no-store" }),
  ]);
  if (!productsResponse.ok) throw new Error("No fue posible obtener los productos actuales.");
  await Promise.all([
    cache.put("/tienda-api/api/products", productsResponse.clone()),
    categoriesResponse.ok ? cache.put("/tienda-api/api/categories", categoriesResponse.clone()) : Promise.resolve(),
    settingsResponse.ok ? cache.put("/tienda-api/api/settings", settingsResponse.clone()) : Promise.resolve(),
  ]);

  const products = await productsResponse.json();
  const imageUrls = [...new Set(products.flatMap((product) => Array.isArray(product.images) ? product.images : []))]
    .map((image) => image.startsWith("/") ? `/tienda-api${image}` : image)
    .filter((image) => image.startsWith("/tienda-api/uploads/"));
  const imageCache = await caches.open(IMAGE_CACHE);
  let images = 0;
  for (let index = 0; index < imageUrls.length; index += 6) {
    const batch = imageUrls.slice(index, index + 6);
    const results = await Promise.all(batch.map(async (imageUrl) => {
      try {
        const response = await fetch(imageUrl, { cache: "no-store" });
        if (!response.ok) return false;
        await imageCache.put(imageUrl, response);
        return true;
      } catch {
        return false;
      }
    }));
    images += results.filter(Boolean).length;
  }
  return { products: products.length, images };
}

async function networkFirst(request, cacheName, fallbackPath) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || (fallbackPath ? await cache.match(fallbackPath) : undefined) || Response.error();
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}
