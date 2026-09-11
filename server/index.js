const express = require("express");
const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const PDFDocument = require("pdfkit");
const sharp = require("sharp");
const multer = require("multer");
const twilio = require("twilio");
const {
  appendConversation,
  addCartItem,
  clearCart,
  completePaymentValidation,
  createPaymentValidationRequest,
  findPendingPaymentValidation,
  flagCustomerNeedsAdvisor,
  getDefaultCategoryIcon,
  getPool,
  init,
  readCart,
  readDb,
  refreshSaintInventoryMirror,
  releaseInventoryReservation,
  removeCartItem,
  replaceCartWithItem,
  reserveInventoryForOrder,
  saveOrder,
  updateCustomerBotMemory,
  updateCustomerManualAttention,
  updateOrderValidation,
  updateProduct,
  updateSettings,
  upsertWhatsappCustomer
} = require("./mysqlStore");
const { handleIncomingMessage } = require("./botFlow");
const { DEFAULT_OPENAI_MODEL, analyzeCustomerImage, analyzeCustomerMessage, enhanceBotReply, transcribeCustomerAudio } = require("./aiAssistant");
const {
  enqueueSaintInvoice,
  isImmediateAttemptWindow,
  isNotificationOnlyNumber,
  listBotSaintInvoices,
  processSaintInvoiceQueue,
  sendBotSaintInvoiceNow,
  startSaintInvoiceRetryWorker
} = require("./saintInvoiceQueue");
const { getRetailPrice, getWholesalePolicy, getWholesalePrice, priceBotCart } = require("./pricingPolicy");
const {
  calculateShippingCost: calculatePolicyShipping
} = require("./shippingPolicy");
const { findSaintCustomer, querySaintCustomers } = require("./saintCustomers");

const app = express();
const port = process.env.PORT || 3000;
const SAINT_MIRROR_INTERVAL_MS = Math.max(Number(process.env.SAINT_MIRROR_INTERVAL_MS || 60000), 30000);
const ADMIN_ROLE = "admin";
const ADVISOR_CASHIER_ROLE = "asesor_caja";
const ADMIN_PANEL_ROLES = new Set([ADMIN_ROLE, ADVISOR_CASHIER_ROLE]);
const paymentMediaDir = path.join(__dirname, "..", "storage", "payment-proofs");
const chatMediaDir = path.join(__dirname, "..", "storage", "chat-media");
const storeUploadsDir = path.join(__dirname, "..", "storage", "store-uploads");
const tiendaDistDir = path.join(__dirname, "..", "tienda", "front", "dist");
const adminLoginAttempts = new Map();
const whatsappProcessingQueues = new Map();
const recentTwilioMessageSids = new Map();
const storeUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 120 * 1024 * 1024 } });
const chatUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 16 * 1024 * 1024, files: 1 }
});

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(addNoIndexHeaders);
app.use("/payment-proofs", express.static(paymentMediaDir));
app.use("/chat-media", express.static(chatMediaDir, {
  fallthrough: false,
  maxAge: "7d",
  immutable: false
}));
app.use("/tienda-api/uploads", express.static(storeUploadsDir));
app.use("/tienda", express.static(tiendaDistDir));

app.get("/tienda-sw.js", (req, res) => {
  res.set({
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Service-Worker-Allowed": "/"
  });
  res.type("application/javascript").sendFile(path.join(tiendaDistDir, "sw.js"));
});

app.get("/tienda/store-config.js", async (req, res, next) => {
  try {
    const db = await readDb();
    const settings = db.settings || {};
    const config = {
      googleClientId: settings.storeGoogleClientId || "",
      wompiPublicKey: settings.wompiPublicKey || "",
      whatsappSupport: settings.storeWhatsappSupport || "573123756979",
      whatsappSales: settings.whatsappNumber || "573115401997"
    };
    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.type("application/javascript").send(`window.__VEGA_STORE_CONFIG__ = ${JSON.stringify(config)};`);
  } catch (error) {
    next(error);
  }
});

app.get("/tienda-api/api/categories", optionalStoreAuth, async (req, res, next) => {
  try {
    const db = await readDb();
    const canManageCategories = isStoreAdminUser(req.storeUser);
    const visibleCategoryNames = new Set(
      db.products
        .filter(isStoreProductVisible)
        .map((product) => String(product.category || "General"))
    );
    const categoryProducts = canManageCategories
      ? db.products
      : db.products.filter(isStoreProductVisible);
    const categories = db.categories
      .filter((category) => canManageCategories || visibleCategoryNames.has(String(category.name)))
      .map((category) => mapStoreCategory(
        category,
        db.subcategories || [],
        categoryProducts,
        canManageCategories
      ));
    res.json(categories);
  } catch (error) {
    next(error);
  }
});

app.post("/tienda-api/api/categories", requireStoreAuth, requireStoreAdmin, async (req, res, next) => {
  try {
    const category = await createStoreCategory(req.body || {});
    res.status(201).json(category);
  } catch (error) {
    next(error);
  }
});

app.put("/tienda-api/api/categories/:id", requireStoreAuth, requireStoreAdmin, async (req, res, next) => {
  try {
    const category = await updateStoreCategory(req.params.id, req.body || {});
    if (!category) return res.status(404).json({ error: "Categoria no encontrada" });
    res.json(category);
  } catch (error) {
    next(error);
  }
});

app.delete("/tienda-api/api/categories/:id", requireStoreAuth, requireStoreAdmin, async (req, res, next) => {
  try {
    const result = await deleteStoreCategory(req.params.id);
    if (!result.found) return res.status(404).json({ error: "Categoria no encontrada" });
    if (result.inUse) {
      return res.status(409).json({ error: "No se puede eliminar una categoria que contiene productos" });
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/tienda-api/api/products", optionalStoreAuth, async (req, res, next) => {
  try {
    const db = await readDb();
    const mediaByProduct = await readStoreProductMediaMap();
    const onlyActive = String(req.query.status || "").toLowerCase() === "true";
    const canManageProducts = isStoreAdminUser(req.storeUser);
    const products = db.products
      .filter((product) => canManageProducts || isStoreProductVisible(product))
      .filter((product) => !onlyActive || isStoreProductVisible(product))
      .map((product) => mapStoreProduct({ ...product, images: mediaByProduct[String(product.id)] || [] }, db.categories));
    res.json(products);
  } catch (error) {
    next(error);
  }
});

app.get("/tienda-api/api/catalog.pdf", async (req, res, next) => {
  try {
    const db = await readDb();
    const mediaByProduct = await readStoreProductMediaMap();
    const products = [];
    for (const product of db.products.filter(isStoreProductVisible)) {
      const mapped = mapStoreProduct(
        { ...product, images: mediaByProduct[String(product.id)] || [] },
        db.categories
      );
      products.push({ ...mapped, catalogImage: await prepareCatalogImage(mapped.images[0]) });
    }

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="catalogo-vega-importadora.pdf"',
      "Cache-Control": "no-store, no-cache, must-revalidate"
    });
    writeStoreCatalogPdf(res, products);
  } catch (error) {
    next(error);
  }
});

app.post("/tienda-api/api/products", requireStoreAuth, requireStoreAdmin, async (req, res, next) => {
  try {
    const product = await createStoreProduct(req.body || {});
    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
});

app.get("/tienda-api/api/products/:id", optionalStoreAuth, async (req, res, next) => {
  try {
    const db = await readDb();
    const product = db.products.find((item) => String(item.id).toUpperCase() === String(req.params.id).toUpperCase());
    if (!product || (!isStoreAdminUser(req.storeUser) && !isStoreProductVisible(product))) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }
    const images = await readStoreProductImages(product.id);
    res.json(mapStoreProduct({ ...product, images }, db.categories));
  } catch (error) {
    next(error);
  }
});

app.put("/tienda-api/api/products/:id", requireStoreAuth, requireStoreAdmin, async (req, res, next) => {
  try {
    const product = await updateStoreProduct(req.params.id, req.body || {});
    if (!product) return res.status(404).json({ error: "Producto no encontrado" });
    res.json(product);
  } catch (error) {
    next(error);
  }
});

app.delete("/tienda-api/api/products/:id", requireStoreAuth, requireStoreAdmin, async (req, res, next) => {
  try {
    const deleted = await deleteStoreProduct(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Producto no encontrado" });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/tienda-api/api/products/:id/media", async (req, res, next) => {
  try {
    res.json(await listStoreProductMedia(req.params.id));
  } catch (error) {
    next(error);
  }
});

app.delete("/tienda-api/api/media/:id", requireStoreAuth, requireStoreAdmin, async (req, res, next) => {
  try {
    const deleted = await deleteStoreProductMedia(req.params.id);
    res.json({ ok: true, deleted });
  } catch (error) {
    next(error);
  }
});

app.get("/tienda-api/api/products/:id/reviews", async (req, res) => {
  res.json([]);
});

app.get("/tienda-api/api/settings", async (req, res, next) => {
  try {
    const db = await readDb();
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.json(buildStoreSettingsResponse(db.settings || {}));
  } catch (error) {
    next(error);
  }
});

app.put("/tienda-api/api/settings", requireStoreAuth, requireStoreAdmin, async (req, res, next) => {
  try {
    const allowedKeys = new Set([
      "hero_banner_url",
      "escena_1_url",
      "escena_2_url",
      "facebook_url",
      "instagram_url",
      "tiktok_url",
      "youtube_url"
    ]);
    const payload = {};
    for (const [key, value] of Object.entries(req.body || {})) {
      if (!allowedKeys.has(key)) continue;
      if (["facebook_url", "instagram_url", "tiktok_url", "youtube_url"].includes(key)) {
        const normalized = normalizeSocialUrl(value, key);
        if (String(value || "").trim() && !normalized) {
          return res.status(400).json({ error: `El enlace de ${key.replace("_url", "")} no es valido` });
        }
        payload[key] = normalized;
      } else {
        payload[key] = String(value || "");
      }
    }
    if (!Object.keys(payload).length) return res.status(400).json({ error: "No hay configuracion valida para guardar" });
    const settings = await updateSettings(payload);
    res.json(buildStoreSettingsResponse(settings));
  } catch (error) {
    next(error);
  }
});

app.get("/tienda-api/api/saint-customers/search", async (req, res, next) => {
  try {
    const query = String(req.query?.q || "").trim();
    if (query.length < 3) return res.json({ items: [] });
    const db = await readDb();
    const items = await querySaintCustomers(db.settings || {}, query);
    res.json({ items });
  } catch (error) {
    next(error);
  }
});

app.post("/tienda-api/api/auth/saint-client", async (req, res, next) => {
  try {
    const db = await readDb();
    const user = await createSaintStoreSession(db.settings || {}, req.body || {});
    if (!user.status) return res.status(403).json({ error: "Cuenta desactivada" });
    res.json(buildStoreAuthResponse(user));
  } catch (error) {
    next(error);
  }
});

app.post("/tienda-api/api/auth/register", async (req, res, next) => {
  try {
    const user = await registerStoreUser(req.body || {});
    res.status(201).json(toStoreUserResponse(user));
  } catch (error) {
    if (error.code === "DUPLICATE_EMAIL") return res.status(409).json({ error: "Este correo ya esta registrado" });
    next(error);
  }
});

app.post("/tienda-api/api/auth/login", async (req, res, next) => {
  try {
    const user = await validateStoreLogin(req.body?.email, req.body?.password);
    if (!user) return res.status(401).json({ error: "Correo o contrasena incorrectos" });
    if (!user.status) return res.status(403).json({ error: "Cuenta desactivada" });
    res.json(buildStoreAuthResponse(user));
  } catch (error) {
    next(error);
  }
});

app.post("/tienda-api/api/auth/google", async (req, res, next) => {
  try {
    const profile = await verifyGoogleCredential(req.body?.token);
    if (!profile?.email) return res.status(401).json({ error: "No se pudo validar la cuenta de Google" });
    const result = await upsertGoogleStoreUser(profile);
    if (!result.user.status) return res.status(403).json({ error: "Cuenta desactivada" });
    res.json({ ...buildStoreAuthResponse(result.user), is_new_user: result.isNewUser });
  } catch (error) {
    next(error);
  }
});

app.put("/tienda-api/api/users/profile", requireStoreAuth, async (req, res, next) => {
  try {
    await updateStoreUserProfile(req.storeUser.id, req.body || {});
    res.json({ message: "Perfil actualizado" });
  } catch (error) {
    next(error);
  }
});

app.get("/tienda-api/api/users/", requireStoreAuth, requireStoreAdmin, async (req, res, next) => {
  try {
    res.json(await listStoreUsers());
  } catch (error) {
    next(error);
  }
});

app.put("/tienda-api/api/users/:id", requireStoreAuth, requireStoreAdmin, async (req, res, next) => {
  try {
    const user = await updateStoreUser(req.params.id, req.body || {}, req.storeUser);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json(toStoreUserResponse(user));
  } catch (error) {
    if (error.code === "DUPLICATE_EMAIL") return res.status(409).json({ error: "Este correo ya esta registrado" });
    next(error);
  }
});

app.post("/tienda-api/api/users/create-admin", requireStoreAuth, requireStoreSuperAdmin, async (req, res, next) => {
  try {
    const user = await createStoreAdminUser(req.body || {});
    res.status(201).json(toStoreUserResponse(user));
  } catch (error) {
    if (error.code === "DUPLICATE_EMAIL") return res.status(409).json({ error: "Este correo ya esta registrado" });
    next(error);
  }
});

app.get("/tienda-api/api/suppliers", requireStoreAuth, async (req, res, next) => {
  try {
    res.json(await listStoreSuppliers());
  } catch (error) {
    next(error);
  }
});

app.get("/tienda-api/api/distributors", async (req, res, next) => {
  try {
    res.json(await listStoreSuppliers({ onlyActive: true }));
  } catch (error) {
    next(error);
  }
});

app.post("/tienda-api/api/distributors", requireStoreAuth, requireStoreAdmin, async (req, res, next) => {
  try {
    res.status(201).json(await createStoreSupplier(req.body || {}));
  } catch (error) {
    next(error);
  }
});

app.put("/tienda-api/api/distributors/:id", requireStoreAuth, requireStoreAdmin, async (req, res, next) => {
  try {
    const distributor = await updateStoreSupplier(req.params.id, req.body || {});
    if (!distributor) return res.status(404).json({ error: "Distribuidor no encontrado" });
    res.json(distributor);
  } catch (error) {
    next(error);
  }
});

app.delete("/tienda-api/api/distributors/:id", requireStoreAuth, requireStoreAdmin, async (req, res, next) => {
  try {
    const deleted = await deleteStoreSupplier(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Distribuidor no encontrado" });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.post("/tienda-api/api/suppliers", requireStoreAuth, requireStoreAdmin, async (req, res, next) => {
  try {
    res.status(201).json(await createStoreSupplier(req.body || {}));
  } catch (error) {
    next(error);
  }
});

app.put("/tienda-api/api/suppliers/:id", requireStoreAuth, requireStoreAdmin, async (req, res, next) => {
  try {
    const supplier = await updateStoreSupplier(req.params.id, req.body || {});
    if (!supplier) return res.status(404).json({ error: "Proveedor no encontrado" });
    res.json(supplier);
  } catch (error) {
    next(error);
  }
});

app.delete("/tienda-api/api/suppliers/:id", requireStoreAuth, requireStoreAdmin, async (req, res, next) => {
  try {
    const deleted = await deleteStoreSupplier(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Proveedor no encontrado" });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/tienda-api/api/uploads/:bucket", requireStoreAuth, async (req, res, next) => {
  try {
    res.json({ files: await listStoreUploads(req.params.bucket) });
  } catch (error) {
    next(error);
  }
});

app.delete("/tienda-api/api/uploads/:bucket/:filename", requireStoreAuth, requireStoreAdmin, async (req, res, next) => {
  try {
    const deleted = await deleteStoreUpload(req.params.bucket, req.params.filename);
    res.json({ ok: true, deleted });
  } catch (error) {
    next(error);
  }
});

app.post("/tienda-api/api/upload_video", requireStoreAuth, requireStoreAdmin, storeUpload.single("video"), async (req, res, next) => {
  try {
    const file = await saveStoreUpload("videos", req.file);
    res.status(201).json(file);
  } catch (error) {
    next(error);
  }
});

app.post("/tienda-api/api/upload", requireStoreAuth, requireStoreAdmin, storeUpload.single("image"), async (req, res, next) => {
  try {
    const file = await saveStoreUpload("productos", req.file);
    res.status(201).json({ url: file.url, file });
  } catch (error) {
    next(error);
  }
});

app.post("/tienda-api/api/upload_distributor", requireStoreAuth, requireStoreAdmin, storeUpload.single("image"), async (req, res, next) => {
  try {
    if (!String(req.file?.mimetype || "").startsWith("image/")) {
      return res.status(400).json({ error: "Debes seleccionar una imagen válida" });
    }
    const file = await saveStoreUpload("distribuidores", req.file);
    res.status(201).json({ url: file.url, file });
  } catch (error) {
    next(error);
  }
});

app.post("/tienda-api/api/upload_receipts", requireStoreAuth, storeUpload.array("receipts", 2), async (req, res, next) => {
  try {
    const files = Array.isArray(req.files) ? req.files : [];
    if (!files.length) return res.status(400).json({ error: "Debes subir al menos un comprobante" });
    const savedFiles = [];
    for (const file of files) {
      savedFiles.push(await saveStoreUpload("facturas", file));
    }
    res.status(201).json({
      urls: savedFiles.map((file) => file.url),
      files: savedFiles
    });
  } catch (error) {
    next(error);
  }
});

app.get("/tienda-api/api/sales/me", requireStoreAuth, async (req, res, next) => {
  try {
    res.json(await readStoreSalesForUser(req.storeUser.id));
  } catch (error) {
    next(error);
  }
});

app.get("/tienda-api/api/sales", requireStoreAuth, requireStoreAdmin, async (req, res, next) => {
  try {
    res.json(await readStoreSales(req.query || {}));
  } catch (error) {
    next(error);
  }
});

app.get("/tienda-api/api/sales/months", requireStoreAuth, requireStoreAdmin, async (req, res, next) => {
  try {
    res.json(await readStoreSalesMonths());
  } catch (error) {
    next(error);
  }
});

app.post("/tienda-api/api/sales", requireStoreAuth, async (req, res, next) => {
  try {
    const sale = await createStoreSale(req.storeUser, req.body || {}, { status: "PENDIENTE", paymentMethod: req.body?.payment_method || "manual" });
    res.status(201).json(sale);
  } catch (error) {
    next(error);
  }
});

app.put("/tienda-api/api/sales/:id/status", requireStoreAuth, requireStoreAdmin, async (req, res, next) => {
  try {
    const sale = await updateStoreSaleStatus(req.params.id, req.body?.status || "");
    if (!sale) return res.status(404).json({ error: "Pedido no encontrado" });
    res.json(sale);
  } catch (error) {
    next(error);
  }
});

app.post("/tienda-api/api/wompi/create-payment-link", requireStoreAuth, async (req, res, next) => {
  try {
    const settings = await readWompiSettings();
    const { privateKey, apiUrl } = validateWompiConfiguration(settings);
    const sale = await createStoreSale(req.storeUser, req.body || {}, { status: "PENDING", paymentMethod: "wompi" });
    const payment = await createWompiPaymentLink(apiUrl, privateKey, req.body || {}, sale);
    await updateStoreSaleWompi(sale.id, payment);
    res.json(payment);
  } catch (error) {
    next(error);
  }
});

app.get("/tienda-api/api/wompi/verify-transaction/:id", async (req, res, next) => {
  try {
    const settings = await readWompiSettings();
    const { privateKey, apiUrl } = validateWompiConfiguration(settings);
    const response = await fetch(`${apiUrl.replace(/\/$/, "")}/transactions/${encodeURIComponent(req.params.id)}`, {
      headers: { Authorization: `Bearer ${privateKey}` }
    });
    const body = await response.json().catch(() => ({}));
    if (response.ok && body?.data) {
      const applied = await applyWompiTransactionToStoreSale(body.data);
      return res.json({ ...body.data, store_sale_matched: applied.matched, store_status: applied.status });
    }
    res.status(response.ok ? 200 : response.status).json(body);
  } catch (error) {
    next(error);
  }
});

app.post("/tienda-api/api/wompi/events", async (req, res, next) => {
  try {
    const result = await processWompiEvent(req.body || {}, req.get("X-Event-Checksum") || "");
    if (!result.valid) return res.status(401).json({ error: "Firma de evento Wompi invalida" });
    res.status(200).json({ received: true, matched: result.matched, status: result.status || "" });
  } catch (error) {
    next(error);
  }
});

app.get("/robots.txt", (req, res) => {
  res.type("text/plain").send("User-agent: *\nDisallow: /\n");
});

app.get("/payment-result", (req, res) => {
  const query = req.originalUrl.includes("?") ? req.originalUrl.slice(req.originalUrl.indexOf("?")) : "";
  res.redirect(302, `/tienda/payment-result${query}`);
});

app.get("/login", (req, res) => {
  res.type("html").send(buildAdminLoginPage());
});

app.post("/api/admin/login", async (req, res, next) => {
  try {
    const attemptKey = getAdminLoginAttemptKey(req);
    if (isAdminLoginLocked(attemptKey)) {
      return res.status(429).json({ error: "Demasiados intentos. Espera unos minutos antes de volver a intentar." });
    }
    const user = await validateAdminLogin(req.body?.email, req.body?.password);
    if (!user) {
      registerAdminLoginFailure(attemptKey);
      return res.status(401).json({ error: "Correo o contrasena incorrectos" });
    }
    clearAdminLoginFailures(attemptKey);
    const session = await createAdminSession(user.id);
    setAdminCookie(res, session.token);
    res.json({ ok: true, user: toAdminUserResponse(user) });
  } catch (error) {
    next(error);
  }
});

app.use("/api", requireAdminSession);

app.get("/api/admin/me", (req, res) => {
  res.json({ ok: true, user: toAdminUserResponse(req.adminUser) });
});

app.get("/api/admin/users", requireFullAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, users: await listAdminPanelUsers() });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/users", requireFullAdmin, async (req, res, next) => {
  try {
    const user = await createAdminPanelUser(req.body || {});
    res.status(201).json({ ok: true, user });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/admin/users/:id", requireFullAdmin, async (req, res, next) => {
  try {
    const user = await updateAdminPanelUser(req.params.id, req.body || {}, req.adminUser.id);
    if (!user) return res.status(404).json({ error: "Usuario administrativo no encontrado" });
    res.json({ ok: true, user });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/logout", async (req, res, next) => {
  try {
    await deleteAdminSession(getCookie(req, "vega_admin_session"));
    clearAdminCookie(res);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/dashboard", async (req, res, next) => {
  try {
  const db = await readDb();
  const saintInvoices = await listBotSaintInvoices();
  const fullAdmin = isFullAdmin(req.adminUser);
  const settings = fullAdmin
    ? sanitizeSettings(db.settings)
    : { businessName: db.settings.businessName || "VEGA IMPORTADORA" };
  res.json({
    user: toAdminUserResponse(req.adminUser),
    permissions: buildAdminPermissions(req.adminUser),
    settings,
    categories: fullAdmin ? db.categories : [],
    brands: fullAdmin ? db.brands : [],
    products: fullAdmin ? db.products : [],
    customers: db.customers,
    conversations: db.conversations,
    orders: db.orders,
    saintInvoices,
    adminUsers: fullAdmin ? await listAdminPanelUsers() : [],
    webhookUrl: fullAdmin ? `${db.settings.publicBaseUrl.replace(/\/$/, "")}/webhook/twilio` : ""
  });
  } catch (error) {
    next(error);
  }
});

app.post("/api/saint-invoices/:id/send", async (req, res, next) => {
  try {
    const result = await sendBotSaintInvoiceNow(req.params.id);
    if (result.notFound) {
      return res.status(404).json({ error: "Factura del bot no encontrada" });
    }
    if (result.skipped && result.reason === "processor_busy") {
      return res.status(409).json({ error: "La cola de facturas esta procesando otro pedido. Intenta nuevamente en unos segundos." });
    }
    res.json({ ok: true, result });
  } catch (error) {
    next(error);
  }
});

app.post("/api/settings", requireFullAdmin, async (req, res, next) => {
  try {
  const payload = { ...req.body };
  payload.aiProvider = "openai";
  payload.aiModel = String(payload.aiModel || DEFAULT_OPENAI_MODEL).trim() || DEFAULT_OPENAI_MODEL;
  payload.minimumWholesaleUnits = Math.max(Math.round(Number(payload.minimumWholesaleUnits) || 6), 1);
  payload.minimumWholesaleReferences = Math.max(Math.round(Number(payload.minimumWholesaleReferences) || 2), 1);
  payload.minimumWholesaleTotalUnits = Math.max(Math.round(Number(payload.minimumWholesaleTotalUnits) || 12), 1);
  payload.minimumWholesaleAmount = Math.max(Math.round(Number(payload.minimumWholesaleAmount) || 300000), 1);
  if (payload.orderNotificationNumber !== undefined) {
    const notificationDigits = String(payload.orderNotificationNumber || "").replace(/\D/g, "");
    const localNotificationNumber = notificationDigits.length === 12 && notificationDigits.startsWith("57")
      ? notificationDigits.slice(2)
      : notificationDigits;
    if (!/^3\d{9}$/.test(localNotificationNumber)) {
      return res.status(400).json({ error: "El numero de notificaciones debe ser un celular colombiano de 10 digitos" });
    }
    payload.orderNotificationNumber = localNotificationNumber;
  }
  delete payload.botPriceLevel;
  delete payload.storePriceLevel;
  if (!payload.authToken) delete payload.authToken;
  if (!payload.aiApiKey) delete payload.aiApiKey;
  if (!payload.wompiPrivateKey) delete payload.wompiPrivateKey;
  if (payload.inventoryKey) {
    const inventoryKey = String(payload.inventoryKey || "").trim();
    if (!/^\d{6}$/.test(inventoryKey)) return res.status(400).json({ error: "La clave inventario debe tener exactamente 6 digitos" });
    payload.inventoryKeyHash = hashInventoryKey(inventoryKey);
  }
  delete payload.inventoryKey;
  const settings = await updateSettings(payload);
  res.json({ ok: true, settings: sanitizeSettings(settings), webhookUrl: `${settings.publicBaseUrl.replace(/\/$/, "")}/webhook/twilio` });
  } catch (error) {
    next(error);
  }
});

app.post("/api/orders/:id/validate", async (req, res, next) => {
  try {
  const db = await readDb();
  const previousOrder = db.orders.find((item) => item.id === req.params.id);
  const order = await updateOrderValidation(req.params.id, req.body);
  if (!order) return res.status(404).json({ error: "Pedido no encontrado" });
  const dispatchNotification = await notifyDispatchIfNeeded(db.settings || {}, previousOrder, order);
  const validationNotification = await notifyValidationIfNeeded(db.settings || {}, previousOrder, order);
  res.json({
    ok: true,
    order,
    notification: {
      dispatch: dispatchNotification,
      validation: validationNotification
    }
  });
  } catch (error) {
    next(error);
  }
});

app.put("/api/products/:id", requireFullAdmin, async (req, res, next) => {
  try {
  const db = await readDb();
  if (!verifyInventoryKey(db.settings || {}, req.body?.inventoryKey)) {
    return res.status(403).json({ error: "Clave inventario incorrecta o no enviada" });
  }
  const externalProduct = db.products.find(
    (item) => String(item.id).toUpperCase() === String(req.params.id).toUpperCase()
  );
  const product = await updateProduct(req.params.id, req.body, externalProduct);
  if (!product) return res.status(404).json({ error: "Producto no encontrado" });
  res.json({ ok: true, product });
  } catch (error) {
    next(error);
  }
});

app.post("/api/customers/:id/message", chatUpload.single("media"), async (req, res, next) => {
  try {
  const db = await readDb();
  const customer = db.customers.find((item) => item.id === req.params.id);
  if (!customer) return res.status(404).json({ error: "Cliente no encontrado" });
  const settings = db.settings || {};
  const twilioReady = Boolean(settings.accountSid && settings.authToken && settings.whatsappNumber);
  const sender = req.body.sender || "asesor";
  const text = String(req.body.text || "").trim();
  const savedMedia = req.file ? await saveChatMediaFile(settings, req.file, "outgoing") : null;
  const legacyMedia = !savedMedia && req.body.media && typeof req.body.media === "object" ? req.body.media : null;
  const media = savedMedia || legacyMedia || {};
  const messageType = savedMedia?.type || req.body.type || "text";

  if (!text && !media.url) {
    return res.status(400).json({ error: "Escribe un mensaje o adjunta un archivo" });
  }

  let twilioMessage = null;
  if (twilioReady && sender === "asesor") {
    try {
      twilioMessage = await sendWhatsappMessage(settings, customer.phone, text, media.url || "");
    } catch (error) {
      error.statusCode = 502;
      throw error;
    }
  }

  await appendConversation(customer.id, sender, {
    text,
    type: messageType,
    media
  });

  if (!twilioReady && req.body.simulateReply !== "false" && req.body.simulateReply !== false && sender === "asesor") {
    await appendConversation(customer.id, "cliente", buildDemoReply({ ...req.body, type: messageType, text }));
  }

  res.json({ ok: true, media: savedMedia, twilioSid: twilioMessage?.sid || "" });
  } catch (error) {
    next(error);
  }
});

app.put("/api/customers/:id/manual-attention", async (req, res, next) => {
  try {
  const customer = await updateCustomerManualAttention(req.params.id, Boolean(req.body.enabled));
  if (!customer) return res.status(404).json({ error: "Cliente no encontrado" });
  res.json({ ok: true, customer });
  } catch (error) {
    next(error);
  }
});

app.get("/api/twilio/templates", async (req, res, next) => {
  try {
  const db = await readDb();
  const settings = db.settings || {};
  const templates = await fetchTwilioTemplates(settings);
  res.json({ ok: true, templates });
  } catch (error) {
    next(error);
  }
});

app.post("/api/customers/:id/send-template", async (req, res, next) => {
  try {
  const db = await readDb();
  const customer = db.customers.find((item) => item.id === req.params.id);
  if (!customer) return res.status(404).json({ error: "Cliente no encontrado" });
  const settings = db.settings || {};
  const templates = await fetchTwilioTemplates(settings);
  const template = templates.find((item) => item.sid === req.body.contentSid);
  if (!template) return res.status(404).json({ error: "Plantilla no encontrada en Twilio" });
  await sendWhatsappTemplate(settings, customer.phone, template.sid, template.variables || {});
  await appendConversation(customer.id, "asesor", {
    text: `Plantilla Twilio enviada: ${template.name}`,
    type: "text"
  });
  res.json({ ok: true, template });
  } catch (error) {
    next(error);
  }
});

app.post("/api/customers/:id/demo-incoming", requireFullAdmin, async (req, res, next) => {
  try {
  const db = await readDb();
  const customer = db.customers.find((item) => item.id === req.params.id);
  if (!customer) return res.status(404).json({ error: "Cliente no encontrado" });
  await appendConversation(customer.id, "cliente", {
    text: req.body.text || "Hola, quiero confirmar disponibilidad y precio mayorista.",
    type: req.body.type || "text",
    media: req.body.media || {}
  });
  res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/tienda/*", (req, res) => {
  res.sendFile(path.join(tiendaDistDir, "index.html"));
});

app.get("/admin", requireAdminSession, (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.get("/", (req, res) => {
  res.redirect(302, "/tienda/");
});

app.use(requireAdminAsset, express.static(path.join(__dirname, "..", "public")));

app.post("/webhook/twilio", async (req, res, next) => {
  try {
    const db = await readDb();
    const from = req.body.From || "";
    const body = req.body.Body || "";
    const settings = db.settings || {};
    if (isNotificationOnlyNumber(from, settings)) {
      const twiml = new twilio.twiml.MessagingResponse();
      return res.type("text/xml").send(twiml.toString());
    }
    if (isPaymentValidator(settings, from)) {
      const answer = await handlePaymentValidatorReply(settings, from, body);
      const twiml = new twilio.twiml.MessagingResponse();
      twiml.message(answer);
      return res.type("text/xml").send(twiml.toString());
    }

    const payload = { ...req.body };
    const twiml = new twilio.twiml.MessagingResponse();
    res.type("text/xml").send(twiml.toString());
    processIncomingWhatsappInBackground(payload);
  } catch (error) {
    next(error);
  }
});

function processIncomingWhatsappInBackground(payload = {}) {
  const messageSid = String(payload.MessageSid || payload.SmsMessageSid || "").trim();
  if (messageSid && recentTwilioMessageSids.has(messageSid)) return;
  if (messageSid) {
    recentTwilioMessageSids.set(messageSid, Date.now());
    setTimeout(() => recentTwilioMessageSids.delete(messageSid), 60 * 60 * 1000).unref?.();
  }

  const queueKey = normalizePhone(payload.From || "") || messageSid || crypto.randomUUID();
  const previous = whatsappProcessingQueues.get(queueKey) || Promise.resolve();
  const task = previous
    .catch(() => {})
    .then(() => processAndSendIncomingWhatsapp(payload))
    .finally(() => {
      if (whatsappProcessingQueues.get(queueKey) === task) whatsappProcessingQueues.delete(queueKey);
    });
  whatsappProcessingQueues.set(queueKey, task);
}

async function processAndSendIncomingWhatsapp(payload = {}) {
  let typingRefreshTimer = null;
  try {
    const incomingMessageSid = String(payload.MessageSid || payload.SmsMessageSid || "").trim();
    if (incomingMessageSid) {
      const initialDb = await readDb();
      const initialSettings = initialDb.settings || {};
      const showTyping = () => sendWhatsappTypingIndicator(initialSettings, incomingMessageSid)
        .catch((error) => console.error("No se pudo activar el indicador de escritura:", error.message));
      await showTyping();
      typingRefreshTimer = setInterval(showTyping, 20000);
      typingRefreshTimer.unref?.();
    }

    const result = await processIncomingWhatsapp(payload);
    if (result.answer && result.twilioReady) {
      await sendWhatsappMessage(result.settings, result.phone, result.answer);
    }
  } catch (error) {
    console.error("No se pudo procesar el mensaje entrante de WhatsApp:", error);
    try {
      const db = await readDb();
      const settings = db.settings || {};
      const phone = normalizePhone(payload.From || "");
      const twilioReady = Boolean(settings.accountSid && settings.authToken && settings.whatsappNumber);
      if (phone && twilioReady) {
        await sendWhatsappMessage(
          settings,
          phone,
          "Recibí tu mensaje, pero tuve una dificultad temporal al procesarlo. Por favor escríbeme nuevamente en un momento; tu carrito y tus pedidos siguen guardados."
        );
      }
    } catch (notificationError) {
      console.error("No se pudo notificar el error temporal al cliente:", notificationError.message);
    }
  } finally {
    if (typingRefreshTimer) clearInterval(typingRefreshTimer);
  }
}

async function processIncomingWhatsapp(payload = {}) {
  const from = payload.From || "";
  const originalText = String(payload.Body || "").trim();
  const initialDb = await readDb();
  const settings = initialDb.settings || {};
  if (isNotificationOnlyNumber(from, settings)) {
    return {
      answer: "",
      phone: normalizePhone(from),
      settings,
      twilioReady: false,
      ignored: true
    };
  }
  const customer = await upsertWhatsappCustomer(from, payload.ProfileName || "");
  const previousConversation = (initialDb.conversations || [])
    .filter((item) => item.customerId === customer.id)
    .slice(-20);
  const incomingMedia = Number(payload.NumMedia || 0) > 0
    ? await downloadTwilioChatMedia(settings, payload)
    : null;
  const interpretedMedia = incomingMedia
    ? await interpretIncomingMedia(settings, incomingMedia, originalText, previousConversation)
    : incomingMedia;
  const effectiveText = buildEffectiveIncomingText(originalText, interpretedMedia);
  const storedText = buildStoredIncomingText(originalText, interpretedMedia);

  await appendConversation(customer.id, "cliente", {
    text: storedText,
    type: interpretedMedia?.type || "text",
    media: interpretedMedia
      ? {
          url: interpretedMedia.url || "",
          name: interpretedMedia.name || interpretedMedia.filename || attachmentName(interpretedMedia.type),
          meta: interpretedMedia.meta || interpretedMedia.contentType || ""
        }
      : {}
  });

  const refreshedDb = await readDb();
  const refreshedCustomer = refreshedDb.customers.find((item) => item.id === customer.id);
  const twilioReady = Boolean(settings.accountSid && settings.authToken && settings.whatsappNumber);
  if (refreshedCustomer?.manualAttention) {
    return { answer: "", phone: customer.phone || from, settings, twilioReady };
  }

  refreshedDb.cart = await readCart(customer.id);
  const orderCount = refreshedDb.orders.length;
  const flowContext = {
    hasMedia: Boolean(interpretedMedia),
    mediaUrl: interpretedMedia?.url || "",
    mediaContentType: interpretedMedia?.contentType || "",
    mediaKind: interpretedMedia?.type || "",
    mediaAnalysis: interpretedMedia?.analysis || null
  };
  const conversationContext = (refreshedDb.conversations || [])
    .filter((item) => item.customerId === customer.id)
    .slice(-20);
  const latestOrderBeforeAction = getLatestOrderForPhone(refreshedDb, refreshedCustomer?.phone || from);
  const plannerCandidates = pickAiProductContext(
    refreshedDb,
    effectiveText,
    refreshedCustomer?.botMemory || {},
    refreshedDb.cart
  );

  let safeAnswer = "";
  if (interpretedMedia?.type === "audio" && !interpretedMedia.transcription) {
    safeAnswer = "Recibi tu audio, pero no pude transcribirlo con claridad. Puedes enviarlo nuevamente o escribirme lo que necesitas.";
  } else if (interpretedMedia?.type === "video" && !originalText) {
    safeAnswer = "Recibi tu video. Cuentame brevemente que producto o detalle deseas que revise.";
  } else {
    flowContext.aiPlan = await analyzeCustomerMessage(refreshedDb.settings || {}, {
      incomingText: effectiveText,
      customer: refreshedCustomer,
      customerMemory: refreshedCustomer?.botMemory || {},
      cart: refreshedDb.cart,
      latestOrder: latestOrderBeforeAction,
      candidates: plannerCandidates,
      recentConversation: conversationContext
    });
    safeAnswer = await handleIncomingMessage(refreshedDb, from, effectiveText, flowContext);
  }

  if (refreshedDb.cartAction?.type === "add") {
    await addCartItem(customer.id, refreshedDb.cartAction.product, refreshedDb.cartAction.qty);
  }
  if (refreshedDb.cartAction?.type === "remove") {
    await removeCartItem(customer.id, refreshedDb.cartAction.productId, refreshedDb.cartAction.qty);
  }
  if (refreshedDb.cartAction?.type === "replace") {
    await replaceCartWithItem(customer.id, refreshedDb.cartAction.product, refreshedDb.cartAction.qty);
  }
  if (refreshedDb.orders.length > orderCount) {
    const pendingOrder = refreshedDb.orders[0];
    try {
      await reserveInventoryForOrder(pendingOrder);
      const createdOrder = await saveOrder(pendingOrder);
      if (createdOrder.botStatus === "confirmado_por_bot") {
        await createSaintInvoiceForBotOrder(refreshedDb.settings || {}, createdOrder);
      }
    } catch (error) {
      if (error.code !== "INSUFFICIENT_STOCK") throw error;
      refreshedDb.clearCart = false;
      safeAnswer = `La disponibilidad de ${error.productId || "uno de los productos"} cambio mientras confirmabamos el pedido. No cree el pedido ni vacie tu carrito. Dime VER CARRITO y ajustamos la cantidad.`;
      refreshedDb.memoryPatch = {
        botStage: "CARRITO",
        activeOrderId: "",
        lastIntent: "stock_changed",
        lastBotAnswer: safeAnswer,
        memory: {
          ...(refreshedCustomer?.botMemory || {}),
          estado: "CARRITO",
          salesFlowStage: "CARRITO",
          activeOrderId: "",
          modo_asesor: false,
          campo_esperado: "accion_carrito"
        }
      };
    }
  }
  if (refreshedDb.orderUpdate) {
    const previousOrder = refreshedDb.orders.find((item) => item.id === refreshedDb.orderUpdate.id);
    const updatedOrder = await saveOrder(refreshedDb.orderUpdate);
    if (previousOrder?.botStatus !== "confirmado_por_bot" && updatedOrder.botStatus === "confirmado_por_bot") {
      await createSaintInvoiceForBotOrder(refreshedDb.settings || {}, updatedOrder);
    }
    if (/cancelado|rechazado|anulado/i.test(updatedOrder.status || "")) {
      await releaseInventoryReservation(updatedOrder.id);
    }
  }
  if (refreshedDb.paymentProofValidation) {
    await forwardPaymentProofToValidator(refreshedDb.settings || {}, refreshedDb.paymentProofValidation);
  }
  if (refreshedDb.clearCart) {
    await clearCart(customer.id);
  }
  if (refreshedDb.requestHumanAttention) {
    await flagCustomerNeedsAdvisor(customer.id);
  }

  const afterActionDb = await readDb();
  const afterActionCustomer = afterActionDb.customers.find((item) => item.id === customer.id) || refreshedCustomer || customer;
  const afterActionCart = await readCart(customer.id);
  const latestOrder = getLatestOrderForPhone(afterActionDb, afterActionCustomer.phone || from);
  const answer = await enhanceBotReply(afterActionDb.settings || {}, {
    answer: safeAnswer,
    incomingText: effectiveText,
    customer: afterActionCustomer,
    customerMemory: afterActionCustomer?.botMemory || {},
    cart: afterActionCart,
    latestOrder,
    products: pickAiProductContext(afterActionDb, effectiveText, afterActionCustomer?.botMemory, afterActionCart),
    recentConversation: (afterActionDb.conversations || [])
      .filter((item) => item.customerId === customer.id)
      .slice(-20)
  });
  if (answer) {
    await appendConversation(customer.id, "bot", { text: answer, type: "text" });
  }
  const memoryDb = await readDb();
  const memoryCart = await readCart(customer.id);
  const memoryPayload = refreshedDb.memoryPatch || buildCustomerBotMemory(memoryDb, customer, memoryCart, effectiveText, safeAnswer);
  await updateCustomerBotMemory(customer.id, memoryPayload);
  return { answer, phone: customer.phone || from, settings: afterActionDb.settings || settings, twilioReady };
}

function getLatestOrderForPhone(db, phone) {
  const normalized = normalizePhone(phone || "");
  return (db.orders || []).find((order) => normalizePhone(order.phone) === normalized) || null;
}

function pickAiProductContext(db, incomingText = "", memory = {}, cart = { items: [] }) {
  const products = db.products || [];
  const nestedMemory = memory?.memory || {};
  const shownIds = [
    ...(memory?.productos_mostrados || []),
    ...(nestedMemory?.productos_mostrados || [])
  ].map((item) => item?.producto_id || item?.productId || item?.id).filter(Boolean);
  const rememberedIds = new Set([
    memory?.productId,
    memory?.selectedProductId,
    memory?.lastProductId,
    memory?.producto_actual,
    nestedMemory?.producto_actual,
    ...(memory?.shownProductIds || []),
    ...(nestedMemory?.shownProductIds || []),
    ...shownIds,
    ...((cart?.items || []).map((item) => item.sku || item.productId || item.id))
  ].filter(Boolean).map((value) => String(value).toUpperCase()));

  const stopWords = new Set([
    "algo", "como", "para", "pero", "quiero", "tiene", "tienen", "tener", "producto",
    "productos", "puede", "puedes", "mostrar", "muestre", "necesito", "busco", "estilo"
  ]);
  const currentTerms = normalizeLoose(incomingText)
    .split(/\s+/)
    .filter((term) => term.length >= 3 && !stopWords.has(term));
  const memoryTerms = normalizeLoose(JSON.stringify(memory || {}))
    .split(/\s+/)
    .filter((term) => term.length >= 4 && !stopWords.has(term));
  const usesPreviousProduct = /\b(ese|esa|este|esta|primero|primera|segundo|segunda|tercero|tercera|ultimo|ultima|agregalo|agregala|explicame|como funciona|imagen|foto)\b/.test(normalizeLoose(incomingText));

  return products
    .map((product) => {
      const identity = normalizeLoose(`${product.id} ${product.name} ${product.brand}`);
      const details = normalizeLoose(`${product.category} ${product.storeDescription || ""} ${product.botFeatures || ""}`);
      let score = usesPreviousProduct && rememberedIds.has(String(product.id).toUpperCase()) ? 30 : 0;
      for (const term of currentTerms) {
        if (identity.includes(term)) score += term.length > 4 ? 14 : 9;
        else if (details.includes(term)) score += term.length > 4 ? 4 : 2;
      }
      if (usesPreviousProduct) {
        for (const term of memoryTerms) {
          if (identity.includes(term)) score += 1;
        }
      }
      if (score > 0 && Number(product.stock || 0) > 0) score += 1;
      return { product, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map((item) => item.product);
}

function buildCustomerBotMemory(db, customer, cart = { items: [] }, incomingText = "", safeAnswer = "") {
  const phone = normalizePhone(customer.phone || "");
  const latestOrder = (db.orders || []).find((order) => normalizePhone(order.phone) === phone) || null;
  const cartItems = cart.items || [];
  const stage = inferBotStage(latestOrder, cartItems);
  return {
    botStage: stage,
    activeOrderId: latestOrder?.id || "",
    lastIntent: inferLastIntent(incomingText, stage),
    lastBotAnswer: String(safeAnswer || "").slice(0, 500),
    memory: {
      latestOrderId: latestOrder?.id || "",
      latestOrderStatus: latestOrder?.status || "",
      latestPaymentStatus: latestOrder?.paymentStatus || "",
      latestValidationStatus: latestOrder?.validationStatus || "",
      cartItemCount: cartItems.length,
      lastCustomerMessage: String(incomingText || "").slice(0, 500)
    }
  };
}

function inferBotStage(order, cartItems = []) {
  if (cartItems.length) return "cart_building";
  if (!order) return "lead_new";
  const status = normalizeLoose(order.status);
  const validation = normalizeLoose(order.validationStatus);
  const payment = normalizeLoose(order.paymentStatus);

  if (validation === "pendiente datos cliente" || status === "datos por completar") return "awaiting_customer_data";
  if (validation === "pendiente comprobante" || status === "pendiente comprobante" || payment === "pendiente comprobante") return "awaiting_payment_proof";
  if (/pendiente validacion pago|comprobante recibido/.test(payment)) return "validating_payment";
  if (status === "despachado") return "dispatched";
  if (status === "validado manualmente" || validation === "validado") return "ready_to_dispatch";
  if (status === "cancelado" || validation === "rechazado") return "post_sale_support";
  return "validating_order";
}

function inferLastIntent(text, stage) {
  const normalized = normalizeLoose(text);
  if (/comprobante|soporte|ticket|recibo|voucher|pague|transferi|consigne/.test(normalized)) return "payment_proof";
  if (/estado|guia|seguimiento|despacho|envio|mi pedido|mi producto|cuando llega|a la espera/.test(normalized)) return "order_followup";
  if (/confirmar pedido|confirmo pedido|ese seria|eso seria|listo mi pedido/.test(normalized)) return "checkout";
  if (/elimina|quita|borra|deja|carrito|no quiero/.test(normalized)) return "cart_edit";
  if (/comprar|cotizar|precio|necesito|quiero|busco|catalogo|producto/.test(normalized)) return "shopping";
  return stage === "lead_new" ? "lead" : "state_followup";
}

function normalizeLoose(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

app.use((error, req, res, next) => {
  console.error(error);
  res.status(error.statusCode || 500).json({
    error: error.message || "Error interno del servidor",
    details: error.details
  });
});

function startSaintInventoryMirrorWorker() {
  let running = false;
  let lastStatus = "";

  const sync = async () => {
    if (running) return;
    running = true;
    try {
      const result = await refreshSaintInventoryMirror();
      if (
        result.status === "synced"
        && (
          lastStatus !== "synced"
          || Number(result.saintMirrorDeletedCount || 0) > 0
          || Number(result.saintMirrorPreviousCount || 0) !== Number(result.saintMirrorProductCount || 0)
        )
      ) {
        console.log(
          `Espejo SAINT actualizado: ${result.saintMirrorProductCount} productos, ${result.saintMirrorDeletedCount} eliminados localmente`
        );
      } else if (result.status === "error" && lastStatus !== `error:${result.error}`) {
        console.warn(`SAINT no disponible; se conserva el ultimo espejo MySQL: ${result.error}`);
      }
      lastStatus = result.status === "error" ? `error:${result.error}` : result.status;
    } catch (error) {
      const nextStatus = `error:${error.message || error}`;
      if (lastStatus !== nextStatus) {
        console.error("Error al sincronizar el espejo SAINT:", error);
      }
      lastStatus = nextStatus;
    } finally {
      running = false;
    }
  };

  void sync();
  const timer = setInterval(sync, SAINT_MIRROR_INTERVAL_MS);
  timer.unref?.();
  return timer;
}

init().then(async () => {
  await ensureAdminTables();
  await ensureStoreTables();
  startSaintInvoiceRetryWorker();
  startSaintInventoryMirrorWorker();
  app.listen(port, () => {
    console.log(`Bot de ventas listo en http://localhost:${port}`);
    console.log(`Webhook Twilio: http://localhost:${port}/webhook/twilio`);
  });
}).catch((error) => {
  console.error("No se pudo iniciar MySQL:", error);
  process.exit(1);
});

async function downloadTwilioChatMedia(settings, payload = {}) {
  const mediaUrl = String(payload.MediaUrl0 || "").trim();
  if (!mediaUrl) return null;
  if (!settings.accountSid || !settings.authToken) {
    throw new Error("Twilio no tiene credenciales para descargar el adjunto");
  }
  const response = await fetch(mediaUrl, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${settings.accountSid}:${settings.authToken}`).toString("base64")}`
    },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) {
    throw new Error(`Twilio media download failed: ${response.status} ${response.statusText}`);
  }
  const contentType = String(payload.MediaContentType0 || response.headers.get("content-type") || "application/octet-stream");
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) throw new Error("Twilio entrego un archivo vacio");
  if (buffer.length > 16 * 1024 * 1024) throw new Error("El archivo recibido supera el limite de 16 MB");
  const sid = sanitizeMediaBaseName(payload.MessageSid || payload.SmsMessageSid || `incoming-${Date.now()}`);
  return persistChatMediaBuffer(settings, {
    buffer,
    contentType,
    filename: `${sid}${extensionFromContentType(contentType)}`,
    direction: "incoming"
  });
}

async function saveChatMediaFile(settings, file, direction = "outgoing") {
  const contentType = String(file.mimetype || "application/octet-stream");
  const type = mediaTypeFromContentType(contentType);
  if (!type) {
    const error = new Error("Tipo de archivo no permitido para WhatsApp");
    error.statusCode = 400;
    throw error;
  }
  return persistChatMediaBuffer(settings, {
    buffer: file.buffer,
    contentType,
    filename: file.originalname || `adjunto${extensionFromContentType(contentType)}`,
    direction
  });
}

async function persistChatMediaBuffer(settings, media = {}) {
  await fs.mkdir(chatMediaDir, { recursive: true });
  const contentType = String(media.contentType || "application/octet-stream").split(";")[0];
  const type = mediaTypeFromContentType(contentType) || "file";
  const originalBase = path.basename(String(media.filename || attachmentName(type)), path.extname(String(media.filename || "")));
  const safeBase = sanitizeMediaBaseName(originalBase).slice(0, 70) || type;
  const ext = extensionFromContentType(contentType);
  const filename = `${media.direction || "media"}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${safeBase}${ext}`;
  const filePath = path.join(chatMediaDir, filename);
  await fs.writeFile(filePath, media.buffer);
  const publicBaseUrl = String(settings.publicBaseUrl || "https://vegaimportadoracolombia.com").replace(/\/$/, "");
  return {
    type,
    url: `${publicBaseUrl}/chat-media/${encodeURIComponent(filename)}`,
    name: path.basename(String(media.filename || filename)),
    filename,
    contentType,
    buffer: media.buffer,
    meta: `${Math.max(Math.round(media.buffer.length / 1024), 1)} KB | ${contentType} | ${media.direction === "outgoing" ? "Enviado" : "Recibido"} por WhatsApp`
  };
}

async function interpretIncomingMedia(settings, media, caption, recentConversation) {
  const interpreted = { ...media };
  if (media.type === "audio") {
    interpreted.transcription = await transcribeCustomerAudio(settings, media);
    if (interpreted.transcription) interpreted.meta += " | Audio transcrito por IA";
  } else if (media.type === "image") {
    interpreted.analysis = await analyzeCustomerImage(settings, {
      media,
      caption,
      recentConversation
    });
    if (interpreted.analysis) interpreted.meta += " | Imagen analizada por IA";
  }
  return interpreted;
}

function buildEffectiveIncomingText(originalText, media) {
  const parts = [];
  if (originalText) parts.push(originalText);
  if (!media) return originalText;
  if (media.type === "audio") {
    if (media.transcription) parts.push(`Transcripcion del audio del cliente: ${media.transcription}`);
    else parts.push("El cliente envio un audio que no pudo transcribirse.");
  } else if (media.type === "image") {
    const analysis = media.analysis;
    if (analysis) {
      parts.push(`Analisis de la imagen: tipo ${analysis.kind}. ${analysis.summary}`);
      if (analysis.visibleText) parts.push(`Texto visible: ${analysis.visibleText}`);
      if (analysis.productQuery) parts.push(`Producto sugerido para buscar: ${analysis.productQuery}`);
    } else {
      parts.push("El cliente envio una imagen que no pudo analizarse.");
    }
  } else if (media.type === "video") {
    parts.push("El cliente envio un video.");
  } else {
    parts.push("El cliente envio un documento adjunto.");
  }
  return parts.filter(Boolean).join("\n");
}

function buildStoredIncomingText(originalText, media) {
  if (!media) return originalText;
  const parts = [];
  if (originalText) parts.push(originalText);
  if (media.type === "audio") {
    parts.push(media.transcription ? `Transcripcion: ${media.transcription}` : "Audio recibido; no fue posible transcribirlo.");
  } else if (media.type === "image" && media.analysis?.summary) {
    parts.push(`Analisis IA: ${media.analysis.summary}`);
  } else if (!originalText) {
    parts.push(`${attachmentName(media.type)} recibido.`);
  }
  return parts.join("\n");
}

function mediaTypeFromContentType(contentType = "") {
  const type = String(contentType).toLowerCase();
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("audio/")) return "audio";
  if (type.startsWith("video/")) return "video";
  if (
    type === "application/pdf"
    || type.startsWith("text/")
    || type.includes("msword")
    || type.includes("officedocument")
    || type.includes("spreadsheet")
    || type.includes("csv")
  ) return "file";
  return "";
}

function attachmentName(type = "file") {
  if (type === "image") return "Imagen";
  if (type === "audio") return "Audio";
  if (type === "video") return "Video";
  return "Documento";
}

function sanitizeMediaBaseName(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildDemoReply(message) {
  if (message.type && message.type !== "text") {
    return {
      text: "Recibido. Lo reviso y te confirmo si ese soporte sirve para validar el pedido.",
      type: "text"
    };
  }

  const text = (message.text || "").toLowerCase();
  if (text.includes("catalogo") || text.includes("catálogo")) {
    return { text: "Gracias. Me interesa portatiles y celulares, puedes cotizarme 3 unidades?", type: "text" };
  }
  if (text.includes("pago") || text.includes("transferencia")) {
    return { text: "Listo, puedo pagar por transferencia. Envio comprobante cuando me confirmes stock.", type: "text" };
  }
  if (text.includes("guia") || text.includes("despacho")) {
    return { text: "Perfecto, quedo pendiente de la guia y tiempo estimado de entrega.", type: "text" };
  }
  return { text: "Entendido. Me confirmas precio final, disponibilidad y garantia?", type: "text" };
}

async function sendWhatsappTypingIndicator(settings, messageSid) {
  const normalizedSid = String(messageSid || "").trim();
  if (!settings.accountSid || !settings.authToken || !/^(SM|MM)[a-z0-9]{32}$/i.test(normalizedSid)) {
    return false;
  }

  const authorization = `Basic ${Buffer.from(`${settings.accountSid}:${settings.authToken}`).toString("base64")}`;
  const response = await fetch("https://messaging.twilio.com/v3/Indicators/Typing.json", {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ channel: "WHATSAPP", messageId: normalizedSid })
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => "");
    throw new Error(`Twilio Typing API ${response.status}${responseText ? `: ${responseText.slice(0, 200)}` : ""}`);
  }
  return true;
}

async function sendWhatsappMessage(settings, to, body, mediaUrl = "") {
  const client = twilio(settings.accountSid, settings.authToken);
  const messagePayload = {
    from: `whatsapp:${settings.whatsappNumber}`,
    to: `whatsapp:${to}`
  };
  if (String(body || "").trim()) messagePayload.body = String(body).trim();
  if (mediaUrl) {
    messagePayload.mediaUrl = [mediaUrl];
  }
  if (!messagePayload.body && !messagePayload.mediaUrl) {
    throw new Error("El mensaje de WhatsApp no tiene texto ni adjunto");
  }
  if (settings.messagingServiceSid) {
    delete messagePayload.from;
    messagePayload.messagingServiceSid = settings.messagingServiceSid;
  }
  return client.messages.create(messagePayload);
}

async function fetchTwilioTemplates(settings = {}) {
  if (!settings.accountSid || !settings.authToken) {
    throw Object.assign(new Error("Twilio no esta configurado para consultar plantillas"), { statusCode: 400 });
  }
  const templates = [];
  let nextUrl = "https://content.twilio.com/v1/Content?PageSize=100";
  const auth = `Basic ${Buffer.from(`${settings.accountSid}:${settings.authToken}`).toString("base64")}`;

  for (let page = 0; nextUrl && page < 10; page += 1) {
    const response = await fetch(nextUrl, { headers: { Authorization: auth } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw Object.assign(new Error(body.message || `Twilio Content API ${response.status}`), { statusCode: response.status });
    }
    const contents = body.contents || body.content || [];
    templates.push(...contents.map(mapTwilioTemplate));
    nextUrl = body.meta?.next_page_url || body.next_page_url || "";
  }

  return templates.sort((a, b) => a.name.localeCompare(b.name));
}

function mapTwilioTemplate(template = {}) {
  const types = template.types || {};
  const textBody = types["twilio/text"]?.body || types["twilio/quick-reply"]?.body || types["twilio/call-to-action"]?.body || "";
  return {
    sid: template.sid,
    name: template.friendly_name || template.friendlyName || template.sid,
    language: template.language || "",
    variables: template.variables || {},
    body: textBody,
    types: Object.keys(types),
    dateUpdated: template.date_updated || template.dateUpdated || ""
  };
}

async function sendWhatsappTemplate(settings, to, contentSid, variables = {}) {
  const client = twilio(settings.accountSid, settings.authToken);
  const messagePayload = {
    to: `whatsapp:${to}`,
    contentSid
  };
  if (Object.keys(variables || {}).length) {
    messagePayload.contentVariables = JSON.stringify(variables);
  }
  if (settings.messagingServiceSid) {
    messagePayload.messagingServiceSid = settings.messagingServiceSid;
  } else {
    messagePayload.from = `whatsapp:${settings.whatsappNumber}`;
  }
  return client.messages.create(messagePayload);
}

async function notifyDispatchIfNeeded(settings, previousOrder, order) {
  if (!order || order.status !== "Despachado") return { sent: false, reason: "not_dispatched" };
  const guide = String(order.dispatch?.guide || "").trim();
  const previousGuide = String(previousOrder?.dispatch?.guide || "").trim();
  const wasAlreadyDispatched = previousOrder?.status === "Despachado";
  if (wasAlreadyDispatched && previousGuide === guide) {
    return { sent: false, reason: "already_notified_for_same_dispatch" };
  }

  const message = guide
    ? buildDispatchNotification(order)
    : buildDispatchPendingGuideNotification(order);
  await appendConversation(order.customerId, "bot", { text: message, type: "text" });

  const twilioReady = Boolean(settings.accountSid && settings.authToken && settings.whatsappNumber);
  if (!twilioReady) return { sent: false, reason: "twilio_not_configured", message };

  try {
    await sendWhatsappMessage(settings, order.phone, message);
    return { sent: true, message };
  } catch (error) {
    console.error("No se pudo enviar guia por Twilio:", error.message);
    return { sent: false, reason: "twilio_error", error: error.message, message };
  }
}

async function notifyValidationIfNeeded(settings, previousOrder, order) {
  if (!order || order.status === "Despachado") {
    return { sent: false, reason: order ? "dispatch_has_priority" : "missing_order" };
  }
  const isValidated = order.validationStatus === "validado" || order.status === "Validado manualmente";
  const wasValidated = previousOrder?.validationStatus === "validado"
    || previousOrder?.status === "Validado manualmente";
  if (!isValidated) return { sent: false, reason: "not_validated" };
  if (wasValidated) return { sent: false, reason: "already_notified_for_validation" };

  const message = buildOrderValidatedNotification(order);
  await appendConversation(order.customerId, "bot", { text: message, type: "text" });

  const twilioReady = Boolean(settings.accountSid && settings.authToken && settings.whatsappNumber);
  if (!twilioReady) return { sent: false, reason: "twilio_not_configured", message };

  try {
    await sendWhatsappMessage(settings, order.phone, message);
    return { sent: true, message };
  } catch (error) {
    console.error("No se pudo notificar la validacion del pedido por Twilio:", error.message);
    return { sent: false, reason: "twilio_error", error: error.message, message };
  }
}

function buildPaymentReceivedNotification(order) {
  const total = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(order.total || 0);
  return `Pago recibido y validado para tu pedido ${order.id}.\n\nValor registrado: ${total}.\n\nAhora dejemos listos los datos de despacho. ¿A nombre de quien registramos el pedido?`;
}

async function forwardPaymentProofToValidator(settings, validation) {
  const validatorPhone = normalizePhone(settings.paymentValidatorNumber || "");
  if (!validatorPhone) return { sent: false, reason: "missing_validator_phone" };
  const order = validation.order;
  const publicMediaUrl = await prepareTwilioMediaForForwarding(settings, validation);
  const validationForValidator = { ...validation, mediaUrl: publicMediaUrl || validation.mediaUrl || "" };
  await createPaymentValidationRequest({
    order,
    validatorPhone,
    text: validation.text || "",
    mediaUrl: validationForValidator.mediaUrl || "",
    mediaType: validation.mediaType || ""
  });

  const message = buildValidatorPaymentMessage(order, validationForValidator);
  const twilioReady = Boolean(settings.accountSid && settings.authToken && settings.whatsappNumber);
  if (!twilioReady) return { sent: false, reason: "twilio_not_configured", message };
  try {
    const attachMedia = publicMediaUrl ? await canDownloadWithoutInterstitial(publicMediaUrl) : false;
    await sendWhatsappMessage(settings, validatorPhone, message, attachMedia ? publicMediaUrl : "");
    return { sent: true, message };
  } catch (error) {
    console.error("No se pudo reenviar comprobante al validador:", error.message);
    return { sent: false, reason: "twilio_error", error: error.message, message };
  }
}

async function prepareTwilioMediaForForwarding(settings, validation) {
  const mediaUrl = String(validation.mediaUrl || "").trim();
  if (!mediaUrl) return "";
  const publicBaseUrl = String(settings.publicBaseUrl || "").replace(/\/$/, "");
  if (!publicBaseUrl || !settings.accountSid || !settings.authToken) return "";
  if (mediaUrl.startsWith(`${publicBaseUrl}/chat-media/`) || mediaUrl.startsWith(`${publicBaseUrl}/payment-proofs/`)) {
    return mediaUrl;
  }

  try {
    await fs.mkdir(paymentMediaDir, { recursive: true });
    const response = await fetch(mediaUrl, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${settings.accountSid}:${settings.authToken}`).toString("base64")}`
      }
    });
    if (!response.ok) {
      throw new Error(`Twilio media download failed: ${response.status} ${response.statusText}`);
    }

    const contentType = validation.mediaType || response.headers.get("content-type") || "application/octet-stream";
    const ext = extensionFromContentType(contentType);
    const filename = `${validation.order.id}-${Date.now()}${ext}`;
    const filePath = path.join(paymentMediaDir, filename);
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(filePath, buffer);
    return `${publicBaseUrl}/payment-proofs/${encodeURIComponent(filename)}`;
  } catch (error) {
    console.error("No se pudo preparar el comprobante para reenviar:", error.message);
    return "";
  }
}

function extensionFromContentType(contentType = "") {
  const normalized = String(contentType).toLowerCase();
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return ".jpg";
  if (normalized.includes("png")) return ".png";
  if (normalized.includes("webp")) return ".webp";
  if (normalized.includes("gif")) return ".gif";
  if (normalized.includes("audio/ogg") || normalized.includes("application/ogg")) return ".ogg";
  if (normalized.includes("audio/mpeg") || normalized.includes("audio/mp3")) return ".mp3";
  if (normalized.includes("audio/mp4") || normalized.includes("audio/m4a")) return ".m4a";
  if (normalized.includes("audio/wav") || normalized.includes("audio/x-wav")) return ".wav";
  if (normalized.includes("audio/webm")) return ".webm";
  if (normalized.includes("video/mp4")) return ".mp4";
  if (normalized.includes("video/webm")) return ".webm";
  if (normalized.includes("quicktime")) return ".mov";
  if (normalized.includes("pdf")) return ".pdf";
  if (normalized.includes("wordprocessingml")) return ".docx";
  if (normalized.includes("spreadsheetml")) return ".xlsx";
  if (normalized.includes("msword")) return ".doc";
  if (normalized.includes("csv")) return ".csv";
  if (normalized.includes("text/plain")) return ".txt";
  return ".bin";
}

async function canDownloadWithoutInterstitial(url) {
  try {
    const response = await fetch(url, { redirect: "follow" });
    if (!response.ok) return false;
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("text/html")) return true;
    const body = await response.text();
    return !/ERR_NGROK_6024|ngrok-free\.app|ngrok-free\.dev|You are about to visit/i.test(body);
  } catch (error) {
    console.error("No se pudo validar descarga publica del comprobante:", error.message);
    return false;
  }
}

function buildValidatorPaymentMessage(order, validation) {
  const mediaLine = validation.mediaUrl ? `\nComprobante: ${validation.mediaUrl}` : "";
  const textLine = validation.text ? `\nTexto cliente: ${validation.text}` : "";
  return `Validar pago pedido ${order.id}\nCliente: ${order.customerName}\nWhatsApp: ${order.phone}\nTotal: ${new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(order.total || 0)}${textLine}${mediaLine}\n\nResponde VALIDADO para aprobar el ultimo comprobante pendiente, o VALIDADO ${order.id}.`;
}

async function handlePaymentValidatorReply(settings, from, body) {
  if (!isPaymentValidationApprovalSafe(body)) {
    return buildValidatorOnlyReply();
  }
  const validation = await findPendingPaymentValidation(from, body);
  if (!validation) {
    return "No encontre comprobantes pendientes para validar con este numero.";
  }
  const db = await readDb();
  const order = db.orders.find((item) => item.id === validation.orderId);
  if (!order) {
    return `No encontre el pedido ${validation.orderId}.`;
  }
  const updatedOrder = await updateOrderValidation(order.id, {
    status: "Pendiente datos envio",
    paymentStatus: "Pago validado",
    validationStatus: "pendiente_datos_envio",
    internalNotes: `${order.internalNotes || ""}\nPago validado por ${normalizePhone(from)}.`.trim()
  });
  await completePaymentValidation(validation.id);
  await updateCustomerBotMemory(updatedOrder.customerId, {
    botStage: "ESPERANDO_NOMBRE",
    activeOrderId: updatedOrder.id,
    lastIntent: "payment_validated",
    lastBotAnswer: "",
    memory: {
      estado: "ESPERANDO_NOMBRE",
      salesFlowStage: "ESPERANDO_NOMBRE",
      activeOrderId: updatedOrder.id,
      modo_asesor: false,
      campo_esperado: "nombre_cliente",
      paymentValidatedAt: new Date().toLocaleString("es-CO", { hour12: false })
    }
  });

  const message = buildPaymentReceivedNotification(updatedOrder);
  await appendConversation(updatedOrder.customerId, "bot", { text: message, type: "text" });
  if (settings.accountSid && settings.authToken && settings.whatsappNumber) {
    await sendWhatsappMessage(settings, updatedOrder.phone, message);
  }
  return `Pago validado para ${updatedOrder.id}. Cliente notificado.`;
}

function isPaymentValidator(settings, from) {
  return normalizePhone(from) === normalizePhone(settings.paymentValidatorNumber || "");
}

function isPaymentValidationApprovalSafe(text) {
  const normalized = String(text || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.!¡!]+$/g, "")
    .trim();
  return /^(validado|valido|validar|aprobado|ok)(\s+ped-[a-z0-9-]+)?$/i.test(normalized);
}

function buildValidatorOnlyReply() {
  return "Este numero esta configurado solo para validar pagos de VEGA IMPORTADORA. No recibe catalogo, carrito ni pedidos. Para aprobar un pago responde VALIDADO o VALIDADO PED-XXXXXX.";
}

function isPaymentValidationApproval(text) {
  return /^(validado|valido|válido|validar|aprobado|ok)(\s+PED-[A-Z0-9-]+)?[.!¡! ]*$/i.test(String(text || "").trim());
}

function normalizePhone(value) {
  const raw = String(value || "").replace("whatsapp:", "").trim();
  if (!raw) return "";
  return raw.startsWith("+") ? raw : `+${raw.replace(/\D/g, "")}`;
}

function buildDispatchNotification(order) {
  const carrier = String(order.dispatch?.carrier || "").trim();
  const guide = String(order.dispatch?.guide || "").trim();
  const city = order.customerCity || order.dispatch?.city || "";
  const address = order.deliveryAddress || order.dispatch?.address || "";
  const total = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(order.total || 0);
  return `Tu pedido ${order.id} ya fue despachado.\n\nGuia de seguimiento: ${carrier ? `${carrier} - ` : ""}${guide}\nDestino: ${city || "ciudad registrada"}${address ? `, ${address}` : ""}\nTotal del pedido: ${total}\n\nGracias por comprar en VEGA IMPORTADORA.`;
}

function buildDispatchPendingGuideNotification(order) {
  return `Tu pedido ${order.id} fue marcado como despachado. Estamos pendientes de registrar la guia de la transportadora y te la enviaremos por este mismo WhatsApp apenas quede disponible.`;
}

function buildOrderValidatedNotification(order) {
  const total = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(order.total || 0);
  return `Tu pedido ${order.id} fue validado correctamente.\n\nPago: ${order.paymentStatus || "registrado"}\nTotal: ${total}\n\nAhora iniciaremos la preparacion del pedido y te informaremos por este WhatsApp cuando sea despachado.`;
}

function sanitizeSettings(settings = {}) {
  return {
    ...settings,
    orderNotificationNumber: settings.orderNotificationNumber || "3212947266",
    authToken: "",
    aiApiKey: "",
    wompiPrivateKey: "",
    inventoryKey: "",
    inventoryKeyHash: "",
    authTokenConfigured: Boolean(settings.authToken),
    aiApiKeyConfigured: Boolean(settings.aiApiKey),
    wompiPrivateKeyConfigured: Boolean(settings.wompiPrivateKey),
    inventoryKeyConfigured: Boolean(settings.inventoryKeyHash)
  };
}

function hashInventoryKey(value) {
  return crypto.createHash("sha256").update(`vega-inventory:${String(value || "").trim()}`).digest("hex");
}

function verifyInventoryKey(settings = {}, value = "") {
  const hash = String(settings.inventoryKeyHash || "");
  const key = String(value || "").trim();
  if (!hash || !/^\d{6}$/.test(key)) return false;
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hashInventoryKey(key)));
}

const STORE_NOVELTIES_SUBCATEGORY_ID = "__novedades__";

function isStoreNoveltyProduct(product = {}) {
  const promotionPercent = Number(product.promotionPercent ?? product.promotion_percent ?? 0);
  const hasPromotion = Boolean(product.promotionEnabled ?? product.promotion_enabled)
    && promotionPercent > 0;
  const hasFreeShipping = Boolean(product.freeShipping ?? product.free_shipping);
  return hasPromotion || hasFreeShipping;
}

function mapStoreCategory(category, subcategories = [], products = [], includeEmptySubcategories = true) {
  const sourceName = String(category.sourceName || category.name || "General");
  const categoryName = String(category.displayName || category.name || "General");
  const mappedSubcategories = subcategories
    .filter((subcategory) => String(subcategory.categoryName) === sourceName)
    .map((subcategory) => {
      const productCount = products.filter(
        (product) => String(product.subcategoryId || "") === String(subcategory.id)
      ).length;
      return {
        id: String(subcategory.id),
        category_id: String(category.id || categoryName),
        category_name: categoryName,
        name: String(subcategory.name || ""),
        icon: String(subcategory.icon || "").trim() || "📦",
        product_count: productCount
      };
    })
    .filter((subcategory) => includeEmptySubcategories || subcategory.product_count > 0);
  const noveltyProductCount = includeEmptySubcategories
    ? 0
    : products.filter((product) => (
      String(product.category || "General") === sourceName
      && isStoreProductVisible(product)
      && isStoreNoveltyProduct(product)
    )).length;
  const noveltySubcategory = noveltyProductCount > 0
    ? {
      id: STORE_NOVELTIES_SUBCATEGORY_ID,
      category_id: String(category.id || categoryName),
      category_name: categoryName,
      name: "Novedades",
      icon: "\u2728",
      product_count: noveltyProductCount
    }
    : null;
  const displayedSubcategories = noveltySubcategory
    ? [noveltySubcategory, ...mappedSubcategories]
    : mappedSubcategories;
  const genericBrandNames = new Set([
    "", "general", "generico", "generica", "sin marca", "no aplica", "n a", "na"
  ]);
  const hasVisibleBrandSubcategory = mappedSubcategories.some((subcategory) => (
    products.some((product) => {
      const brandName = normalizeLoose(product.brand);
      return String(product.category || "General") === sourceName
        && String(product.subcategoryId || "") === String(subcategory.id)
        && !genericBrandNames.has(brandName)
        && brandName === normalizeLoose(subcategory.name);
    })
  ));
  const usefulSubcategories = includeEmptySubcategories
    || noveltySubcategory
    || hasVisibleBrandSubcategory
    || mappedSubcategories.length > 1
    ? displayedSubcategories
    : [];
  return {
    id: String(category.id || categoryName),
    name: categoryName,
    source_name: sourceName,
    icon: String(category.icon || "").trim() || getDefaultCategoryIcon(categoryName),
    subcategories: usefulSubcategories
  };
}

function isStoreAdminUser(user) {
  return user?.role === "admin" || user?.role === "super_admin";
}

function isStoreProductVisible(product = {}) {
  const enabled = product.storeEnabled ?? product.store_enabled ?? true;
  return Boolean(enabled);
}

async function prepareCatalogImage(imageUrl) {
  const source = String(imageUrl || "").trim();
  if (!source.startsWith("/uploads/")) return null;

  const relativePath = decodeURIComponent(source.replace(/^\/uploads\//, ""));
  const filePath = path.resolve(storeUploadsDir, relativePath);
  const safeBase = `${path.resolve(storeUploadsDir)}${path.sep}`;
  if (!filePath.startsWith(safeBase) || !/\.(jpe?g|png|webp|gif|avif)$/i.test(filePath)) return null;

  try {
    await fs.access(filePath);
    return await sharp(filePath, { animated: false })
      .rotate()
      .resize(180, 180, { fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#F2F4F7" })
      .jpeg({ quality: 62, mozjpeg: true })
      .toBuffer();
  } catch {
    return null;
  }
}

function formatCatalogPrice(value) {
  return `$${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Number(value || 0))}`;
}

function truncateCatalogText(value, maxLength) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...` : text;
}

function writeStoreCatalogPdf(stream, products) {
  const document = new PDFDocument({ autoFirstPage: false, compress: true, info: {
    Title: "Catalogo VEGA IMPORTADORA",
    Author: "VEGA IMPORTADORA",
    Subject: "Catalogo actualizado de productos"
  } });
  document.on("error", (error) => stream.destroy(error));
  document.pipe(stream);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 32;
  const gap = 12;
  const cardWidth = (pageWidth - margin * 2 - gap) / 2;
  const cardHeight = 160;
  const cardsPerPage = 8;
  const generatedAt = new Intl.DateTimeFormat("es-CO", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Bogota"
  }).format(new Date());

  const addPage = (pageNumber) => {
    document.addPage({ size: "A4", margin });
    document.rect(0, 0, pageWidth, 76).fill("#0866D9");
    document.roundedRect(margin, 18, 38, 38, 8).fill("#FFFFFF");
    document.fillColor("#0866D9").font("Helvetica-Bold").fontSize(22).text("V", margin + 11, 25, { width: 18, align: "center" });
    document.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(17).text("VEGA IMPORTADORA", margin + 50, 22);
    document.font("Helvetica").fontSize(8.5).fillColor("#DCEBFF").text("Catalogo de productos actualizado", margin + 50, 45);
    document.font("Helvetica").fontSize(7.5).fillColor("#DCEBFF").text(generatedAt, pageWidth - margin - 180, 31, { width: 180, align: "right" });
    document.fillColor("#667085").font("Helvetica").fontSize(7.5).text(`Pagina ${pageNumber}`, margin, pageHeight - 42, { width: pageWidth - margin * 2, align: "right", lineBreak: false });
  };

  if (!products.length) {
    addPage(1);
    document.fillColor("#1D2939").font("Helvetica-Bold").fontSize(18).text("No hay productos disponibles en la tienda.", margin, 140);
    document.end();
    return;
  }

  products.forEach((product, index) => {
    const pageIndex = Math.floor(index / cardsPerPage);
    const position = index % cardsPerPage;
    if (position === 0) addPage(pageIndex + 1);

    const column = position % 2;
    const row = Math.floor(position / 2);
    const x = margin + column * (cardWidth + gap);
    const y = 94 + row * (cardHeight + 10);
    const imageX = x + 10;
    const imageY = y + 12;
    const imageWidth = 86;
    const imageHeight = 102;
    const textX = imageX + imageWidth + 9;
    const textWidth = cardWidth - imageWidth - 31;
    const retailLabel = product.promotion_enabled ? "Precio promocion" : "Precio detal";
    const stock = Number(product.stock || 0);

    document.roundedRect(x, y, cardWidth, cardHeight, 7).fill("#FFFFFF").strokeColor("#D0D5DD").lineWidth(0.7).stroke();
    document.roundedRect(imageX, imageY, imageWidth, imageHeight, 5).fill("#F2F4F7");
    if (product.catalogImage) {
      try {
        document.image(product.catalogImage, imageX + 3, imageY + 3, { fit: [imageWidth - 6, imageHeight - 6], align: "center", valign: "center" });
      } catch {
        document.fillColor("#98A2B3").font("Helvetica-Bold").fontSize(9).text("SIN IMAGEN", imageX + 8, imageY + 45, { width: imageWidth - 16, align: "center" });
      }
    } else {
      document.fillColor("#98A2B3").font("Helvetica-Bold").fontSize(9).text("SIN IMAGEN", imageX + 8, imageY + 45, { width: imageWidth - 16, align: "center" });
    }

    document.fillColor("#667085").font("Helvetica-Bold").fontSize(6.5).text(truncateCatalogText(product.category_name, 28).toUpperCase(), textX, imageY, { width: textWidth });
    document.fillColor("#101828").font("Helvetica-Bold").fontSize(9.2).text(truncateCatalogText(product.name, 48), textX, imageY + 13, { width: textWidth, height: 34, lineGap: 1 });
    document.fillColor("#667085").font("Helvetica").fontSize(6.8).text(`Ref: ${truncateCatalogText(product.saint_name || product.sku, 34)}`, textX, imageY + 51, { width: textWidth, height: 18 });
    document.fillColor("#0866D9").font("Helvetica-Bold").fontSize(8).text(`${retailLabel}: ${formatCatalogPrice(product.price)}`, textX, imageY + 75, { width: textWidth });
    document.fillColor("#1D7A46").font("Helvetica-Bold").fontSize(7.2).text(`Precio mayorista: ${formatCatalogPrice(product.price_1)}`, textX, imageY + 89, { width: textWidth });
    document.fillColor(stock > 0 ? "#1D7A46" : "#B42318").font("Helvetica-Bold").fontSize(7).text(stock > 0 ? `Existencias: ${stock}` : "Agotado", x + 10, y + 127, { width: cardWidth - 20 });
    if (product.free_shipping || product.promotion_enabled) {
      const badge = product.free_shipping ? "ENVIO GRATIS" : "EN PROMOCION";
      document.roundedRect(x + 10, y + 142, 67, 11, 4).fill(product.free_shipping ? "#ECFDF3" : "#FFF1F3");
      document.fillColor(product.free_shipping ? "#027A48" : "#C01048").font("Helvetica-Bold").fontSize(5.5).text(badge, x + 12, y + 145, { width: 63, align: "center" });
    }
  });

  document.end();
}

function mapStoreProduct(product, categories = []) {
  const category = categories.find((item) => String(item.sourceName || item.name) === String(product.category));
  const price1 = Number(product.price1 ?? product.wholesalePrice ?? 0);
  const price2 = Number(product.price2 ?? product.retailPrice ?? 0);
  const price = getRetailPrice(product);
  const isSaintProduct = Boolean(product.saintName)
    || String(product.source || "").toLowerCase().startsWith("saint:");
  const saintName = isSaintProduct ? String(product.saintName || product.name || "").trim() : "";
  const storeName = String(product.storeName || "").trim() || (isSaintProduct ? "SIN NOMBRE" : product.name);
  const promotionPercent = Number(product.promotionPercent ?? product.promotion_percent ?? 0);
  const promotionEnabled = Boolean(product.promotionEnabled ?? product.promotion_enabled) && promotionPercent > 0;
  const enabled = Boolean(product.storeEnabled ?? product.store_enabled ?? true);
  return {
    id: String(product.id),
    sku: String(product.id),
    name: storeName,
    saint_name: saintName,
    category_id: String(category?.id || product.category || ""),
    category_name: category?.displayName || product.category || "General",
    subcategory_id: String(product.subcategoryId || ""),
    subcategory_name: String(product.subcategoryName || ""),
    price,
    price_1: price1,
    price_2: price2,
    price_level: 2,
    free_shipping: Boolean(product.freeShipping ?? product.free_shipping),
    promotion_enabled: promotionEnabled,
    promotion_percent: promotionEnabled ? promotionPercent : 0,
    enabled,
    stock: Number(product.availableStock ?? product.stock ?? 0),
    images: Array.isArray(product.images) ? product.images : [],
    description: product.storeDescription || product.botFeatures || buildStoreProductDescription(product),
    status: enabled && product.status === "Disponible" && price > 0 && Number(product.availableStock ?? product.stock ?? 0) > 0
  };
}

function buildStoreSettingsResponse(settings = {}) {
  const wholesalePolicy = getWholesalePolicy(settings);
  return {
    hero_banner_url: settings.hero_banner_url || "",
    escena_1_url: settings.escena_1_url || "",
    escena_2_url: settings.escena_2_url || "",
    facebook_url: normalizeSocialUrl(settings.facebook_url, "facebook_url"),
    instagram_url: normalizeSocialUrl(settings.instagram_url, "instagram_url"),
    tiktok_url: normalizeSocialUrl(settings.tiktok_url, "tiktok_url"),
    youtube_url: normalizeSocialUrl(settings.youtube_url, "youtube_url"),
    bankInfo: String(settings.bankInfo || "").trim(),
    paymentTerms: String(settings.paymentTerms || "").trim(),
    minimumWholesaleUnits: wholesalePolicy.minimumUnits,
    minimumWholesaleReferences: wholesalePolicy.minimumReferences,
    minimumWholesaleTotalUnits: wholesalePolicy.minimumTotalUnits,
    minimumWholesaleAmount: wholesalePolicy.minimumAmount
  };
}

function normalizeSocialUrl(value, key) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const allowedDomains = {
    facebook_url: ["facebook.com", "fb.com"],
    instagram_url: ["instagram.com"],
    tiktok_url: ["tiktok.com"],
    youtube_url: ["youtube.com", "youtu.be"]
  };

  try {
    const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const isAllowed = (allowedDomains[key] || []).some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
    );
    if (!isAllowed || !["http:", "https:"].includes(parsed.protocol)) return "";
    parsed.protocol = "https:";
    return parsed.toString();
  } catch {
    return "";
  }
}

function buildStoreProductDescription(product) {
  const details = [
    product.brand ? `Marca: ${product.brand}` : "",
    product.warranty ? `Garantia: ${product.warranty}` : "",
    product.deposito ? `Deposito: ${product.deposito}` : "",
    product.puesto ? `Ubicacion: ${product.puesto}` : ""
  ].filter(Boolean);
  return details.join(" | ");
}

function addNoIndexHeaders(req, res, next) {
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
  next();
}

async function ensureAdminTables() {
  const db = await getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id VARCHAR(80) PRIMARY KEY,
      name VARCHAR(180) NOT NULL,
      email VARCHAR(180) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role VARCHAR(40) NOT NULL DEFAULT 'admin',
      status TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS admin_sessions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(80) NOT NULL,
      token_hash CHAR(64) NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_admin_sessions_token (token_hash),
      INDEX idx_admin_sessions_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  const [rows] = await db.query("SELECT id FROM admin_users LIMIT 1");
  if (!rows.length) {
    const email = process.env.ADMIN_EMAIL || "admin@vega.local";
    const password = process.env.ADMIN_PASSWORD || "VegaAdmin2026!";
    await db.query(
      "INSERT INTO admin_users (id, name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?, 1)",
      [crypto.randomUUID(), "Administrador VEGA", normalizeEmail(email), await hashPassword(password), "admin"]
    );
    console.log(`Admin inicial creado: ${email}`);
  }
}

async function validateAdminLogin(emailValue, password) {
  const db = await getPool();
  const [rows] = await db.query("SELECT * FROM admin_users WHERE email = ? LIMIT 1", [normalizeEmail(emailValue)]);
  const user = rows[0];
  if (!user || !user.status) return null;
  return (await verifyPassword(String(password || ""), user.password_hash)) ? user : null;
}

async function createAdminSession(userId) {
  const db = await getPool();
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
  await db.query("DELETE FROM admin_sessions WHERE expires_at < CURRENT_TIMESTAMP");
  await db.query("INSERT INTO admin_sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)", [userId, tokenHash, expiresAt]);
  return { token, expiresAt };
}

async function requireAdminSession(req, res, next) {
  try {
    const token = getCookie(req, "vega_admin_session");
    if (!token) return rejectAdminRequest(req, res);
    const db = await getPool();
    const [rows] = await db.query(
      `SELECT u.* FROM admin_sessions s
       INNER JOIN admin_users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > CURRENT_TIMESTAMP AND u.status = 1
       LIMIT 1`,
      [hashToken(token)]
    );
    if (!rows.length) return rejectAdminRequest(req, res);
    req.adminUser = rows[0];
    next();
  } catch (error) {
    next(error);
  }
}

function requireAdminAsset(req, res, next) {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  return requireAdminSession(req, res, next);
}

function isFullAdmin(user = {}) {
  return String(user.role || "").toLowerCase() === ADMIN_ROLE;
}

function requireFullAdmin(req, res, next) {
  if (!isFullAdmin(req.adminUser)) {
    return res.status(403).json({ error: "Esta accion requiere el rol Administrador" });
  }
  next();
}

function buildAdminPermissions(user = {}) {
  const fullAdmin = isFullAdmin(user);
  return {
    allowedViews: fullAdmin
      ? ["dashboard", "clientes", "pedidos", "inventario", "facturas", "config", "tienda"]
      : ["clientes", "pedidos", "facturas"],
    canManageUsers: fullAdmin,
    canManageInventory: fullAdmin,
    canManageSettings: fullAdmin
  };
}

function rejectAdminRequest(req, res) {
  if (req.path.startsWith("/api/")) return res.status(401).json({ error: "Sesion requerida" });
  return res.redirect("/login");
}

async function deleteAdminSession(token) {
  if (!token) return;
  const db = await getPool();
  await db.query("DELETE FROM admin_sessions WHERE token_hash = ?", [hashToken(token)]);
}

function setAdminCookie(res, token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `vega_admin_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${12 * 60 * 60}${secure}`
  );
}

function clearAdminCookie(res) {
  res.setHeader("Set-Cookie", "vega_admin_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
}

function getCookie(req, name) {
  const cookies = String(req.headers.cookie || "").split(";").map((part) => part.trim());
  const found = cookies.find((part) => part.startsWith(`${name}=`));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : "";
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function toAdminUserResponse(user = {}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: normalizeAdminRole(user.role) || ADVISOR_CASHIER_ROLE,
    roleLabel: adminRoleLabel(user.role),
    status: user.status === undefined ? true : Boolean(user.status),
    createdAt: user.created_at || user.createdAt || null
  };
}

function normalizeAdminRole(value) {
  const role = String(value || "").trim().toLowerCase().replace(/[\/\s-]+/g, "_");
  return ADMIN_PANEL_ROLES.has(role) ? role : "";
}

function adminRoleLabel(value) {
  return normalizeAdminRole(value) === ADMIN_ROLE ? "Administrador" : "Asesor / Caja";
}

function adminValidationError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function listAdminPanelUsers() {
  const db = await getPool();
  const [rows] = await db.query(
    `SELECT id, name, email, role, status, created_at, updated_at
     FROM admin_users
     ORDER BY FIELD(role, 'admin', 'asesor_caja'), name`
  );
  return rows.map(toAdminUserResponse);
}

async function createAdminPanelUser(payload = {}) {
  const name = String(payload.name || "").trim();
  const email = normalizeEmail(payload.email);
  const password = String(payload.password || "");
  const role = normalizeAdminRole(payload.role || ADVISOR_CASHIER_ROLE);
  if (name.length < 3) throw adminValidationError("El nombre debe tener al menos 3 caracteres");
  if (!email || !email.includes("@")) throw adminValidationError("Ingresa un correo valido");
  if (password.length < 10) throw adminValidationError("La contrasena debe tener al menos 10 caracteres");
  if (!role) throw adminValidationError("Rol administrativo no valido");

  const db = await getPool();
  const id = crypto.randomUUID();
  try {
    await db.query(
      `INSERT INTO admin_users (id, name, email, password_hash, role, status)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [id, name, email, await hashPassword(password), role]
    );
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      throw adminValidationError("Ya existe una cuenta administrativa con ese correo", 409);
    }
    throw error;
  }
  const [rows] = await db.query(
    `SELECT id, name, email, role, status, created_at, updated_at
     FROM admin_users WHERE id = ? LIMIT 1`,
    [id]
  );
  return toAdminUserResponse(rows[0]);
}

async function updateAdminPanelUser(userId, payload = {}, currentUserId = "") {
  const db = await getPool();
  const [rows] = await db.query("SELECT * FROM admin_users WHERE id = ? LIMIT 1", [userId]);
  const existing = rows[0];
  if (!existing) return null;

  const name = payload.name === undefined ? existing.name : String(payload.name || "").trim();
  const email = payload.email === undefined ? existing.email : normalizeEmail(payload.email);
  const role = payload.role === undefined ? normalizeAdminRole(existing.role) : normalizeAdminRole(payload.role);
  const status = payload.status === undefined ? Boolean(existing.status) : Boolean(payload.status);
  const password = String(payload.password || "");
  if (name.length < 3) throw adminValidationError("El nombre debe tener al menos 3 caracteres");
  if (!email || !email.includes("@")) throw adminValidationError("Ingresa un correo valido");
  if (!role) throw adminValidationError("Rol administrativo no valido");
  if (password && password.length < 10) throw adminValidationError("La contrasena debe tener al menos 10 caracteres");
  if (String(existing.id) === String(currentUserId) && (!status || role !== ADMIN_ROLE)) {
    throw adminValidationError("No puedes desactivar ni cambiar el rol de tu propia cuenta");
  }

  const passwordHash = password ? await hashPassword(password) : existing.password_hash;
  try {
    await db.query(
      `UPDATE admin_users
       SET name = ?, email = ?, password_hash = ?, role = ?, status = ?
       WHERE id = ?`,
      [name, email, passwordHash, role, status ? 1 : 0, userId]
    );
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      throw adminValidationError("Ya existe una cuenta administrativa con ese correo", 409);
    }
    throw error;
  }
  if ((!status || password) && String(existing.id) !== String(currentUserId)) {
    await db.query("DELETE FROM admin_sessions WHERE user_id = ?", [userId]);
  }
  const [updatedRows] = await db.query(
    `SELECT id, name, email, role, status, created_at, updated_at
     FROM admin_users WHERE id = ? LIMIT 1`,
    [userId]
  );
  return toAdminUserResponse(updatedRows[0]);
}

function getAdminLoginAttemptKey(req) {
  return `${req.ip || req.socket?.remoteAddress || "local"}:${normalizeEmail(req.body?.email)}`;
}

function isAdminLoginLocked(key) {
  const record = adminLoginAttempts.get(key);
  if (!record) return false;
  if (record.lockedUntil && record.lockedUntil > Date.now()) return true;
  if (record.lockedUntil && record.lockedUntil <= Date.now()) adminLoginAttempts.delete(key);
  return false;
}

function registerAdminLoginFailure(key) {
  const current = adminLoginAttempts.get(key) || { count: 0, lockedUntil: 0 };
  const next = { count: current.count + 1, lockedUntil: current.lockedUntil || 0 };
  if (next.count >= 5) {
    next.lockedUntil = Date.now() + 15 * 60 * 1000;
  }
  adminLoginAttempts.set(key, next);
}

function clearAdminLoginFailures(key) {
  adminLoginAttempts.delete(key);
}

function buildAdminLoginPage() {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex,nofollow,noarchive" />
  <title>Acceso VEGA IMPORTADORA</title>
  <style>
    :root{--bg:#f5f7fb;--ink:#17202a;--muted:#687386;--brand:#0f766e;--line:#dde4ef;--danger:#b91c1c}
    *{box-sizing:border-box} body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);font-family:Arial,Helvetica,sans-serif;color:var(--ink);padding:22px}
    .login{width:min(420px,100%);background:#fff;border:1px solid var(--line);border-radius:8px;box-shadow:0 12px 32px rgba(22,32,42,.08);padding:26px}
    .brand{display:flex;align-items:center;gap:12px;margin-bottom:22px}.mark{width:44px;height:44px;border-radius:8px;background:var(--brand);color:white;display:grid;place-items:center;font-weight:800}
    h1{font-size:22px;margin:0}.brand span{display:block;color:var(--muted);font-size:13px;margin-top:4px}
    label{display:grid;gap:7px;color:var(--muted);font-size:13px;margin-bottom:14px} input{width:100%;border:1px solid var(--line);border-radius:8px;padding:12px;font:inherit;color:var(--ink)}
    button{width:100%;border:0;border-radius:8px;background:var(--brand);color:#fff;font-weight:800;padding:13px;cursor:pointer} button:disabled{opacity:.65;cursor:wait}
    .error{display:none;margin:0 0 14px;color:var(--danger);background:#fee2e2;border:1px solid #fecaca;border-radius:8px;padding:10px;font-size:13px}
    .hint{margin-top:16px;color:var(--muted);font-size:12px;line-height:1.4}
    .store-link{display:flex;min-height:48px;align-items:center;justify-content:center;gap:10px;margin-top:12px;border:1px solid var(--brand);border-radius:8px;background:#ecfdf5;color:var(--brand);font-weight:800;text-decoration:none;font-size:14px;transition:background .18s ease,box-shadow .18s ease,transform .18s ease}
    .store-link:hover{background:#d1fae5;box-shadow:0 6px 16px rgba(15,118,110,.14);transform:translateY(-1px)}
    .store-icon{font-size:20px;line-height:1}
  </style>
</head>
<body>
  <main class="login">
    <div class="brand"><div class="mark">VI</div><div><h1>VEGA IMPORTADORA</h1><span>Panel privado del bot comercial</span></div></div>
    <p class="error" id="error"></p>
    <form id="form">
      <label>Correo<input id="email" type="email" autocomplete="username" required autofocus /></label>
      <label>Contrasena<input id="password" type="password" autocomplete="current-password" required /></label>
      <button id="submit" type="submit">Ingresar</button>
    </form>
    <a class="store-link" href="/tienda/"><span class="store-icon" aria-hidden="true">&#127978;</span><span>Ir a la tienda</span></a>
    <p class="hint">Acceso solo para personal autorizado. Esta pagina no se indexa en buscadores.</p>
  </main>
  <script>
    const form = document.querySelector("#form");
    const errorBox = document.querySelector("#error");
    const submit = document.querySelector("#submit");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      errorBox.style.display = "none";
      submit.disabled = true;
      try {
        const response = await fetch("/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: document.querySelector("#email").value,
            password: document.querySelector("#password").value
          })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "No fue posible ingresar");
        window.location.href = "/admin";
      } catch (error) {
        errorBox.textContent = error.message || "No fue posible ingresar";
        errorBox.style.display = "block";
      } finally {
        submit.disabled = false;
      }
    });
  </script>
</body>
</html>`;
}

async function ensureStoreTables() {
  const db = await getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS store_users (
      id VARCHAR(80) PRIMARY KEY,
      full_name VARCHAR(180) NOT NULL,
      email VARCHAR(180) NOT NULL UNIQUE,
      google_id VARCHAR(255) UNIQUE,
      avatar_url TEXT,
      password_hash TEXT,
      phone VARCHAR(40),
      id_number VARCHAR(40),
      role VARCHAR(40) NOT NULL DEFAULT 'cliente',
      status TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS store_sales (
      id VARCHAR(80) PRIMARY KEY,
      user_id VARCHAR(80),
      customer_name VARCHAR(180),
      customer_email VARCHAR(180),
      total_amount INT NOT NULL DEFAULT 0,
      customer_phone VARCHAR(40) NOT NULL DEFAULT '',
      customer_id_number VARCHAR(40),
      delivery_address TEXT,
      delivery_country VARCHAR(100) DEFAULT 'Colombia',
      delivery_department VARCHAR(100),
      delivery_city VARCHAR(100),
      delivery_additional_info TEXT,
      payment_method VARCHAR(80),
      status VARCHAR(80) NOT NULL DEFAULT 'PENDIENTE',
      receipts_json LONGTEXT,
      wompi_transaction_id VARCHAR(120),
      wompi_reference VARCHAR(140),
      wompi_payment_link_id VARCHAR(140),
      idempotency_key VARCHAR(140),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_store_sales_user (user_id),
      INDEX idx_store_sales_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS store_sale_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sale_id VARCHAR(80) NOT NULL,
      product_id VARCHAR(120),
      product_name VARCHAR(255) NOT NULL,
      quantity INT NOT NULL,
      unit_price INT NOT NULL,
      subtotal INT NOT NULL,
      INDEX idx_store_sale_items_sale (sale_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS store_suppliers (
      id VARCHAR(80) PRIMARY KEY,
      name VARCHAR(180) NOT NULL,
      contact_name VARCHAR(180),
      address TEXT,
      city VARCHAR(100),
      phone VARCHAR(40),
      image_url TEXT,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_store_suppliers_name (name),
      INDEX idx_store_suppliers_city (city)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS store_product_media (
      id VARCHAR(80) PRIMARY KEY,
      product_id VARCHAR(120) NOT NULL,
      url TEXT NOT NULL,
      media_type VARCHAR(40) NOT NULL DEFAULT 'image',
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_store_product_media_product (product_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await ensureProductStoreDescriptionColumn();
  await ensureStoreDistributorColumns();
  await ensureStoreUserSaintClientColumn();
}

async function ensureStoreUserSaintClientColumn() {
  const db = await getPool();
  const [rows] = await db.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'store_users'
       AND COLUMN_NAME = 'saint_client_code'`
  );
  if (!rows.length) {
    await db.query("ALTER TABLE store_users ADD COLUMN saint_client_code VARCHAR(60) NULL AFTER id_number");
    await db.query("CREATE INDEX idx_store_users_saint_client_code ON store_users (saint_client_code)");
  }
}

async function ensureStoreDistributorColumns() {
  const db = await getPool();
  const [rows] = await db.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'store_suppliers'
       AND COLUMN_NAME IN ('image_url', 'is_active')`
  );
  const columns = new Set(rows.map((row) => String(row.COLUMN_NAME)));
  if (!columns.has("image_url")) {
    await db.query("ALTER TABLE store_suppliers ADD COLUMN image_url TEXT NULL AFTER phone");
  }
  if (!columns.has("is_active")) {
    await db.query("ALTER TABLE store_suppliers ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER image_url");
  }
}

async function ensureProductStoreDescriptionColumn() {
  const db = await getPool();
  const [rows] = await db.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'store_description'`
  );
  if (!rows.length) {
    await db.query("ALTER TABLE products ADD COLUMN store_description LONGTEXT NULL");
  }
}

async function readStoreProductMediaMap() {
  const db = await getPool();
  const [rows] = await db.query(
    "SELECT product_id AS productId, url FROM store_product_media ORDER BY product_id, sort_order, created_at"
  );
  return rows.reduce((acc, row) => {
    const productId = String(row.productId);
    if (!acc[productId]) acc[productId] = [];
    acc[productId].push(row.url);
    return acc;
  }, {});
}

async function readStoreProductImages(productId) {
  const media = await listStoreProductMedia(productId);
  return media.map((item) => item.url);
}

async function listStoreProductMedia(productId) {
  const db = await getPool();
  const [rows] = await db.query(
    `SELECT id, product_id AS productId, url, media_type AS type, sort_order AS sortOrder, created_at AS createdAt
     FROM store_product_media
     WHERE product_id = ?
     ORDER BY sort_order, created_at`,
    [String(productId)]
  );
  return rows;
}

async function setStoreProductImages(productId, images = []) {
  const db = await getPool();
  const cleanImages = [...new Set((Array.isArray(images) ? images : [])
    .map((url) => String(url || "").trim())
    .filter(Boolean))];
  await db.query("DELETE FROM store_product_media WHERE product_id = ?", [String(productId)]);
  let order = 0;
  for (const url of cleanImages) {
    await db.query(
      `INSERT INTO store_product_media (id, product_id, url, media_type, sort_order)
       VALUES (?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), String(productId), url, detectStoreFileType(url), order++]
    );
  }
  return cleanImages;
}

async function deleteStoreProductMedia(mediaId) {
  const db = await getPool();
  const [result] = await db.query("DELETE FROM store_product_media WHERE id = ?", [String(mediaId)]);
  return result.affectedRows > 0;
}

async function createStoreProduct(payload = {}) {
  const db = await getPool();
  const product = await normalizeStoreProductPayload(payload, crypto.randomUUID().slice(0, 12).toUpperCase());
  const productId = String(payload.sku || payload.id || product.id).trim().toUpperCase();
  const [existing] = await db.query("SELECT id FROM products WHERE id = ? LIMIT 1", [productId]);
  if (existing.length) {
    const error = new Error("Ya existe un producto con ese codigo");
    error.statusCode = 409;
    throw error;
  }
  await db.query(
    `INSERT INTO products
      (id, name, category, brand, stock, wholesale_price, retail_price, warranty, status, deposito, puesto, source,
       store_description, free_shipping, promotion_enabled, promotion_percent, store_enabled)
     VALUES (?, ?, ?, 'General', ?, ?, ?, '', ?, '', '', 'tienda', ?, ?, ?, ?, ?)`,
    [
      productId,
      product.name,
      product.categoryName,
      product.stock,
      product.price,
      product.price,
      product.status ? "Disponible" : "Agotado",
      product.description,
      product.freeShipping ? 1 : 0,
      product.promotionEnabled ? 1 : 0,
      product.promotionPercent,
      product.enabled ? 1 : 0
    ]
  );
  await setStoreProductImages(productId, product.images);
  await ensureStoreCategory(product.categoryName);
  await saveStoreProductSubcategoryAssignment(db, productId, product.categoryName, product.subcategoryId);
  const data = await readDb();
  const created = data.products.find((item) => item.id === productId);
  return mapStoreProduct({ ...created, images: await readStoreProductImages(productId) }, data.categories);
}

async function saveStoreProductNameOverride(db, productId, storeName) {
  const normalized = String(storeName || "").trim() || "SIN NOMBRE";
  await db.query(
    `INSERT INTO product_store_names (product_id, store_name)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE store_name = VALUES(store_name)`,
    [String(productId), normalized]
  );
  return normalized;
}

async function updateStoreProduct(productId, payload = {}) {
  const db = await getPool();
  const dataBeforeUpdate = await readDb();
  const inventoryProduct = dataBeforeUpdate.products.find(
    (item) => String(item.id).toUpperCase() === String(productId).toUpperCase()
  );
  const [rows] = await db.query("SELECT * FROM products WHERE id = ? LIMIT 1", [productId]);
  const currentImages = await readStoreProductImages(productId);
  const shouldUpdateImages = Array.isArray(payload.images);
  let fallback = rows[0];
  if (!fallback) {
    if (!inventoryProduct) return null;
    fallback = {
      id: inventoryProduct.id,
      name: inventoryProduct.name,
      category: inventoryProduct.category || inventoryProduct.category_name || "General",
      subcategoryId: inventoryProduct.subcategoryId || inventoryProduct.subcategory_id || "",
      brand: inventoryProduct.brand || "General",
      stock: inventoryProduct.stock || 0,
      wholesale_price: inventoryProduct.wholesalePrice || inventoryProduct.price || 0,
      retail_price: inventoryProduct.retailPrice || 0,
      price_3: inventoryProduct.price3 || 0,
      warranty: inventoryProduct.warranty || "",
      status: inventoryProduct.status || "Disponible",
      deposito: inventoryProduct.deposito || "",
      puesto: inventoryProduct.puesto || "",
      source: inventoryProduct.source || "saint:bodega",
      store_description: inventoryProduct.storeDescription || "",
      free_shipping: inventoryProduct.freeShipping ? 1 : 0,
      promotion_enabled: inventoryProduct.promotionEnabled ? 1 : 0,
      promotion_percent: inventoryProduct.promotionPercent || 0,
      store_enabled: inventoryProduct.storeEnabled === false ? 0 : 1
    };
  }

  const isSaintProduct = Boolean(inventoryProduct?.saintName)
    || String(inventoryProduct?.source || fallback.source || "")
      .toLowerCase()
      .startsWith("saint:");
  const commercialName = String(
    payload.name ?? inventoryProduct?.storeName ?? (isSaintProduct ? "SIN NOMBRE" : fallback.name)
  ).trim() || "SIN NOMBRE";
  const canonicalName = isSaintProduct
    ? String(inventoryProduct?.saintName || inventoryProduct?.name || fallback.name || productId).trim()
    : commercialName;
  const product = await normalizeStoreProductPayload(
    { ...payload, name: canonicalName },
    productId,
    { ...fallback, images: currentImages }
  );
  await saveStoreProductNameOverride(db, productId, commercialName);
  if (rows.length) {
    await db.query(
      `UPDATE products
       SET name = ?, category = ?, stock = ?, retail_price = ?, status = ?, store_description = ?,
         free_shipping = ?, promotion_enabled = ?, promotion_percent = ?, store_enabled = ?
       WHERE id = ?`,
      [
        product.name,
        product.categoryName,
        product.stock,
        product.price,
        product.status ? "Disponible" : "Agotado",
        product.description,
        product.freeShipping ? 1 : 0,
        product.promotionEnabled ? 1 : 0,
        product.promotionPercent,
        product.enabled ? 1 : 0,
        productId
      ]
    );
  } else {
    await db.query(
      `INSERT INTO products
        (id, name, category, brand, stock, wholesale_price, retail_price, price_3, warranty, status, deposito, puesto, source,
         store_description, free_shipping, promotion_enabled, promotion_percent, store_enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(productId),
        product.name,
        product.categoryName,
        fallback.brand || "General",
        product.stock,
        fallback.wholesale_price || product.price,
        product.price,
        fallback.price_3 || 0,
        fallback.warranty || "",
        product.status ? "Disponible" : "Agotado",
        fallback.deposito || "",
        fallback.puesto || "",
        fallback.source || "saint:bodega",
        product.description,
        product.freeShipping ? 1 : 0,
        product.promotionEnabled ? 1 : 0,
        product.promotionPercent,
        product.enabled ? 1 : 0
      ]
    );
  }
  if (shouldUpdateImages) await setStoreProductImages(productId, product.images);
  await ensureStoreCategory(product.categoryName);
  await saveStoreProductSubcategoryAssignment(db, productId, product.categoryName, product.subcategoryId);
  const data = await readDb();
  const updated = data.products.find((item) => item.id === productId);
  return mapStoreProduct({ ...updated, images: await readStoreProductImages(productId) }, data.categories);
}

async function deleteStoreProduct(productId) {
  const db = await getPool();
  await db.query("DELETE FROM store_product_media WHERE product_id = ?", [String(productId)]);
  await db.query("DELETE FROM product_store_names WHERE product_id = ?", [String(productId)]);
  await db.query("DELETE FROM product_subcategory_assignments WHERE product_id = ?", [String(productId)]);
  const [result] = await db.query("DELETE FROM products WHERE id = ?", [String(productId)]);
  return result.affectedRows > 0;
}

async function normalizeStoreProductPayload(payload = {}, fallbackId, fallback = {}) {
  const db = await getPool();
  const name = String(payload.name ?? fallback.name ?? "").trim();
  if (!name) {
    const error = new Error("El nombre del producto es obligatorio");
    error.statusCode = 400;
    throw error;
  }
  const categoryName = await resolveStoreCategoryName(payload.category_id ?? payload.categoryId ?? payload.category_name ?? fallback.category ?? "General");
  const subcategoryId = await resolveStoreSubcategoryId(
    categoryName,
    payload.subcategory_id ?? payload.subcategoryId ?? fallback.subcategoryId ?? fallback.subcategory_id ?? ""
  );
  const promotionPercent = cleanStorePercentage(payload.promotion_percent ?? payload.promotionPercent ?? fallback.promotion_percent ?? fallback.promotionPercent ?? 0);
  const promotionEnabled = cleanStoreBoolean(
    payload.promotion_enabled ?? payload.promotionEnabled,
    fallback.promotion_enabled ?? fallback.promotionEnabled
  ) && promotionPercent > 0;
  const stock = cleanStoreNumber(payload.stock ?? fallback.stock ?? 0);
  const enabled = cleanStoreBoolean(
    payload.enabled ?? payload.store_enabled ?? payload.storeEnabled,
    fallback.store_enabled ?? fallback.storeEnabled ?? true
  );
  return {
    id: fallbackId,
    name,
    categoryName,
    subcategoryId,
    price: cleanStoreNumber(payload.price_2 ?? payload.price ?? fallback.retail_price ?? fallback.retailPrice ?? fallback.wholesale_price ?? fallback.wholesalePrice ?? 0),
    stock,
    status: payload.status === undefined ? fallback.status !== "Agotado" : Boolean(payload.status),
    images: Array.isArray(payload.images)
      ? payload.images
      : Array.isArray(fallback.images)
        ? fallback.images
        : [],
    description: String(payload.description ?? fallback.store_description ?? "").trim(),
    freeShipping: cleanStoreBoolean(
      payload.free_shipping ?? payload.freeShipping,
      fallback.free_shipping ?? fallback.freeShipping
    ),
    promotionEnabled,
    promotionPercent: promotionEnabled ? promotionPercent : 0,
    enabled
  };
}

async function resolveStoreCategoryName(categoryValue) {
  const db = await getPool();
  const value = String(categoryValue || "").trim();
  if (!value) return "General";
  const [rows] = await db.query("SELECT name FROM categories WHERE id = ? OR name = ? LIMIT 1", [value, value]);
  return rows[0]?.name || value;
}

async function resolveStoreSubcategoryId(categoryName, subcategoryValue) {
  const db = await getPool();
  const value = String(subcategoryValue || "").trim();
  if (!value) return "";
  const [rows] = await db.query(
    `SELECT id
     FROM store_subcategories
     WHERE enabled = 1 AND category_name = ? AND (id = ? OR name = ?)
     LIMIT 1`,
    [String(categoryName || "General"), value, value]
  );
  if (rows.length) return String(rows[0].id);
  const error = new Error("La subcategoria no pertenece a la categoria seleccionada");
  error.statusCode = 400;
  throw error;
}

async function saveStoreProductSubcategoryAssignment(db, productId, categoryName, subcategoryId) {
  const resolvedSubcategoryId = await resolveStoreSubcategoryId(categoryName, subcategoryId);
  await db.query(
    `INSERT INTO product_subcategory_assignments
      (product_id, subcategory_id, assignment_source)
     VALUES (?, NULLIF(?, ''), 'manual')
     ON DUPLICATE KEY UPDATE
       subcategory_id = VALUES(subcategory_id),
       assignment_source = 'manual'`,
    [String(productId), resolvedSubcategoryId]
  );
}

async function ensureStoreCategory(categoryName) {
  const db = await getPool();
  const name = String(categoryName || "General").trim() || "General";
  await db.query("INSERT IGNORE INTO categories (id, name, margin, icon) VALUES (?, ?, 0, ?)", [
    slugStoreValue(name),
    name,
    getDefaultCategoryIcon(name)
  ]);
}

function cleanStoreCategoryName(value, fallback = "") {
  return String(value ?? fallback).trim().slice(0, 180);
}

function cleanStoreCategoryIcon(value, categoryName) {
  return String(value || "").trim().slice(0, 64) || getDefaultCategoryIcon(categoryName);
}

function cleanStoreSubcategoryName(value) {
  return String(value || "").trim().slice(0, 180);
}

function cleanStoreSubcategoryIcon(value) {
  return String(value || "").trim().slice(0, 64) || "📦";
}

function createStoreSubcategoryId(categoryName, subcategoryName) {
  const readable = `${slugStoreValue(categoryName)}--${slugStoreValue(subcategoryName)}`;
  if (readable.length <= 120) return readable;
  const hash = crypto.createHash("sha1")
    .update(`${categoryName}:${subcategoryName}`)
    .digest("hex")
    .slice(0, 10);
  return `${readable.slice(0, 109)}-${hash}`;
}

async function syncStoreSubcategories(connection, categoryName, subcategories) {
  if (!Array.isArray(subcategories)) return;
  const [existingRows] = await connection.query(
    "SELECT id FROM store_subcategories WHERE category_name = ?",
    [categoryName]
  );
  const existingIds = new Set(existingRows.map((row) => String(row.id)));
  const keptIds = new Set();
  const seenNames = new Set();

  for (let index = 0; index < subcategories.length; index += 1) {
    const input = subcategories[index] || {};
    const name = cleanStoreSubcategoryName(input.name);
    if (!name) continue;
    const nameKey = name.toLocaleLowerCase("es");
    if (seenNames.has(nameKey)) {
      const error = new Error(`La subcategoria ${name} esta repetida`);
      error.statusCode = 400;
      throw error;
    }
    seenNames.add(nameKey);
    const requestedId = String(input.id || "").trim();
    const id = requestedId && existingIds.has(requestedId)
      ? requestedId
      : createStoreSubcategoryId(categoryName, name);
    const icon = cleanStoreSubcategoryIcon(input.icon);
    await connection.query(
      `INSERT INTO store_subcategories
        (id, category_name, name, icon, sort_order, enabled, classification_source)
       VALUES (?, ?, ?, ?, ?, 1, 'manual')
       ON DUPLICATE KEY UPDATE
         category_name = VALUES(category_name),
         name = VALUES(name),
         icon = VALUES(icon),
         sort_order = VALUES(sort_order),
         enabled = 1,
         classification_source = 'manual'`,
      [id, categoryName, name, icon, index]
    );
    keptIds.add(id);
  }

  const removedIds = [...existingIds].filter((id) => !keptIds.has(id));
  if (removedIds.length) {
    const placeholders = removedIds.map(() => "?").join(",");
    await connection.query(
      `UPDATE store_subcategories
       SET enabled = 0, classification_source = 'manual'
       WHERE id IN (${placeholders})`,
      removedIds
    );
    await connection.query(
      `UPDATE product_subcategory_assignments
       SET subcategory_id = NULL, assignment_source = 'manual'
       WHERE subcategory_id IN (${placeholders})`,
      removedIds
    );
  }
}

async function createStoreCategory(payload) {
  const db = await getPool();
  const name = cleanStoreCategoryName(payload.name);
  if (!name) {
    const error = new Error("El nombre de la categoria es obligatorio");
    error.statusCode = 400;
    throw error;
  }
  const id = slugStoreValue(name);
  const icon = cleanStoreCategoryIcon(payload.icon, name);
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query("INSERT INTO categories (id, name, margin, icon) VALUES (?, ?, 0, ?)", [id, name, icon]);
    await syncStoreSubcategories(connection, name, payload.subcategories);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    if (error?.code === "ER_DUP_ENTRY") {
      error.statusCode = 409;
      error.message = "Ya existe una categoria con ese nombre";
    }
    throw error;
  } finally {
    connection.release();
  }
  const data = await readDb();
  return mapStoreCategory(
    { id, name, icon },
    data.subcategories || [],
    data.products || [],
    true
  );
}

async function updateStoreCategory(id, payload) {
  const db = await getPool();
  const [rows] = await db.query("SELECT id, name, icon FROM categories WHERE id = ? LIMIT 1", [id]);
  if (!rows.length) return null;
  const current = rows[0];
  const displayName = cleanStoreCategoryName(payload.name, current.name);
  if (!displayName) {
    const error = new Error("El nombre de la categoria es obligatorio");
    error.statusCode = 400;
    throw error;
  }
  const icon = cleanStoreCategoryIcon(payload.icon, displayName);
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query("UPDATE categories SET icon = ? WHERE id = ?", [icon, id]);
    await connection.query(
      `INSERT INTO store_category_names (category_id, display_name)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE display_name = VALUES(display_name)`,
      [current.id, displayName]
    );
    await syncStoreSubcategories(connection, current.name, payload.subcategories);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    if (error?.code === "ER_DUP_ENTRY") {
      error.statusCode = 409;
      error.message = "Ya existe una categoria con ese nombre";
    }
    throw error;
  } finally {
    connection.release();
  }
  const data = await readDb();
  const updatedCategory = data.categories.find((category) => String(category.id) === String(current.id))
    || { id: current.id, name: current.name, sourceName: current.name, displayName, icon };
  return mapStoreCategory(
    updatedCategory,
    data.subcategories || [],
    data.products || [],
    true
  );
}

async function deleteStoreCategory(id) {
  const db = await getPool();
  const [rows] = await db.query("SELECT id, name FROM categories WHERE id = ? LIMIT 1", [id]);
  if (!rows.length) return { found: false, inUse: false };
  const [[usage]] = await db.query("SELECT COUNT(*) AS total FROM products WHERE category = ?", [rows[0].name]);
  if (Number(usage.total || 0) > 0) return { found: true, inUse: true };
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [subcategoryRows] = await connection.query(
      "SELECT id FROM store_subcategories WHERE category_name = ?",
      [rows[0].name]
    );
    const subcategoryIds = subcategoryRows.map((subcategory) => String(subcategory.id));
    if (subcategoryIds.length) {
      const placeholders = subcategoryIds.map(() => "?").join(",");
      await connection.query(
        `DELETE FROM product_subcategory_assignments WHERE subcategory_id IN (${placeholders})`,
        subcategoryIds
      );
    }
    await connection.query("DELETE FROM store_subcategories WHERE category_name = ?", [rows[0].name]);
    await connection.query("DELETE FROM store_category_names WHERE category_id = ?", [id]);
    await connection.query("DELETE FROM categories WHERE id = ?", [id]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return { found: true, inUse: false };
}

function cleanStoreNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(Math.round(number), 0) : 0;
}

function cleanStoreBoolean(value, fallback = false) {
  const resolved = value === undefined || value === null || value === "" ? fallback : value;
  if (typeof resolved === "string") return ["1", "true", "si", "yes", "on"].includes(resolved.trim().toLowerCase());
  return resolved === true || Number(resolved) === 1;
}

function cleanStorePercentage(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(Math.max(Math.round(number * 100) / 100, 0), 99) : 0;
}

function slugStoreValue(value) {
  const slug = String(value || "general")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "general";
}

async function registerStoreUser(payload = {}) {
  const db = await getPool();
  const email = normalizeEmail(payload.email);
  const fullName = String(payload.full_name || payload.fullName || "").trim();
  const password = String(payload.password || "");
  const phone = String(payload.phone || "").trim();
  if (!fullName || !email || !password) {
    const error = new Error("Datos incompletos");
    error.statusCode = 400;
    throw error;
  }
  const [existing] = await db.query("SELECT id FROM store_users WHERE email = ? LIMIT 1", [email]);
  if (existing.length) {
    const error = new Error("Correo duplicado");
    error.code = "DUPLICATE_EMAIL";
    throw error;
  }
  const user = {
    id: crypto.randomUUID(),
    full_name: fullName,
    email,
    password_hash: await hashPassword(password),
    phone,
    role: "cliente",
    status: 1
  };
  await db.query(
    `INSERT INTO store_users (id, full_name, email, password_hash, phone, role, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [user.id, user.full_name, user.email, user.password_hash, user.phone, user.role, user.status]
  );
  return user;
}

async function createSaintStoreSession(settings = {}, payload = {}) {
  const saintClient = await findSaintCustomer(settings, payload.client_code);
  if (!saintClient) {
    const error = new Error("No encontramos ese cliente activo en SAINT");
    error.statusCode = 404;
    throw error;
  }

  const db = await getPool();
  const clientCode = String(saintClient.code || "").trim();
  const fullName = String(saintClient.full_name || "").trim();
  const idNumber = String(saintClient.id_number || "").trim();
  const phone = String(saintClient.phone || "").trim();
  const preferredEmail = normalizeEmail(payload.email || saintClient.email || "");
  const email = preferredEmail || `cliente-${slugStoreValue(clientCode)}@clientes.vega.local`;

  if (!clientCode || !fullName) {
    const error = new Error("El cliente de SAINT no tiene datos suficientes para crear el acceso");
    error.statusCode = 400;
    throw error;
  }

  const [clientRows] = await db.query("SELECT * FROM store_users WHERE saint_client_code = ? LIMIT 1", [clientCode]);
  let user = clientRows[0];

  if (user) {
    if (preferredEmail && preferredEmail !== user.email) {
      const [emailRows] = await db.query("SELECT id FROM store_users WHERE email = ? AND id <> ? LIMIT 1", [preferredEmail, user.id]);
      if (emailRows.length) {
        const error = new Error("Ese correo ya está vinculado a otra cuenta");
        error.statusCode = 409;
        throw error;
      }
    }
    await db.query(
      `UPDATE store_users
       SET full_name = ?, email = ?, phone = ?, id_number = ?, status = 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [fullName, preferredEmail || user.email || email, phone, idNumber, user.id]
    );
    const [updatedRows] = await db.query("SELECT * FROM store_users WHERE id = ? LIMIT 1", [user.id]);
    return updatedRows[0];
  }

  const [emailRows] = await db.query("SELECT * FROM store_users WHERE email = ? LIMIT 1", [email]);
  if (emailRows.length) {
    const existing = emailRows[0];
    if (existing.role !== "cliente") {
      const error = new Error("El correo está reservado para otra cuenta");
      error.statusCode = 409;
      throw error;
    }
    await db.query(
      `UPDATE store_users
       SET saint_client_code = ?, full_name = ?, phone = ?, id_number = ?, status = 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [clientCode, fullName, phone, idNumber, existing.id]
    );
    const [updatedRows] = await db.query("SELECT * FROM store_users WHERE id = ? LIMIT 1", [existing.id]);
    return updatedRows[0];
  }

  user = {
    id: crypto.randomUUID(),
    saint_client_code: clientCode,
    full_name: fullName,
    email,
    phone,
    id_number: idNumber,
    role: "cliente",
    status: 1
  };
  await db.query(
    `INSERT INTO store_users (id, saint_client_code, full_name, email, phone, id_number, role, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [user.id, user.saint_client_code, user.full_name, user.email, user.phone, user.id_number, user.role, user.status]
  );
  return user;
}

async function validateStoreLogin(emailValue, password) {
  const db = await getPool();
  const email = normalizeEmail(emailValue);
  const [rows] = await db.query("SELECT * FROM store_users WHERE email = ? LIMIT 1", [email]);
  const user = rows[0];
  if (!user?.password_hash) return null;
  const ok = await verifyPassword(String(password || ""), user.password_hash);
  return ok ? user : null;
}

async function upsertGoogleStoreUser(profile) {
  const db = await getPool();
  const email = normalizeEmail(profile.email);
  const [rows] = await db.query("SELECT * FROM store_users WHERE email = ? OR google_id = ? LIMIT 1", [email, profile.sub || ""]);
  if (rows.length) {
    const user = rows[0];
    await db.query(
      "UPDATE store_users SET google_id = COALESCE(google_id, ?), avatar_url = COALESCE(?, avatar_url), updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [profile.sub || null, profile.picture || null, user.id]
    );
    return { user: { ...user, google_id: user.google_id || profile.sub, avatar_url: user.avatar_url || profile.picture }, isNewUser: false };
  }
  const user = {
    id: crypto.randomUUID(),
    full_name: profile.name || email.split("@")[0],
    email,
    google_id: profile.sub || null,
    avatar_url: profile.picture || null,
    phone: "",
    role: "cliente",
    status: 1
  };
  await db.query(
    `INSERT INTO store_users (id, full_name, email, google_id, avatar_url, phone, role, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [user.id, user.full_name, user.email, user.google_id, user.avatar_url, user.phone, user.role, user.status]
  );
  return { user, isNewUser: true };
}

async function updateStoreUserProfile(userId, payload = {}) {
  const db = await getPool();
  await db.query(
    `UPDATE store_users
     SET full_name = COALESCE(NULLIF(?, ''), full_name),
       phone = COALESCE(NULLIF(?, ''), phone),
       id_number = COALESCE(NULLIF(?, ''), id_number)
     WHERE id = ?`,
    [String(payload.full_name || "").trim(), String(payload.phone || "").trim(), String(payload.id_number || "").trim(), userId]
  );
}

async function verifyGoogleCredential(token) {
  const credential = String(token || "").trim();
  if (!credential) return null;
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  if (!response.ok) return null;
  return response.json();
}

async function optionalStoreAuth(req, res, next) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return next();
  try {
    const payload = verifyStoreToken(token);
    if (!payload?.sub) return next();
    const db = await getPool();
    const [rows] = await db.query(
      "SELECT * FROM store_users WHERE id = ? AND status = 1 LIMIT 1",
      [payload.sub]
    );
    req.storeUser = rows[0] || null;
  } catch {
    req.storeUser = null;
  }
  next();
}

async function requireStoreAuth(req, res, next) {
  try {
    const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const payload = verifyStoreToken(token);
    if (!payload?.sub) return res.status(401).json({ error: "Sesion no valida" });
    const db = await getPool();
    const [rows] = await db.query("SELECT * FROM store_users WHERE id = ? LIMIT 1", [payload.sub]);
    if (!rows.length) return res.status(401).json({ error: "Usuario no encontrado" });
    req.storeUser = rows[0];
    next();
  } catch (error) {
    res.status(401).json({ error: "Sesion no valida" });
  }
}

function requireStoreAdmin(req, res, next) {
  if (req.storeUser?.role === "admin" || req.storeUser?.role === "super_admin") return next();
  return res.status(403).json({ error: "Permisos insuficientes" });
}

function requireStoreSuperAdmin(req, res, next) {
  if (req.storeUser?.role === "super_admin") return next();
  return res.status(403).json({ error: "Solo super admin puede realizar esta accion" });
}

async function listStoreUsers() {
  const db = await getPool();
  const [rows] = await db.query(
    `SELECT id, full_name, email, phone, id_number, avatar_url, role, status, created_at, updated_at
     FROM store_users ORDER BY created_at DESC`
  );
  return rows.map(toStoreUserResponse);
}

async function updateStoreUser(userId, payload = {}, actor = {}) {
  const db = await getPool();
  const [existingRows] = await db.query("SELECT * FROM store_users WHERE id = ? LIMIT 1", [userId]);
  const existing = existingRows[0];
  if (!existing) return null;
  if (actor.role !== "super_admin" && (existing.role === "admin" || existing.role === "super_admin")) {
    const error = new Error("No puedes modificar otros administradores");
    error.statusCode = 403;
    throw error;
  }

  const email = payload.email !== undefined ? normalizeEmail(payload.email) : existing.email;
  if (email && email !== existing.email) {
    const [duplicate] = await db.query("SELECT id FROM store_users WHERE email = ? AND id <> ? LIMIT 1", [email, userId]);
    if (duplicate.length) {
      const error = new Error("Correo duplicado");
      error.code = "DUPLICATE_EMAIL";
      throw error;
    }
  }

  const allowedRoles = actor.role === "super_admin" ? new Set(["cliente", "admin", "super_admin"]) : new Set(["cliente"]);
  const nextRole = payload.role && allowedRoles.has(payload.role) ? payload.role : existing.role;
  const nextPassword = String(payload.password || "").trim();
  const nextHash = nextPassword ? await hashPassword(nextPassword) : existing.password_hash;

  await db.query(
    `UPDATE store_users
     SET full_name = ?, email = ?, phone = ?, role = ?, status = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      String(payload.full_name ?? existing.full_name ?? "").trim(),
      email,
      String(payload.phone ?? existing.phone ?? "").trim(),
      nextRole,
      payload.status === undefined ? Number(Boolean(existing.status)) : Number(Boolean(payload.status)),
      nextHash,
      userId
    ]
  );
  const [rows] = await db.query("SELECT * FROM store_users WHERE id = ? LIMIT 1", [userId]);
  return rows[0];
}

async function createStoreAdminUser(payload = {}) {
  const db = await getPool();
  const fullName = String(payload.full_name || payload.fullName || "").trim();
  const email = normalizeEmail(payload.email);
  const password = String(payload.password || "");
  if (!fullName || !email || password.length < 6) {
    const error = new Error("Nombre, correo y contrasena de minimo 6 caracteres son obligatorios");
    error.statusCode = 400;
    throw error;
  }
  const [existing] = await db.query("SELECT id FROM store_users WHERE email = ? LIMIT 1", [email]);
  if (existing.length) {
    const error = new Error("Correo duplicado");
    error.code = "DUPLICATE_EMAIL";
    throw error;
  }
  const user = {
    id: crypto.randomUUID(),
    full_name: fullName,
    email,
    password_hash: await hashPassword(password),
    phone: String(payload.phone || "").trim(),
    role: payload.role === "super_admin" ? "super_admin" : "admin",
    status: 1
  };
  await db.query(
    `INSERT INTO store_users (id, full_name, email, password_hash, phone, role, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [user.id, user.full_name, user.email, user.password_hash, user.phone, user.role, user.status]
  );
  return user;
}

async function listStoreSuppliers({ onlyActive = false } = {}) {
  const db = await getPool();
  const [rows] = await db.query(
    `SELECT * FROM store_suppliers ${onlyActive ? "WHERE is_active = 1" : ""} ORDER BY city, name`
  );
  return rows.map(mapStoreSupplier);
}

async function createStoreSupplier(payload = {}) {
  const db = await getPool();
  const supplier = normalizeStoreSupplierPayload(payload, crypto.randomUUID());
  await db.query(
    `INSERT INTO store_suppliers (id, name, contact_name, address, city, phone, image_url, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [supplier.id, supplier.name, supplier.contact_name, supplier.address, supplier.city, supplier.phone, supplier.image_url, Number(supplier.is_active)]
  );
  const [rows] = await db.query("SELECT * FROM store_suppliers WHERE id = ? LIMIT 1", [supplier.id]);
  return mapStoreSupplier(rows[0]);
}

async function updateStoreSupplier(id, payload = {}) {
  const db = await getPool();
  const [existingRows] = await db.query("SELECT * FROM store_suppliers WHERE id = ? LIMIT 1", [id]);
  if (!existingRows.length) return null;
  const supplier = normalizeStoreSupplierPayload(payload, id, existingRows[0]);
  await db.query(
    `UPDATE store_suppliers
     SET name = ?, contact_name = ?, address = ?, city = ?, phone = ?, image_url = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [supplier.name, supplier.contact_name, supplier.address, supplier.city, supplier.phone, supplier.image_url, Number(supplier.is_active), id]
  );
  if (existingRows[0].image_url && existingRows[0].image_url !== supplier.image_url) {
    await deleteStoreUploadByUrl("distribuidores", existingRows[0].image_url);
  }
  const [rows] = await db.query("SELECT * FROM store_suppliers WHERE id = ? LIMIT 1", [id]);
  return mapStoreSupplier(rows[0]);
}

async function deleteStoreSupplier(id) {
  const db = await getPool();
  const [rows] = await db.query("SELECT image_url FROM store_suppliers WHERE id = ? LIMIT 1", [id]);
  const [result] = await db.query("DELETE FROM store_suppliers WHERE id = ?", [id]);
  if (result.affectedRows > 0 && rows[0]?.image_url) {
    await deleteStoreUploadByUrl("distribuidores", rows[0].image_url);
  }
  return result.affectedRows > 0;
}

function normalizeStoreSupplierPayload(payload = {}, id, fallback = {}) {
  const name = String(payload.name ?? fallback.name ?? "").trim();
  if (!name) {
    const error = new Error("El nombre del distribuidor es obligatorio");
    error.statusCode = 400;
    throw error;
  }
  return {
    id,
    name,
    contact_name: String(payload.contact_name ?? fallback.contact_name ?? "").trim(),
    address: String(payload.address ?? fallback.address ?? "").trim(),
    city: String(payload.city ?? fallback.city ?? "").trim(),
    phone: String(payload.phone ?? fallback.phone ?? "").trim(),
    image_url: String(payload.image_url ?? fallback.image_url ?? "").trim(),
    is_active: cleanStoreBoolean(payload.is_active, cleanStoreBoolean(fallback.is_active, true))
  };
}

function mapStoreSupplier(row = {}) {
  return {
    id: row.id,
    name: row.name,
    contact_name: row.contact_name || "",
    address: row.address || "",
    city: row.city || "",
    phone: row.phone || "",
    image_url: row.image_url || "",
    is_active: cleanStoreBoolean(row.is_active, true),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

async function listStoreUploads(bucket) {
  const dir = await getStoreUploadBucketDir(bucket);
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const filePath = path.join(dir, entry.name);
    const stat = await fs.stat(filePath);
    files.push(mapStoreUploadFile(bucket, entry.name, stat));
  }
  return files.sort((a, b) => Number(b.modified || 0) - Number(a.modified || 0));
}

async function saveStoreUpload(bucket, file) {
  if (!file?.buffer) {
    const error = new Error("Archivo no recibido");
    error.statusCode = 400;
    throw error;
  }
  const dir = await getStoreUploadBucketDir(bucket);
  const ext = path.extname(file.originalname || "") || extensionFromContentType(file.mimetype || "");
  const baseName = path.basename(file.originalname || "archivo", ext).replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "archivo";
  const filename = `${Date.now()}-${baseName}${ext || ".bin"}`.toLowerCase();
  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, file.buffer);
  const stat = await fs.stat(filePath);
  return mapStoreUploadFile(bucket, filename, stat);
}

async function deleteStoreUpload(bucket, filename) {
  const dir = await getStoreUploadBucketDir(bucket);
  const safeName = path.basename(String(filename || ""));
  if (!safeName) {
    const error = new Error("Archivo invalido");
    error.statusCode = 400;
    throw error;
  }
  const resolved = path.resolve(dir, safeName);
  if (!resolved.startsWith(path.resolve(dir) + path.sep)) {
    const error = new Error("Archivo invalido");
    error.statusCode = 400;
    throw error;
  }
  try {
    await fs.unlink(resolved);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function deleteStoreUploadByUrl(bucket, url) {
  const prefix = `/uploads/${bucket}/`;
  const value = String(url || "");
  if (!value.startsWith(prefix)) return false;
  const filename = decodeURIComponent(value.slice(prefix.length));
  return deleteStoreUpload(bucket, filename);
}

async function getStoreUploadBucketDir(bucket) {
  const normalized = String(bucket || "").toLowerCase();
  if (!["productos", "facturas", "videos", "distribuidores"].includes(normalized)) {
    const error = new Error("Carpeta de archivos no permitida");
    error.statusCode = 400;
    throw error;
  }
  const dir = path.join(storeUploadsDir, normalized);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

function mapStoreUploadFile(bucket, filename, stat = {}) {
  return {
    name: filename,
    url: `/uploads/${bucket}/${encodeURIComponent(filename)}`,
    type: detectStoreFileType(filename),
    size: stat.size || 0,
    modified: stat.mtimeMs || Date.now()
  };
}

function detectStoreFileType(filename = "") {
  const ext = path.extname(filename).toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"].includes(ext)) return "image";
  if ([".mp4", ".webm", ".mov", ".m4v", ".avi"].includes(ext)) return "video";
  if (ext === ".pdf") return "pdf";
  return "file";
}

function buildStoreAuthResponse(user) {
  return {
    token: signStoreToken(user),
    user: toStoreUserResponse(user)
  };
}

function toStoreUserResponse(user = {}) {
  return {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    role: user.role || "cliente",
    status: Boolean(user.status),
    phone: user.phone || "",
    id_number: user.id_number || "",
    avatar_url: user.avatar_url || "",
    created_at: user.created_at || new Date().toISOString(),
    updated_at: user.updated_at || new Date().toISOString()
  };
}

function normalizeStoreDeliveryText(payload = {}) {
  const parts = [
    payload.delivery_method,
    payload.payment_method,
    typeof payload.delivery_address === "string" ? payload.delivery_address : "",
    typeof payload.shipping_address === "string" ? payload.shipping_address : payload.shipping_address?.address_line_1 || ""
  ];
  return parts.filter(Boolean).join(" ").toLowerCase();
}

function calculateStoreShipping(subtotal, payload = {}, items = []) {
  const deliveryText = normalizeStoreDeliveryText(payload);
  const isPickup = deliveryText.includes("recoger") || deliveryText.includes("tienda");
  return calculatePolicyShipping(subtotal, items, !isPickup);
}

function normalizeStoreAddress(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    return [value.address_line_1, value.address_line_2, value.city, value.region, value.country]
      .filter(Boolean)
      .join(", ");
  }
  return String(value);
}

async function normalizeStoreSaleItems(rawItems = []) {
  if (!Array.isArray(rawItems) || !rawItems.length) {
    const error = new Error("El pedido no contiene productos");
    error.statusCode = 400;
    throw error;
  }

  const requested = new Map();
  for (const item of rawItems) {
    const productId = String(item.product_id || item.productId || item.sku || item.id || "").trim().toUpperCase();
    const quantity = Math.max(Math.round(Number(item.quantity ?? item.qty ?? 0) || 0), 0);
    if (!productId || quantity <= 0) continue;
    requested.set(productId, (requested.get(productId) || 0) + quantity);
  }
  if (!requested.size) {
    const error = new Error("El pedido no contiene cantidades validas");
    error.statusCode = 400;
    throw error;
  }

  const dbState = await readDb();
  const products = new Map(
    (dbState.products || []).map((product) => [String(product.id).trim().toUpperCase(), product])
  );
  const candidates = [...requested.entries()].map(([productId, quantity]) => {
    const product = products.get(productId);
    if (!product || product.status !== "Disponible" || !isStoreProductVisible(product)) {
      const error = new Error(`El producto ${productId} no esta disponible`);
      error.statusCode = 409;
      throw error;
    }
    const availableStock = Number(product.availableStock ?? product.stock ?? 0);
    if (availableStock < quantity) {
      const error = new Error(`Stock insuficiente para ${product.name}. Disponibles: ${availableStock}`);
      error.statusCode = 409;
      throw error;
    }
    const retailPrice = getRetailPrice(product);
    if (retailPrice <= 0) {
      const error = new Error(`El producto ${product.name} no tiene Precio 2 disponible`);
      error.statusCode = 409;
      throw error;
    }
    return {
      sku: String(product.id),
      product_id: String(product.id),
      product_name: product.name,
      qty: quantity,
      quantity,
      retailPrice,
      wholesalePrice: getWholesalePrice(product),
      freeShipping: Boolean(product.freeShipping ?? product.free_shipping)
    };
  });
  const pricing = priceBotCart(candidates, dbState.settings || {});
  return pricing.items.map((item) => ({
    product_id: item.product_id,
    product_name: item.product_name,
    quantity: item.qty,
    unit_price: item.unitPrice,
    subtotal: item.lineTotal,
    price_tier: item.priceTier,
    free_shipping: Boolean(item.freeShipping ?? item.free_shipping)
  }));
}

function normalizeStoreCheckoutPhone(value) {
  const phone = String(value || "").trim();
  if (!/^\d{10}$/.test(phone)) {
    const error = new Error("El telefono debe contener exactamente 10 digitos, sin letras ni espacios");
    error.statusCode = 400;
    throw error;
  }
  return phone;
}

async function createStoreSale(user, payload = {}, options = {}) {
  const db = await getPool();
  const items = await normalizeStoreSaleItems(payload.items);
  const subtotal = items.reduce((sum, item) => sum + Number(item.unit_price || 0) * Number(item.quantity || 0), 0);
  const shippingAmount = calculateStoreShipping(subtotal, payload, items);
  const wholesaleOrder = items.some((item) => item.price_tier === "mayorista");
  const deliveryText = normalizeStoreDeliveryText(payload);
  const pickupOrder = deliveryText.includes("recoger") || deliveryText.includes("tienda");
  const productFreeShipping = items.length > 0 && items.every((item) => item.free_shipping === true);
  const deliveryCostNote = pickupOrder
    ? "Recoger en tienda"
    : productFreeShipping
      ? "Envio incluido por beneficio de los productos"
      : "Flete por cotizar con la transportadora";
  const total = subtotal + shippingAmount;
  const customerPhone = normalizeStoreCheckoutPhone(
    payload.customer_phone || payload.customer_data?.phone_number || user.phone || ""
  );
  const sale = {
    id: crypto.randomUUID(),
    user_id: user.id,
    customer_name: payload.customer_name || payload.customer_data?.full_name || user.full_name,
    customer_email: payload.customer_email || user.email,
    total_amount: total,
    customer_phone: customerPhone,
    customer_id_number: payload.customer_id_number || payload.customer_data?.legal_id || user.id_number || "",
    delivery_address: normalizeStoreAddress(payload.delivery_address || payload.shipping_address),
    shipping_amount: shippingAmount,
    delivery_country: payload.delivery_country || "Colombia",
    delivery_department: payload.delivery_department || "",
    delivery_city: payload.delivery_city || "",
    delivery_additional_info: [
      payload.delivery_additional_info || "",
      deliveryCostNote,
      wholesaleOrder ? "Tarifa: mayorista P1" : "Tarifa: detal P2"
    ].filter(Boolean).join(" | "),
    payment_method: options.paymentMethod || payload.payment_method || "",
    status: options.status || "PENDIENTE",
    receipts: Array.isArray(payload.receipts) ? payload.receipts : [],
    wompi_reference: payload.reference || `ORDER-${Date.now()}`
  };
  await db.query(
    `INSERT INTO store_sales
      (id, user_id, customer_name, customer_email, total_amount, customer_phone, customer_id_number,
       delivery_address, delivery_country, delivery_department, delivery_city, delivery_additional_info,
       payment_method, status, receipts_json, wompi_reference)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sale.id,
      sale.user_id,
      sale.customer_name,
      sale.customer_email,
      sale.total_amount,
      sale.customer_phone,
      sale.customer_id_number,
      sale.delivery_address,
      sale.delivery_country,
      sale.delivery_department,
      sale.delivery_city,
      sale.delivery_additional_info,
      sale.payment_method,
      sale.status,
      JSON.stringify(sale.receipts),
      sale.wompi_reference
    ]
  );
  for (const item of items) {
    const qty = Number(item.quantity || 0);
    const price = Number(item.unit_price || 0);
    await db.query(
      `INSERT INTO store_sale_items (sale_id, product_id, product_name, quantity, unit_price, subtotal)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [sale.id, item.product_id || "", item.product_name || "Producto", qty, price, qty * price]
    );
  }
  const saintInvoice = await createSaintInvoiceForStoreSale(sale, items);
  return { ...sale, items, saintInvoice, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
}

async function createSaintInvoiceForStoreSale(sale, items) {
  try {
    const queued = await enqueueSaintInvoice({
      source: "tienda",
      orderId: sale.id,
      payload: { ...sale, items }
    }, { attemptNow: false });
    scheduleSaintInvoiceProcessing("tienda", sale.id);
    return queued;
  } catch (error) {
    console.error(`No se pudo encolar factura Saint para venta ${sale.id}:`, error.message);
    return { ok: false, queued: false, error: error.message };
  }
}

async function createSaintInvoiceForBotOrder(settings, order = {}) {
  try {
    const items = Array.isArray(order.items) ? order.items : [];
    const saleLikeOrder = {
      id: order.id,
      customer_name: order.customerName || "Cliente WhatsApp",
      customer_email: "",
      customer_phone: order.phone || "",
      customer_id_number: order.customerDocument || order.customerCompany || order.dispatch?.idNumber || "",
      delivery_address: order.deliveryAddress || order.dispatch?.address || "",
      delivery_city: order.customerCity || order.dispatch?.city || "",
      total_amount: Number(order.total || 0),
      shipping_amount: Number(order.freight || 0),
      payment_method: order.paymentStatus || order.notes || "",
      wompi_reference: `WHATSAPP-${order.id}`,
      items: items.map((item) => {
        const quantity = Number(item.qty || item.quantity || 1);
        const unitPrice = Number(item.price || item.unitPrice || 0);
        return {
          product_id: item.sku || item.productId || item.id || "",
          product_name: item.name || item.productName || "Producto",
          quantity,
          unit_price: unitPrice,
          subtotal: Number(item.lineTotal || quantity * unitPrice)
        };
      })
    };
    const queued = await enqueueSaintInvoice({
      source: "bot",
      orderId: order.id,
      payload: saleLikeOrder
    }, { attemptNow: false });
    scheduleSaintInvoiceProcessing("bot", order.id);
    return queued;
  } catch (error) {
    console.error(`No se pudo encolar factura Saint para pedido WhatsApp ${order.id}:`, error.message);
    return { ok: false, queued: false, error: error.message };
  }
}

function scheduleSaintInvoiceProcessing(source, orderId) {
  if (!isImmediateAttemptWindow()) return;
  setImmediate(() => {
    processSaintInvoiceQueue({ source, orderId, force: true }).catch((error) => {
      console.error(`No se pudo procesar en segundo plano la factura ${source} ${orderId}:`, error.message);
    });
  });
}

async function readStoreSalesForUser(userId) {
  const db = await getPool();
  const [rows] = await db.query("SELECT * FROM store_sales WHERE user_id = ? ORDER BY created_at DESC", [userId]);
  const sales = [];
  for (const row of rows) {
    const [items] = await db.query(
      `SELECT id, sale_id, product_id, product_name, quantity, unit_price, subtotal
       FROM store_sale_items WHERE sale_id = ? ORDER BY id`,
      [row.id]
    );
    sales.push(mapStoreSale(row, items));
  }
  return sales;
}

async function readStoreSales(filters = {}) {
  const db = await getPool();
  const where = [];
  const params = [];
  if (filters.status) {
    where.push("status = ?");
    params.push(String(filters.status));
  }
  if (filters.month && /^\d{4}-\d{2}$/.test(String(filters.month))) {
    where.push("DATE_FORMAT(created_at, '%Y-%m') = ?");
    params.push(String(filters.month));
  }
  if (filters.search) {
    where.push("(id LIKE ? OR customer_name LIKE ? OR customer_email LIKE ? OR customer_phone LIKE ? OR wompi_reference LIKE ?)");
    const term = `%${String(filters.search)}%`;
    params.push(term, term, term, term, term);
  }
  const limit = Math.max(1, Math.min(200, Number(filters.limit || 100)));
  const page = Math.max(1, Number(filters.page || 1));
  const offset = (page - 1) * limit;
  const sql = `SELECT * FROM store_sales ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  const [rows] = await db.query(sql, [...params, limit, offset]);
  const sales = [];
  for (const row of rows) {
    const [items] = await db.query(
      `SELECT id, sale_id, product_id, product_name, quantity, unit_price, subtotal
       FROM store_sale_items WHERE sale_id = ? ORDER BY id`,
      [row.id]
    );
    sales.push(mapStoreSale(row, items));
  }
  return { data: sales, page, limit };
}

async function readStoreSalesMonths() {
  const db = await getPool();
  const [rows] = await db.query(
    `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS count
     FROM store_sales
     GROUP BY DATE_FORMAT(created_at, '%Y-%m')
     ORDER BY month DESC`
  );
  return rows.map((row) => ({ month: row.month, count: Number(row.count || 0) }));
}

async function updateStoreSaleStatus(id, status) {
  const normalizedStatus = String(status || "").trim();
  if (!normalizedStatus) {
    const error = new Error("Estado invalido");
    error.statusCode = 400;
    throw error;
  }
  const db = await getPool();
  const [result] = await db.query("UPDATE store_sales SET status = ? WHERE id = ?", [normalizedStatus, id]);
  if (!result.affectedRows) return null;
  const [rows] = await db.query("SELECT * FROM store_sales WHERE id = ? LIMIT 1", [id]);
  const [items] = await db.query(
    `SELECT id, sale_id, product_id, product_name, quantity, unit_price, subtotal
     FROM store_sale_items WHERE sale_id = ? ORDER BY id`,
    [id]
  );
  return mapStoreSale(rows[0], items);
}

function mapStoreSale(row, items = []) {
  return {
    id: row.id,
    customer_id: row.user_id,
    customer_name: row.customer_name,
    customer_email: row.customer_email,
    total_amount: row.total_amount,
    customer_phone: row.customer_phone,
    customer_id_number: row.customer_id_number,
    delivery_address: row.delivery_address,
    delivery_country: row.delivery_country,
    delivery_department: row.delivery_department,
    delivery_city: row.delivery_city,
    delivery_additional_info: row.delivery_additional_info,
    payment_method: row.payment_method,
    status: row.status,
    whatsapp_sent_customer: false,
    whatsapp_sent_admin: false,
    receipts: safeJson(row.receipts_json, []),
    created_at: row.created_at,
    updated_at: row.updated_at,
    items
  };
}

async function createWompiPaymentLink(apiUrl, privateKey, payload, sale) {
  const amountInCents = Number(sale.total_amount * 100);
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const body = {
    name: `Pedido ${sale.wompi_reference || sale.id}`,
    description: `Compra VEGA IMPORTADORA - ${sale.customer_name || "Cliente"}`,
    single_use: true,
    collect_shipping: false,
    amount_in_cents: amountInCents,
    currency: payload.currency || "COP",
    redirect_url: payload.redirect_url || "",
    expires_at: expires
  };
  const response = await fetch(`${apiUrl.replace(/\/$/, "")}/payment_links`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${privateKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID()
    },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error("Error al crear payment link en Wompi");
    error.statusCode = 502;
    error.details = data;
    throw error;
  }
  const paymentLinkId = data?.data?.id || data?.id || "";
  return {
    sale_id: sale.id,
    payment_link_id: paymentLinkId,
    payment_url: paymentLinkId ? `https://checkout.wompi.co/l/${paymentLinkId}` : "",
    wompi: data
  };
}

async function updateStoreSaleWompi(saleId, payment = {}) {
  const db = await getPool();
  await db.query("UPDATE store_sales SET wompi_payment_link_id = ?, status = ? WHERE id = ?", [
    payment.payment_link_id || "",
    "PENDING",
    saleId
  ]);
}

async function readWompiSettings() {
  const db = await getPool();
  const [rows] = await db.query(
    "SELECT `key`, value FROM settings WHERE `key` IN ('wompiPublicKey', 'wompiPrivateKey', 'wompiEventsSecret', 'wompiIntegritySecret', 'wompiApiUrl')"
  );
  return rows.reduce((settings, row) => {
    settings[row.key] = safeJson(row.value, row.value);
    return settings;
  }, {});
}

function validateWompiConfiguration(settings, options = {}) {
  const publicKey = String(settings.wompiPublicKey || process.env.WOMPI_PUBLIC_KEY || "").trim();
  const privateKey = String(settings.wompiPrivateKey || process.env.WOMPI_PRIVATE_KEY || "").trim();
  const eventsSecret = String(settings.wompiEventsSecret || process.env.WOMPI_EVENTS_SECRET || "").trim();
  const apiUrl = String(settings.wompiApiUrl || process.env.WOMPI_API_URL || "").trim().replace(/\/$/, "");
  const production = publicKey.startsWith("pub_prod_") && privateKey.startsWith("prv_prod_");
  const sandbox = publicKey.startsWith("pub_test_") && privateKey.startsWith("prv_test_");
  const expectedApiUrl = production ? "https://production.wompi.co/v1" : "https://sandbox.wompi.co/v1";
  if ((!production && !sandbox) || apiUrl !== expectedApiUrl) {
    const error = new Error("Las llaves y la URL de Wompi no pertenecen al mismo ambiente");
    error.statusCode = 503;
    throw error;
  }
  if (options.requireEvents && !eventsSecret.startsWith(production ? "prod_events_" : "test_events_")) {
    const error = new Error("El secreto de eventos Wompi no corresponde al ambiente configurado");
    error.statusCode = 503;
    throw error;
  }
  return { publicKey, privateKey, eventsSecret, apiUrl, environment: production ? "prod" : "test" };
}

function readWompiSignedValue(data, propertyPath) {
  const value = String(propertyPath || "").split(".").reduce(
    (current, part) => current?.[part],
    data
  );
  return value === undefined || value === null ? "" : String(value);
}

function verifyWompiEventSignature(payload, headerChecksum, eventsSecret) {
  const properties = Array.isArray(payload.signature?.properties) ? payload.signature.properties : [];
  const provided = String(headerChecksum || payload.signature?.checksum || "").trim().toLowerCase();
  if (!properties.length || !/^[a-f0-9]{64}$/.test(provided) || payload.timestamp === undefined) return false;
  const signedText = properties
    .map((property) => readWompiSignedValue(payload.data, property))
    .join("") + String(payload.timestamp) + eventsSecret;
  const expected = crypto.createHash("sha256").update(signedText).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(expected, "hex"));
}

async function processWompiEvent(payload, headerChecksum) {
  const settings = await readWompiSettings();
  const config = validateWompiConfiguration(settings, { requireEvents: true });
  if (String(payload.environment || "") !== config.environment) {
    return { valid: false, matched: false, status: "" };
  }
  if (!verifyWompiEventSignature(payload, headerChecksum, config.eventsSecret)) {
    return { valid: false, matched: false, status: "" };
  }
  if (payload.event !== "transaction.updated" || !payload.data?.transaction) {
    return { valid: true, matched: false, status: "IGNORED" };
  }
  const result = await applyWompiTransactionToStoreSale(payload.data.transaction);
  return { valid: true, ...result };
}

async function applyWompiTransactionToStoreSale(transaction = {}) {
  const db = await getPool();
  const paymentLinkId = String(transaction.payment_link_id || "").trim();
  const reference = String(transaction.reference || "").trim();
  const where = [];
  const values = [];
  if (paymentLinkId) {
    where.push("wompi_payment_link_id = ?");
    values.push(paymentLinkId);
  }
  if (reference) {
    where.push("wompi_reference = ?");
    values.push(reference);
  }
  if (!where.length) return { matched: false, status: "" };
  const [rows] = await db.query(
    `SELECT id, total_amount, status, wompi_transaction_id FROM store_sales WHERE ${where.join(" OR ")} LIMIT 1`,
    values
  );
  if (!rows.length) return { matched: false, status: "" };
  const sale = rows[0];
  const transactionId = String(transaction.id || "").trim();
  const incomingStatus = String(transaction.status || "PENDING").trim().toUpperCase();
  const expectedAmount = Number(sale.total_amount || 0) * 100;
  const amountMatches = Number(transaction.amount_in_cents) === expectedAmount;
  const currencyMatches = String(transaction.currency || "").toUpperCase() === "COP";
  let status = amountMatches && currencyMatches ? incomingStatus : "WOMPI_VALIDACION_MANUAL";
  if (String(sale.status || "").toUpperCase() === "APPROVED" && status === "PENDING") {
    status = "APPROVED";
  }
  await db.query(
    "UPDATE store_sales SET wompi_transaction_id = ?, status = ? WHERE id = ?",
    [transactionId || sale.wompi_transaction_id || "", status, sale.id]
  );
  return { matched: true, status };
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = await new Promise((resolve, reject) => {
    crypto.scrypt(String(password), salt, 64, (error, key) => (error ? reject(error) : resolve(key.toString("hex"))));
  });
  return `scrypt:${salt}:${hash}`;
}

async function verifyPassword(password, storedHash) {
  const [scheme, salt, hash] = String(storedHash || "").split(":");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const candidate = await new Promise((resolve, reject) => {
    crypto.scrypt(String(password), salt, 64, (error, key) => (error ? reject(error) : resolve(key.toString("hex"))));
  });
  return crypto.timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(hash, "hex"));
}

function signStoreToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role || "cliente",
    iat: now,
    exp: now + 24 * 60 * 60
  };
  return signJwt(payload, getStoreJwtSecret());
}

function verifyStoreToken(token) {
  return verifyJwt(token, getStoreJwtSecret());
}

function signJwt(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const data = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
  const signature = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${signature}`;
}

function verifyJwt(token, secret) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return null;
  const data = `${parts[0]}.${parts[1]}`;
  const expected = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(parts[2]), Buffer.from(expected))) return null;
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function getStoreJwtSecret() {
  return process.env.STORE_JWT_SECRET || process.env.JWT_SECRET || "vega-importadora-store-local-secret";
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function safeJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}
