const {
  getRetailPrice,
  getWholesalePolicy,
  getWholesalePrice,
  priceBotCart
} = require("./pricingPolicy");
const {
  calculateShippingCost,
  hasProductFreeShipping
} = require("./shippingPolicy");

const STATES = {
  INICIO: "INICIO",
  MENU_PRINCIPAL: "MENU_PRINCIPAL",
  ESPERANDO_CATEGORIA: "ESPERANDO_CATEGORIA",
  ESPERANDO_NECESIDAD: "ESPERANDO_NECESIDAD",
  ESPERANDO_PRESUPUESTO: "ESPERANDO_PRESUPUESTO",
  ESPERANDO_PREFERENCIAS: "ESPERANDO_PREFERENCIAS",
  MOSTRANDO_PRODUCTOS: "MOSTRANDO_PRODUCTOS",
  VIENDO_PRODUCTO: "VIENDO_PRODUCTO",
  CARRITO: "CARRITO",
  ESPERANDO_TIPO_ENTREGA: "ESPERANDO_TIPO_ENTREGA",
  ESPERANDO_NOMBRE: "ESPERANDO_NOMBRE",
  ESPERANDO_DOCUMENTO: "ESPERANDO_DOCUMENTO",
  ESPERANDO_TELEFONO: "ESPERANDO_TELEFONO",
  ESPERANDO_CIUDAD: "ESPERANDO_CIUDAD",
  ESPERANDO_DIRECCION: "ESPERANDO_DIRECCION",
  ESPERANDO_METODO_PAGO: "ESPERANDO_METODO_PAGO",
  RESUMEN_PEDIDO: "RESUMEN_PEDIDO",
  PEDIDO_CONFIRMADO: "PEDIDO_CONFIRMADO",
  ESPERANDO_COMPROBANTE: "ESPERANDO_COMPROBANTE",
  PAGO_PENDIENTE_VERIFICACION: "PAGO_PENDIENTE_VERIFICACION",
  ESPERANDO_ACLARACION: "ESPERANDO_ACLARACION"
};

const STORE_CATALOG_URL = "https://vegaimportadoracolombia.com/tienda/";

const STOP_WORDS = new Set([
  "quiero", "necesito", "busco", "tiene", "tienen", "para", "con", "por", "favor",
  "me", "mi", "de", "del", "la", "el", "los", "las", "un", "una", "unas", "unos", "producto", "productos",
  "algo", "bueno", "buena", "cotizar", "comprar", "ver", "mostrar", "dame",
  "hola", "ola", "buenas", "buenos", "dias", "tardes", "noches", "saludo", "saludos",
  "cordial", "hey", "ey", "que", "tal", "estoy", "ando", "buscando", "como", "cual",
  "cuales", "manejan", "maneja", "venden", "vender", "venta", "vendemos", "tambien", "tambi",
  "saber", "gustaria", "gustar", "gusta", "manejas", "hay", "interesa", "interesado", "interesada",
  "perfecto", "listo", "vale", "esta", "estas", "este", "estos", "ese", "esa", "eso", "esos", "esas",
  "ningun", "ninguno", "ninguna", "ningunos", "ningunas", "otro", "otra", "otros", "otras",
  "opcion", "opciones", "referencia", "referencias", "igual", "solo", "solamente", "unicamente"
]);

const TYPO = new Map([
  ["bolas", "hola"], ["ola", "hola"], ["duenas", "buenas"], ["oches", "noches"], ["gunda", "funda"], ["gundas", "funda"],
  ["diademas", "diadema"], ["audifonos", "audifono"], ["parlantes", "parlante"],
  ["cabinas", "cabina"], ["consolas", "consola"], ["bocinas", "bocina"],
  ["cargadores", "cargador"], ["cables", "cable"], ["controles", "control"], ["soportes", "soporte"],
  ["ipone", "iphone"], ["iphon", "iphone"], ["ifon", "iphone"], ["samsun", "samsung"],
  ["cargadr", "cargador"], ["cargdor", "cargador"], ["cabesa", "cabeza"],
  ["parlate", "parlante"], ["blutut", "bluetooth"], ["vidro", "vidrio"],
  ["audifon", "audifono"], ["smarwatch", "smartwatch"], ["wach", "watch"],
  ["smar", "smart"], ["tele", "tv"]
]);

const TOKEN_SYNONYMS = {
  celular: ["telefono", "movil", "phone"],
  telefono: ["celular", "movil", "phone"],
  soporte: ["holder", "porta", "base", "soporte"],
  holder: ["soporte", "porta", "base", "holder"],
  porta: ["soporte", "holder", "base", "porta"],
  carro: ["auto", "vehiculo", "carro", "car"],
  auto: ["carro", "vehiculo", "auto", "car"],
  vehiculo: ["carro", "auto", "vehiculo", "car"],
  coche: ["carro", "auto", "vehiculo", "car"],
  celular: ["telefono", "movil", "smartphone"],
  telefono: ["celular", "movil", "smartphone"],
  smartphone: ["celular", "telefono", "movil"],
  mouse: ["raton"],
  raton: ["mouse"],
  inalambrico: ["wireless"],
  solar: ["panel"],
  magnetico: ["magnet", "iman", "magnetico"],
  iman: ["magnet", "magnetico"],
  cabeza: ["cargador", "adaptador", "cabeza"],
  cargador: ["cabeza", "adaptador", "charger", "cargador"],
  diadema: ["audifono", "audifonos", "auricular", "auriculares", "headset", "manoslibres"],
  audifono: ["diadema", "auricular", "headset", "manoslibres"],
  auricular: ["audifono", "diadema", "headset", "manoslibres"],
  headset: ["diadema", "audifono", "auricular", "manoslibres"],
  cabina: ["cabina"],
  consola: ["consola", "xbox", "playstation", "nintendo", "atari"],
  xbox: ["xbox", "consola"],
  playstation: ["playstation", "consola"],
  nintendo: ["nintendo", "consola"],
  atari: ["atari", "consola"],
  funda: ["forro", "estuche", "case", "protector", "carcasa"],
  fundas: ["funda", "forro", "estuche", "case", "protector", "carcasa"],
  forro: ["funda", "estuche", "case", "protector", "carcasa"],
  estuche: ["funda", "forro", "case", "protector", "carcasa"],
  case: ["funda", "forro", "estuche", "protector", "carcasa"],
  tv: ["televisor", "smart", "android", "tvbox"],
  televisor: ["tv", "smart", "android", "tvbox"],
  stick: ["tvbox", "android", "smart", "tv"],
  android: ["tvbox", "smart", "stick", "tv"],
  smart: ["tvbox", "android", "stick", "tv"]
};

const PRODUCT_ANCHOR_GROUPS = {
  cargador: ["cargador", "cabeza", "adaptador", "charger"],
  cabeza: ["cargador", "cabeza", "adaptador", "charger"],
  carga: ["cargador", "cabeza", "adaptador", "charger", "carga"],
  diadema: ["diadema", "audifono", "auricular", "headset", "manoslibres"],
  audifono: ["diadema", "audifono", "auricular", "headset", "manoslibres"],
  auricular: ["diadema", "audifono", "auricular", "headset", "manoslibres"],
  parlante: ["parlante", "speaker", "bocina"],
  bocina: ["parlante", "speaker", "bocina"],
  cabina: ["cabina"],
  consola: ["consola", "xbox", "playstation", "nintendo", "atari"],
  xbox: ["xbox", "consola"],
  playstation: ["playstation", "consola"],
  nintendo: ["nintendo", "consola"],
  atari: ["atari", "consola"],
  radio: ["radio"],
  mouse: ["mouse", "raton"],
  raton: ["mouse", "raton"],
  cable: ["cable"],
  funda: ["funda", "forro", "estuche", "case", "carcasa", "protector"],
  forro: ["funda", "forro", "estuche", "case", "carcasa", "protector"],
  estuche: ["funda", "forro", "estuche", "case", "carcasa", "protector"],
  case: ["funda", "forro", "estuche", "case", "carcasa", "protector"],
  soporte: ["soporte", "holder", "porta", "base"],
  holder: ["soporte", "holder", "porta", "base"],
  porta: ["soporte", "holder", "porta", "base"],
  control: ["control"],
  tvbox: ["tvbox", "tv box", "stick", "android"],
  tv: ["tv", "televisor", "tvbox", "stick", "android"],
  smartwatch: ["smartwatch", "watch", "reloj"],
  watch: ["smartwatch", "watch", "reloj"],
  vidrio: ["vidrio", "ceramico", "protector", "mica"],
  lampara: ["lampara", "bombillo", "led", "luz", "reflector"],
  bombillo: ["lampara", "bombillo", "led", "luz", "reflector"]
};

const SOFT_PRODUCT_TOKENS = new Set([
  "tipo", "calidad", "economico", "economica", "barato", "barata", "rapido", "rapida",
  "original", "generico", "generica", "bueno", "buena", "bonito", "bonita", "grande", "pequeno",
  "pequena", "compatible", "compatibilidad", "normal", "basico", "basica", "nuevo", "nueva"
]);

const KNOWN_BRAND_TOKENS = new Set([
  "iphone", "apple", "samsung", "xiaomi", "redmi", "huawei", "honor", "oppo", "vivo", "tecno",
  "infinix", "motorola", "nokia", "jbl", "sony", "lg", "panasonic", "fox", "lenovo", "hp", "asus"
]);

const SPECIFIC_REQUIREMENT_TOKENS = new Set([
  "solar", "bluetooth", "inalambrico", "wireless", "magnetico", "iman", "gaming", "gamer", "rgb",
  "rapida", "rapido", "metalico", "metalica", "plegable"
]);

function money(value) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s./#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(value) {
  return String(value || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function deliveryCityFromText(text) {
  const n = normalizeText(text);
  const match = n.match(/\b(?:vivo|resido|estoy|me encuentro)\s+en\s+([a-z][a-z\s-]{2,60})$/)
    || n.match(/\b(?:enviar|envien|envialo|enviarlo|mandar|manden|mandalo|despachar|despachen)\S*\s+(?:a|para)\s+([a-z][a-z\s-]{2,60})$/);
  if (!match) return "";

  const city = match[1]
    .replace(/\b(?:por favor|gracias|a mi casa|mi casa|mi domicilio|mi direccion)\b.*$/g, "")
    .trim();
  if (!city || /^(mi casa|casa|domicilio|direccion|el local|la tienda)$/.test(city)) return "";
  return titleCase(city);
}

function parseDeliveryChoice(text) {
  const n = normalizeText(text);
  const numberedChoice = n.match(/^(?:opcion\s*)?([123])(?:\b|$)/)?.[1] || "";
  const pickup = numberedChoice === "1"
    || /\b(?:recoger|recogerlo|recogerla|recojo|lo recojo|la recojo|paso por|voy por|retirar|retiro)\b/.test(n)
    || /\b(?:en el local|en la tienda|personalmente)\b/.test(n);
  if (pickup) return { type: "Recoger en el local", city: "" };

  const mentionsPitalito = /\bpitalito\b/.test(n);
  const homeDelivery = /\b(?:domicilio|a mi casa|hasta mi casa|en mi casa|mi residencia|mi direccion|a la casa)\b/.test(n);
  const shipping = numberedChoice === "3"
    || /\b(?:envio|enviar|enviamelo|enviemelo|envienmelo|mandamelo|mandemelo|mandenlo|despacho|despachar|despachalo|transportadora|correo|otra ciudad|fuera de pitalito)\b/.test(n)
    || /\b(?:vivo|resido|estoy|me encuentro)\s+en\b/.test(n);

  if (numberedChoice === "2" || (mentionsPitalito && (homeDelivery || shipping))) {
    return { type: "Domicilio en Pitalito", city: "Pitalito" };
  }
  if (shipping || homeDelivery) {
    return { type: "Envio nacional", city: deliveryCityFromText(text) };
  }
  return null;
}

function phoneOf(from) {
  const raw = String(from || "").replace("whatsapp:", "").replace(/\s+/g, "").trim();
  return raw.startsWith("+") ? raw : `+${raw.replace(/\D/g, "")}`;
}

function samePhone(a, b) {
  return phoneOf(a) === phoneOf(b);
}

function currentCustomer(db, from) {
  const phone = phoneOf(from);
  return (db.customers || []).find((item) => samePhone(item.phone, phone)) || {
    id: `wa-${phone.replace(/\D/g, "")}`,
    name: "Cliente WhatsApp",
    phone,
    botMemory: {}
  };
}

function memoryOf(db, from) {
  return currentCustomer(db, from).botMemory || {};
}

function cartItems(db) {
  return db.cart?.items || [];
}

function cartTotal(items = []) {
  return items.reduce((sum, item) => sum + Number(item.lineTotal || Number(item.qty || 1) * Number(item.price || 0)), 0);
}

function checkoutTotals(items = []) {
  const subtotal = cartTotal(items);
  const freight = calculateShippingCost(subtotal, items);
  return { subtotal, freight, total: subtotal + freight };
}

function isTransferPayment(payment) {
  return /transferencia|consignacion|nequi|banco|pse|enlace/i.test(String(payment || ""));
}

function isPickupDelivery(delivery) {
  return /recoger|local|tienda/i.test(String(delivery || ""));
}

function itemLine(item) {
  const tier = item.priceTier === "mayorista" ? "Mayorista P1" : "Detal P2";
  return `- ${item.qty || 1} x ${item.sku || item.id}: ${item.name} | ${tier} ${money(item.price || 0)} c/u | ${money(item.lineTotal || Number(item.qty || 1) * Number(item.price || 0))}`;
}

function formatCart(items = []) {
  if (!items.length) return "Tu carrito esta vacio.";
  return `${items.map(itemLine).join("\n")}\n\nTotal parcial: ${money(cartTotal(items))}`;
}

function productPrice(product) {
  return getRetailPrice(product);
}

function wholesaleRequirementText(source = {}) {
  const policy = getWholesalePolicy(source);
  return `${policy.minimumReferences} referencias distintas con minimo ${policy.minimumUnits} unidades cada una, al menos ${policy.minimumTotalUnits} unidades en total y un pedido superior a ${money(policy.minimumAmount)}`;
}

function productStock(product) {
  const available = product?.availableStock;
  return Math.max(Number(available === undefined || available === null ? product?.stock || 0 : available), 0);
}

function productLine(product, position = 0) {
  const prefix = position ? `${position}. ` : "";
  const retail = getRetailPrice(product);
  const wholesale = getWholesalePrice(product);
  const available = productStock(product);
  const stock = available > 0 ? `${available} disponibles` : "Sin stock";
  const prices = [
    retail > 0 ? `Detal P2: ${money(retail)}` : "Detal: por validar",
    wholesale > 0 ? `Mayor P1: ${money(wholesale)}` : ""
  ].filter(Boolean).join(" | ");
  return `${prefix}${product.name}\nCodigo: ${product.id} | ${prices} | ${stock}`;
}

function productDetail(product) {
  const retail = getRetailPrice(product);
  const wholesale = getWholesalePrice(product);
  const policy = getWholesalePolicy(product);
  return `${product.name}\nCodigo: ${product.id}\nPrecio detal (P2): ${retail > 0 ? money(retail) : "por validar"}${wholesale > 0 ? `\nPrecio mayorista (P1): ${money(wholesale)}` : ""}\nDisponibles: ${productStock(product)}\n\nEl precio mayorista aplica cuando el carrito cumple: ${wholesaleRequirementText(policy)}.\n\n${productExplanation(product)}\n\nSi te sirve, te lo agrego al carrito.`;
}

function productUseSummary(product) {
  const botFeatures = String(product.botFeatures || "").trim();
  if (botFeatures) return `Uso: ${firstMeaningfulLine(botFeatures)}`;
  const text = normalizeText(`${product.id} ${product.name} ${product.category} ${product.brand}`);
  if (/holder|soporte|porta|base/.test(text) && /carro|auto|vehiculo/.test(text)) return "Uso: soporte para llevar el celular fijo en el carro.";
  if (/holder|soporte|porta|base/.test(text) && /celular|telefono|movil/.test(text)) return "Uso: soporte para ubicar o sostener el celular.";
  if (/cargador|cabeza|charger|adaptador/.test(text)) return "Uso: carga de equipos compatibles; revisa potencia y tipo de entrada.";
  if (/cable/.test(text)) return "Uso: cable para carga o conexion segun el tipo indicado.";
  if (/parlante|speaker|audio|bluetooth/.test(text)) return "Uso: reproduccion de audio; ideal si buscas sonido portatil.";
  if (/control/.test(text)) return "Uso: control remoto compatible con la referencia indicada.";
  if (/vidrio|ceramico|protector/.test(text)) return "Uso: proteccion de pantalla para el modelo indicado.";
  if (/camara/.test(text)) return "Uso: camara de seguridad o monitoreo segun la referencia.";
  if (/watch|reloj|smartwatch/.test(text)) return "Uso: reloj inteligente o accesorio wearable.";
  return "Uso: producto de tecnologia/accesorio; puedo validarte compatibilidad con mas datos.";
}

function productExplanation(product) {
  const botFeatures = String(product.botFeatures || "").trim();
  if (botFeatures) {
    return conciseBotFeatures(botFeatures);
  }
  const text = normalizeText(`${product.id} ${product.name} ${product.category} ${product.brand}`);
  const parts = [productUseSummary(product)];

  if (/holder|soporte|porta|base/.test(text) && /carro|auto|vehiculo/.test(text)) {
    parts.push("Sirve para sujetar el celular en el carro, por ejemplo para mapas o llamadas manos libres.");
  } else if (/cargador|cabeza|charger|adaptador/.test(text)) {
    const watts = String(product.name || "").match(/\b\d{2,3}\s*w\b/i)?.[0] || "";
    parts.push(`Sirve para cargar equipos compatibles${watts ? ` con potencia ${watts.toUpperCase()}` : ""}.`);
    parts.push("Antes de confirmar, validamos entrada y compatibilidad con tu equipo.");
  } else if (/cable/.test(text)) {
    parts.push("Sirve para carga o transferencia segun el conector de la referencia.");
    parts.push("Dime si lo necesitas tipo C, iPhone/Lightning, micro USB o carga rapida.");
  } else if (/parlante|speaker|audio|bluetooth/.test(text)) {
    parts.push("Sirve para reproducir musica o audio. Si es bluetooth, se empareja con celular u otro equipo compatible.");
    parts.push("Si quieres, validamos bateria, potencia o conexion exacta.");
  } else if (/control/.test(text)) {
    parts.push("Sirve como control remoto para el equipo compatible con esa referencia.");
    parts.push("Para evitar error, confirmemos marca/modelo del equipo.");
  } else if (/vidrio|ceramico|protector/.test(text)) {
    parts.push("Sirve para proteger la pantalla del equipo indicado en la referencia.");
    parts.push("La compatibilidad depende del modelo exacto del celular.");
  } else if (/camara/.test(text)) {
    parts.push("Sirve para monitoreo o seguridad. Validamos WiFi, 4G, lentes o alimentacion si lo necesitas.");
  } else {
    parts.push("Puedo confirmarte codigo, precio y stock. Si necesitas compatibilidad o medidas, lo validamos.");
  }

  return parts.slice(0, 2).join("\n");
}

function conciseBotFeatures(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
  const preferred = [];
  const usage = lines.find((line) => /^para que sirve:/i.test(line));
  const what = lines.find((line) => /^que es:/i.test(line));
  const how = lines.find((line) => /^como funciona:/i.test(line));
  if (what) preferred.push(cleanFeatureLine(what));
  if (usage) preferred.push(cleanFeatureLine(usage));
  else if (how) preferred.push(cleanFeatureLine(how));
  const source = preferred.length ? preferred : lines.map(cleanFeatureLine);
  return source.slice(0, 2).join("\n").slice(0, 420);
}

function cleanFeatureLine(line) {
  return String(line || "")
    .replace(/^que es:\s*/i, "")
    .replace(/^para que sirve:\s*/i, "")
    .replace(/^como funciona:\s*/i, "")
    .replace(/^validar:\s*/i, "Validar: ")
    .trim();
}

function firstMeaningfulLine(text) {
  const line = String(text || "")
    .split(/\r?\n/)
    .map((item) => item.replace(/^[-*]\s*/, "").trim())
    .find(Boolean);
  return line ? line.slice(0, 160) : "producto con ficha comercial disponible.";
}

function isProductInfoQuestion(text) {
  return /como funciona|como sirve|para que sirve|que hace|caracteristicas|caracteristica|especificaciones|medidas|material|compatible|compatibilidad|me explicas|explicame|expliqueme|cuentame|cuenteme|detalle|detalles|sirve para|funciona para/.test(normalizeText(text));
}

function isImageRequest(text) {
  return /\b(foto|fotos|imagen|imagenes|img|verlo|verla|ver producto|ver referencia|referencia visual|link|enlace|tienda|muestrame.*producto|mostrar.*producto|muestrame.*referencia|mostrar.*referencia)\b/.test(normalizeText(text));
}

function productStoreUrl(db, product) {
  const base = String(db.settings?.publicBaseUrl || "https://vegaimportadoracolombia.com").replace(/\/$/, "");
  return `${base}/tienda/product/${encodeURIComponent(String(product.id || ""))}`;
}

function productImageLinkReply(db, product) {
  return `Puedes ver las imagenes y la referencia de ${product.name} (${product.id}) aqui:\n${productStoreUrl(db, product)}\n\nRevisalo en la tienda y regresa para confirmarme si deseas agregarlo al carrito.`;
}

function setConversation(db, from, next = {}) {
  const previous = next.resetPurchaseContext ? {} : memoryOf(db, from);
  const memory = {
    telefono: phoneOf(from).replace(/\D/g, ""),
    estado: next.estado || previous.estado || STATES.INICIO,
    salesFlowStage: next.estado || previous.salesFlowStage || STATES.INICIO,
    intencion_actual: next.intencion_actual ?? previous.intencion_actual ?? null,
    categoria: next.categoria ?? previous.categoria ?? null,
    tipo_producto: next.tipo_producto ?? previous.tipo_producto ?? null,
    marca: next.marca ?? previous.marca ?? null,
    modelo: next.modelo ?? previous.modelo ?? null,
    uso_principal: next.uso_principal ?? previous.uso_principal ?? null,
    presupuesto_minimo: next.presupuesto_minimo ?? previous.presupuesto_minimo ?? null,
    presupuesto_maximo: next.presupuesto_maximo ?? previous.presupuesto_maximo ?? null,
    orden: next.orden ?? previous.orden ?? "",
    preferencias: next.preferencias ?? previous.preferencias ?? [],
    productos_mostrados: next.productos_mostrados ?? previous.productos_mostrados ?? [],
    producto_actual: next.producto_actual ?? previous.producto_actual ?? null,
    resultOffset: next.resultOffset ?? previous.resultOffset ?? 0,
    nombre_cliente: next.nombre_cliente ?? previous.nombre_cliente ?? null,
    documento_cliente: next.documento_cliente ?? previous.documento_cliente ?? null,
    telefono_contacto: next.telefono_contacto ?? previous.telefono_contacto ?? null,
    ciudad: next.ciudad ?? previous.ciudad ?? null,
    direccion: next.direccion ?? previous.direccion ?? null,
    tipo_entrega: next.tipo_entrega ?? previous.tipo_entrega ?? null,
    metodo_pago: next.metodo_pago ?? previous.metodo_pago ?? null,
    datos_despacho_completos: next.datos_despacho_completos ?? previous.datos_despacho_completos ?? false,
    ultimo_mensaje_bot: next.ultimo_mensaje_bot ?? previous.ultimo_mensaje_bot ?? "",
    campo_esperado: next.campo_esperado ?? previous.campo_esperado ?? null,
    intentos_fallidos: next.intentos_fallidos ?? 0,
    modo_asesor: next.modo_asesor ?? previous.modo_asesor ?? false,
    activeOrderId: next.activeOrderId ?? previous.activeOrderId ?? "",
    updatedAt: new Date().toLocaleString("es-CO", { hour12: false })
  };

  db.memoryPatch = {
    botStage: memory.estado,
    activeOrderId: memory.activeOrderId || "",
    lastIntent: memory.intencion_actual || memory.estado,
    lastBotAnswer: String(memory.ultimo_mensaje_bot || "").slice(0, 500),
    memory
  };
  return memory;
}

function reply(db, from, text, patch = {}) {
  setConversation(db, from, { ...patch, ultimo_mensaje_bot: text });
  return text;
}

function resetConversation(db, from) {
  const text = mainMenu(db);
  return reply(db, from, text, {
    resetPurchaseContext: true,
    estado: STATES.MENU_PRINCIPAL,
    activeOrderId: "",
    modo_asesor: false,
    campo_esperado: "producto_o_necesidad",
    productos_mostrados: [],
    producto_actual: null,
    intentos_fallidos: 0
  });
}

function mainMenu(db) {
  return `Hola, bienvenido a ${db.settings?.businessName || "VEGA IMPORTADORA"}.\n\nEste es nuestro catálogo virtual:\n${STORE_CATALOG_URL}\n\nCuéntame qué producto estás buscando y te ayudo a encontrar la mejor opción. Puedes escribirlo como lo tengas en mente.`;
}

function categoryList(db) {
  return (db.categories || [])
    .map((item) => item.name)
    .filter(Boolean)
    .slice(0, 14);
}

function allCategoryList(db) {
  return (db.categories || [])
    .map((item) => item.name)
    .filter(Boolean);
}

function categoryMenu(db) {
  const categories = categoryList(db);
  if (!categories.length) return "1. Productos disponibles";
  return categories.map((name, index) => `${index + 1}. ${name}`).join("\n");
}

function findCategory(db, text) {
  const categories = allCategoryList(db);
  const n = normalizeText(text);
  const num = Number(n.match(/\b\d{1,2}\b/)?.[0] || 0);
  if (num >= 1 && num <= categories.length) return categories[num - 1];

  const aliases = [
    [/celular|telefono|iphone|samsung|xiaomi|redmi|pantalla|vidrio|repuesto|funda|fundas|forro|estuche|case|carcasa/, "Celulares y repuestos"],
    [/cargador|cabeza|carga|power|adaptador|tipo c|usb/, "Cargadores y energia"],
    [/soporte|holder|porta celular|porta telefono|base celular|base telefono|carro|auto|vehiculo|coche/, "Accesorios"],
    [/audifono|parlante|audio|microfono|diadema|jbl|tws/, "Audio"],
    [/cable|hdmi|aux|conector|hub|otg/, "Cables y conectividad"],
    [/tv|control|antena|tdt|base para tv|tvbox|tv box|tv stick|stick|smart tv|android tv|convertir tv|volver.*tv|tv vieja|chromecast|roku/, "Controles y TV"],
    [/reloj|watch|smartwatch|manilla|banda/, "Smartwatch y wearables"],
    [/bombillo|lampara|led|luz|reflector/, "Iluminacion"],
    [/radio|fox|fm/, "Radios"]
  ];
  for (const [regex, target] of aliases) {
    if (regex.test(n)) {
      const targetText = normalizeText(target);
      const found = categories.find((category) => {
        const categoryText = normalizeText(category);
        return categoryText === targetText || categoryText.includes(targetText) || targetText.includes(categoryText);
      });
      if (found) return found;
    }
  }
  return categories.find((name) => {
    const category = normalizeText(name);
    return category.includes(n) || n.includes(category);
  }) || "";
}

function baseQueryTokens(text) {
  return normalizeText(text)
    .split(" ")
    .map((word) => TYPO.get(word) || singularizeToken(word))
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

function queryTokens(text) {
  const baseTokens = baseQueryTokens(text);
  const expanded = [];
  for (const token of baseTokens) {
    expanded.push(token);
    if (TOKEN_SYNONYMS[token]) expanded.push(...TOKEN_SYNONYMS[token]);
  }
  return [...new Set(expanded)];
}


function cleanProductQueryLabel(text) {
  const tokens = baseQueryTokens(text).filter((token) => !["puedes", "puede", "mostrar", "muestrame", "muestreme", "disponible", "disponibles", "momento", "ahora"].includes(token));
  return tokens.slice(0, 5).join(" ") || String(text || "").trim();
}

function singularizeToken(word) {
  const value = String(word || "");
  if (TYPO.has(value)) return TYPO.get(value);
  if (value.endsWith("es") && value.length > 5) return value.slice(0, -2);
  if (value.endsWith("s") && value.length > 4) return value.slice(0, -1);
  return value;
}

function parseBudget(text) {
  const n = normalizeText(text);
  if (/no tengo|no se|precio no importa|sin presupuesto|cualquiera/.test(n)) return { any: true };
  if (/economico|barato|menor precio|mas barato/.test(n)) return { orden: "precio_ascendente" };

  const numericValues = [];
  const digitMatches = n.match(/\d[\d.,]*/g) || [];
  for (const raw of digitMatches) {
    const clean = raw.replace(/[.,]/g, "");
    const value = Number(clean);
    if (!Number.isFinite(value) || value <= 0) continue;
    if (value < 10000 && /millon|millones/.test(n)) numericValues.push(value * 1000000);
    else if (value >= 10000) numericValues.push(value);
  }

  const wordValues = [
    [/medio millon/, 500000],
    [/millon y medio|uno y medio|1 y medio/, 1500000],
    [/un millon|uno millon|1 millon/, 1000000],
    [/dos millones|2 millones/, 2000000],
    [/tres millones|3 millones/, 3000000],
    [/cuatro millones|4 millones/, 4000000],
    [/cinco millones|5 millones/, 5000000]
  ];
  for (const [regex, value] of wordValues) {
    if (regex.test(n)) numericValues.push(value);
  }

  if (/entre/.test(n) && numericValues.length >= 2) {
    return {
      presupuesto_minimo: Math.min(...numericValues.slice(0, 2)),
      presupuesto_maximo: Math.max(...numericValues.slice(0, 2))
    };
  }
  if (numericValues.length) return { presupuesto_maximo: Math.max(...numericValues) };
  return {};
}

function inferNeed(text) {
  const n = normalizeText(text);
  if (/foto|camara|video/.test(n)) return "fotos y videos";
  if (/juego|gamer|gaming|xbox|playstation|nintendo|atari/.test(n)) return "juegos";
  if (/trabajo|oficina|empresa|negocio/.test(n)) return "trabajo";
  if (/estudio|estudiar|clase|colegio|universidad/.test(n)) return "estudio";
  if (/redes|whatsapp|facebook|instagram|tiktok/.test(n)) return "redes sociales";
  if (/general|normal|basico/.test(n)) return "uso general";
  return "";
}

function extractPreferences(text) {
  const tokens = queryTokens(text);
  const knownBrands = ["samsung", "iphone", "xiaomi", "redmi", "jbl", "fox", "huawei", "motorola", "oppo", "vivo", "tecno", "infinix"];
  const prefs = [];
  for (const brand of knownBrands) {
    if (tokens.includes(brand)) prefs.push(brand);
  }
  if (/buena camara|camara|foto/.test(normalizeText(text))) prefs.push("camara");
  if (/bluetooth/.test(normalizeText(text))) prefs.push("bluetooth");
  if (/original/.test(normalizeText(text))) prefs.push("original");
  return [...new Set(prefs)];
}

function scoreProduct(product, criteria = {}) {
  if (productStock(product) <= 0) return -1;
  const requestText = normalizeText(`${criteria.rawText || ""} ${criteria.tipo_producto || ""} ${criteria.uso_principal || ""}`);
  const idText = normalizeText(product.id);
  const nameText = normalizeText(product.name);
  const categoryText = normalizeText(product.category);
  const brandText = normalizeText(product.brand);
  const featureText = normalizeText(`${product.storeDescription || ""} ${product.botFeatures || ""}`);
  const text = normalizeText(`${product.id} ${product.name} ${product.category} ${product.brand} ${product.storeDescription || ""} ${product.botFeatures || ""}`);
  if (isPhoneDeviceRequest(requestText)) {
    if (isPhoneAccessoryProduct(text)) return -1;
    if (!looksLikePhoneDeviceProduct(product, requestText)) return -1;
  }
  if (!matchesSpecificProductFamily(product, requestText)) return -1;
  if (isRadioDeviceRequest(requestText) && /cargador/.test(nameText)) return -1;
  const tokens = [
    ...queryTokens(criteria.rawText || ""),
    ...queryTokens(criteria.tipo_producto || ""),
    ...queryTokens(criteria.uso_principal || ""),
    ...(criteria.preferencias || [])
  ];
  let score = 0;
  for (const token of tokens) {
    if (!token) continue;
    const tokenRegex = new RegExp(`(^|\\s|[-_/])${escapeRegex(token)}($|\\s|[-_/])`);
    if (idText === token) score += 80;
    else if (idText.includes(token)) score += 35;
    if (tokenRegex.test(nameText)) score += 55;
    else if (nameText.includes(token)) score += 35;
    if (tokenRegex.test(brandText)) score += 20;
    else if (brandText.includes(token)) score += 10;
    if (tokenRegex.test(featureText)) score += 12;
    else if (featureText.includes(token)) score += 5;
    if (categoryText.includes(token)) score += 4;
    else if (text.includes(token)) score += 2;
  }
  if (criteria.categoria && product.category === criteria.categoria) score += 3;
  const price = productPrice(product);
  if (criteria.presupuesto_maximo && price > criteria.presupuesto_maximo) score -= 20;
  if (criteria.presupuesto_minimo && price < criteria.presupuesto_minimo) score -= 3;
  if (/\bcabinas?\b/.test(requestText) && /\b(grande|pulgadas?|cantina|local|negocio)\b/.test(requestText)) {
    score += Math.min(productSizeInches(product), 30) * 3;
  }
  if (!tokens.length && criteria.categoria) score += 1;
  return score;
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function productSizeInches(product) {
  const source = String(`${product?.name || ""} ${product?.storeDescription || ""}`);
  const match = source.match(/(\d+(?:[.,]\d+)?)\s*(?:"|pulg(?:ada)?s?)/i);
  return match ? Number(match[1].replace(",", ".")) || 0 : 0;
}

function matchesSpecificProductFamily(product, requestText = "") {
  const request = normalizeText(requestText);
  const productName = normalizeText(`${product?.id || ""} ${product?.name || ""}`);
  const asksAccessory = /\b(tripode|soporte|base|forro|funda|cable|repuesto|control|adaptador|cargador)\b/.test(request);

  if (/\bcabinas?\b/.test(request)) {
    if (!/\bcabina\b/.test(productName)) return false;
    if (!asksAccessory && /\b(tripode|soporte|base|forro|funda|cable|repuesto|control|adaptador)\b/.test(productName)) return false;
  }

  if (/\b(consolas?|xbox|playstation|nintendo|atari)\b/.test(request)) {
    if (!/\b(consola|xbox|playstation|nintendo|atari)\b/.test(productName)) return false;
    if (!asksAccessory && /\b(cable|control|forro|funda|base|soporte|adaptador|cargador)\b/.test(productName)) return false;
  }

  return true;
}

function isPhoneDeviceRequest(text) {
  const n = normalizeText(text);
  if (!/\b(celular|telefono|smartphone|movil|equipo)\b/.test(n)) return false;
  return !/\b(cargador|cable|funda|forro|estuche|case|vidrio|protector|bateria|holder|soporte|base|camara|repuesto|pantalla)\b/.test(n);
}

function isPhoneAccessoryProduct(text) {
  const n = normalizeText(text);
  return /\b(holder|soporte|base|cargador|cabeza|cable|funda|forro|estuche|case|vidrio|protector|bateria|camara|repuesto|pantalla|mica|ml)\b/.test(n);
}

function looksLikePhoneDeviceProduct(product, requestText = "") {
  const name = normalizeText(`${product.id || ""} ${product.name || ""} ${product.brand || ""}`);
  const generic = new Set(["celular", "telefono", "smartphone", "movil", "equipo"]);
  const tokens = queryTokens(requestText).filter((token) => !generic.has(token));
  if (tokens.length) return tokens.some((token) => token.length > 3 && name.includes(token));
  return /\b(celular|telefono|smartphone|iphone|samsung|xiaomi|redmi|infinix|tecno|huawei|oppo|vivo|motorola|honor|nokia)\b/.test(name);
}

function isRadioDeviceRequest(text) {
  const n = normalizeText(text);
  return /\bradio\b/.test(n) && !/\b(cargador|cable|antena|bateria)\b/.test(n);
}

function unsupportedProductLine(text) {
  const n = normalizeText(text);
  const tokens = new Set(n.split(" ").filter(Boolean));
  const hasAny = (items) => items.some((item) => tokens.has(item) || n.includes(item));
  const accessory = hasAny(["cargador", "cable", "adaptador", "mouse", "teclado", "base", "soporte", "holder", "audifono", "diadema", "parlante", "radio"]);
  if (accessory) return "";
  if (hasAny(["computador", "computadores", "computadora", "computadoras", "portatil", "portatiles", "laptop", "laptops", "notebook", "notebooks", "pc gamer", "pc gaming"])) return "computadores o portatiles";
  return "";
}

function unsupportedProductReply(line) {
  return "Por ahora no manejamos " + line + " en inventario.\n\nSi buscas accesorios relacionados, si puedo ayudarte con opciones como cargadores, cables, mouse, audifonos, parlantes, soportes o radios disponibles.";
}

function isAvailabilityListRequest(text) {
  const n = normalizeText(text);
  const tokens = new Set(n.split(" ").filter(Boolean));
  const hasListWord = ["mostrar", "muestrame", "muestreme", "ver", "tienes", "tienen", "hay", "disponibles", "disponible", "opciones"].some((item) => tokens.has(item));
  const hasProductWord = ["cargador", "cable", "audifono", "diadema", "parlante", "cabina", "consola", "xbox", "playstation", "nintendo", "atari", "radio", "soporte", "holder", "base", "control", "tv", "tvbox", "watch", "funda", "forro", "vidrio", "mouse"].some((item) => tokens.has(item));
  return hasListWord && !hasProductWord;
}

function correctionProductFromText(text, memory = {}) {
  const n = normalizeText(text);
  const correction = ["no corresponde", "no es", "eso no", "ese no", "esa no", "te pedi", "yo pedi", "buscaba", "busco", "era"].some((item) => n.includes(item));
  if (!correction) return "";
  const previous = normalizeText((memory.tipo_producto || "") + " " + (memory.uso_principal || ""));
  if (n.includes("radio") || previous.includes("radio")) return "radio";
  if (n.includes("cargador") || n.includes("cabeza")) return "cargador";
  if (n.includes("soporte") || n.includes("holder") || n.includes("base")) return "soporte";
  if (n.includes("diadema") || n.includes("audifono") || n.includes("auricular")) return "diadema";
  if (n.includes("cabina") || previous.includes("cabina")) return "cabina";
  if (n.includes("consola") || n.includes("xbox") || n.includes("playstation") || n.includes("nintendo") || n.includes("atari") || previous.includes("consola")) return "consola";
  return "";
}

function searchProducts(db, criteria = {}, offset = 0) {
  const hasRawQuery = queryTokens(`${criteria.rawText || ""} ${criteria.tipo_producto || ""} ${criteria.uso_principal || ""}`).length > 0;
  const products = (db.products || [])
    .filter((product) => productStock(product) > 0)
    .filter((product) => !criteria.categoria || hasRawQuery || product.category === criteria.categoria)
    .filter((product) => !hasRawQuery || matchesRequestedProduct(product, criteria))
    .map((product) => ({ product, score: scoreProduct(product, criteria) }))
    .filter((item) => hasRawQuery ? item.score >= 18 : (item.score > 0 || (criteria.categoria && !criteria.rawText)))
    .sort((a, b) => {
      if (criteria.orden === "precio_ascendente") return productPrice(a.product) - productPrice(b.product);
      return b.score - a.score || productPrice(a.product) - productPrice(b.product);
    });

  const withinBudget = criteria.presupuesto_maximo
    ? products.filter((item) => productPrice(item.product) <= criteria.presupuesto_maximo)
    : products;
  const source = withinBudget.length ? withinBudget : products;
  return source.slice(offset, offset + 3).map((item) => item.product);
}

function matchesRequestedProduct(product, criteria = {}) {
  const requestText = normalizeText(`${criteria.rawText || ""} ${criteria.tipo_producto || ""} ${criteria.uso_principal || ""}`);
  if (!matchesSpecificProductFamily(product, requestText)) return false;
  let required = [...new Set(baseQueryTokens(requestText).filter((token) => !SOFT_PRODUCT_TOKENS.has(token)))];
  if (!required.length) return true;

  const genericPhone = new Set(["celular", "telefono", "smartphone", "movil", "equipo"]);
  if (isPhoneDeviceRequest(requestText)) required = required.filter((token) => !genericPhone.has(token));
  if (required.includes("solar")) required = required.filter((token) => token !== "panel");

  const searchable = normalizeText(`${product.id || ""} ${product.name || ""} ${product.brand || ""}`);
  const fullSearchable = normalizeText(`${product.id || ""} ${product.name || ""} ${product.brand || ""} ${product.category || ""} ${product.storeDescription || ""} ${product.botFeatures || ""}`);
  if (!required.length) return !isPhoneDeviceRequest(requestText) || looksLikePhoneDeviceProduct(product, requestText);

  const expandedRequired = required.flatMap((token) => [token, ...(TOKEN_SYNONYMS[token] || [])].map(normalizeText));
  const anchorTokens = required.filter((token) => PRODUCT_ANCHOR_GROUPS[token]);
  const brandTokens = required.filter((token) => KNOWN_BRAND_TOKENS.has(token));
  const specificTokens = required.filter((token) => SPECIFIC_REQUIREMENT_TOKENS.has(token));
  const modelTokens = required.filter((token) => {
    if (PRODUCT_ANCHOR_GROUPS[token] || KNOWN_BRAND_TOKENS.has(token) || SPECIFIC_REQUIREMENT_TOKENS.has(token)) return false;
    return /\d/.test(token) || token.length >= 5;
  });

  if (anchorTokens.length) {
    const anchorOk = anchorTokens.some((token) => {
      const variants = PRODUCT_ANCHOR_GROUPS[token] || [token];
      return variants.some((variant) => searchable.includes(normalizeText(variant)));
    });
    if (!anchorOk) return false;
  }

  if (brandTokens.length) {
    const brandOk = brandTokens.some((token) => searchable.includes(token) || fullSearchable.includes(token));
    if (!brandOk) return false;
  }

  if (specificTokens.length) {
    const specificOk = specificTokens.some((token) => {
      const variants = [token, ...(TOKEN_SYNONYMS[token] || [])].map(normalizeText);
      return variants.some((variant) => variant.length > 2 && fullSearchable.includes(variant));
    });
    if (!specificOk) return false;
  }

  if (modelTokens.length && !anchorTokens.length && !brandTokens.length && !specificTokens.length) {
    return modelTokens.some((token) => {
      const variants = [token, ...(TOKEN_SYNONYMS[token] || [])].map(normalizeText);
      return variants.some((variant) => variant.length > 2 && fullSearchable.includes(variant));
    });
  }

  if (anchorTokens.length || brandTokens.length || specificTokens.length) return true;

  return expandedRequired.some((token) => token.length > 2 && fullSearchable.includes(token));
}

function looksLikeProductRequest(text) {
  const n = normalizeText(text);
  if (/^(si|no|ok|listo|dale|ver carrito|finalizar|finalizar compra|menu|asesor)$/.test(n)) return false;
  if (isCartQuestion(text)) return false;
  return queryTokens(text).length >= 2
    || /\b(soporte|holder|porta|base|cargador|cable|audifono|parlante|cabina|consola|xbox|playstation|nintendo|atari|control|tvbox|tv stick|smart tv|android tv|chromecast|roku|telefono|celular|iphone|samsung|xiaomi|vidrio|radio|watch|funda|fundas|forro|estuche|case|carcasa)\b/.test(n)
    || /\b(convertir|volver|hacer)\b.*\btv\b/.test(n)
    || /\b[A-Za-z]{2,}[-]?\d{1,}\b/.test(String(text || ""));
}

function isCartQuestion(text) {
  const n = normalizeText(text);
  return /\b(carrito|pedido)\b/.test(n) && /\b(ver|mostrar|muestrame|muestreme|total|cuanto|valor|productos|que llevo|resumen|cuanto va|cuanto llevo)\b/.test(n);
}

function searchFromText(db, from, memory, text) {
  const unsupported = unsupportedProductLine(text);
  if (unsupported) {
    return reply(db, from, unsupportedProductReply(unsupported), {
      estado: STATES.MENU_PRINCIPAL,
      campo_esperado: "producto_o_necesidad",
      intentos_fallidos: 0,
      tipo_producto: null,
      uso_principal: null,
      categoria: null,
      productos_mostrados: []
    });
  }
  const category = findCategory(db, text) || "";
  const budget = parseBudget(text);
  const patch = {
    ...memory,
    estado: STATES.MOSTRANDO_PRODUCTOS,
    categoria: category || null,
    tipo_producto: text,
    uso_principal: inferNeed(text) || cleanProductQueryLabel(text),
    presupuesto_minimo: budget.presupuesto_minimo ?? memory.presupuesto_minimo ?? null,
    presupuesto_maximo: budget.presupuesto_maximo ?? memory.presupuesto_maximo ?? null,
    orden: budget.orden || memory.orden || "",
    preferencias: [...new Set([...(memory.preferencias || []), ...extractPreferences(text)])],
    resultOffset: 0
  };
  setConversation(db, from, patch);
  return runSearch(db, from, patch, text);
}

function explicitProductAnchors(text) {
  return [...new Set(baseQueryTokens(text).filter((token) => PRODUCT_ANCHOR_GROUPS[token]))];
}

function isProductRefinement(text) {
  const n = normalizeText(text);
  return /\b(no pero|pero|algo|grande|pequeno|pulgada|local|cantina|negocio|ese tipo|de ese|similar|parecido)\b/.test(n);
}

function mergePlannerProductQuery(text, plannerQuery, memory = {}) {
  const current = String(text || "").trim();
  const planned = String(plannerQuery || "").trim();
  const currentAnchors = explicitProductAnchors(current);
  if (currentAnchors.length) return current;

  if (isProductRefinement(current)) {
    const previousAnchors = explicitProductAnchors(`${memory.tipo_producto || ""} ${memory.uso_principal || ""}`);
    if (previousAnchors.length) {
      const base = planned || current;
      return `${previousAnchors.join(" ")} ${base}`.trim();
    }
  }

  return planned || current;
}

function findProductById(db, productId) {
  return (db.products || []).find((product) => String(product.id).toUpperCase() === String(productId || "").toUpperCase()) || null;
}

function shownProducts(db, memory) {
  return (memory.productos_mostrados || [])
    .map((item) => findProductById(db, item.producto_id))
    .filter(Boolean);
}

function selectShownProduct(db, memory, text) {
  const n = normalizeText(text);
  const shown = shownProducts(db, memory);
  if (shown.length === 1 && /\b(ese|esa|este|esta|me gusta|me sirve|se ve bien|cuentame|explicame|como funciona|agrega|agregalo|anadelo|ponlo|lo quiero|la quiero)\b/.test(n)) return shown[0];
  const ordinal = [
    [/\b(1|opcion 1|primer|primero|primera|el primero|la primera)\b/, 0],
    [/\b(2|opcion 2|dos|segundo|segunda|el segundo|la segunda)\b/, 1],
    [/\b(3|opcion 3|tres|tercer|tercero|tercera|ultimo|ultima|el ultimo|la ultima|la tercera)\b/, 2]
  ];
  for (const [regex, index] of ordinal) {
    if (regex.test(n) && shown[index]) return shown[index];
  }
  const priceNumbers = (n.match(/\d[\d.]*/g) || [])
    .map((value) => Number(value.replace(/\D/g, "")))
    .filter((value) => value > 0);
  if (priceNumbers.length) {
    const byPrice = shown.find((product) => priceNumbers.some((value) => {
      const price = productPrice(product);
      return price === value || price === value * 1000 || Math.abs(price - value) <= 200;
    }));
    if (byPrice) return byPrice;
  }
  if (/mas barato|mas economica|economico|economica|menor precio|menor valor|baratica|barato|barata/.test(n)) {
    return [...shown].sort((a, b) => productPrice(a) - productPrice(b))[0] || null;
  }
  if (/mas caro|mejor|mayor precio/.test(n)) {
    return [...shown].sort((a, b) => productPrice(b) - productPrice(a))[0] || null;
  }
  return shown.find((product) => {
    const haystack = normalizeText(`${product.id} ${product.name}`);
    return queryTokens(text).some((token) => haystack.includes(token));
  }) || null;
}

function formatResults(products, memory) {
  const context = memory.uso_principal ? ` para ${memory.uso_principal}` : "";
  const policy = getWholesalePolicy(products[0] || {});
  return `Mira estas opciones${context}:\n\n${products.map((product, index) => productLine(product, index + 1)).join("\n\n")}\n\nPrecio mayorista: ${wholesaleRequirementText(policy)}.\n\nPuedes decirme: me gusta la segunda, explicame la tercera o agrega la primera.`;
}

function parseQuantity(text) {
  const normalized = normalizeText(text);
  const direct = normalized.match(/^\d{1,3}$/);
  if (direct) return Math.max(Number(direct[0] || 1), 1);
  const match = String(text || "").match(/(?:x|por|\*)\s*(\d+)|(\d+)\s*(?:unidades|unds|und|uds|piezas|pz)|(?:agrega|agregar|quiero|llevo|ponme|sumame)\s+(\d+)/i);
  return Math.max(Number(match?.[1] || match?.[2] || match?.[3] || 1), 1);
}

function isYes(text) {
  return /^(si|s|ok|okay|dale|de una|listo|correcto|confirmo|me sirve|sirve|ese|esa|ese mismo|esa misma|quiero ese|quiero esa)$/i.test(normalizeText(text));
}

function wantsAddToCart(text) {
  const n = normalizeText(text);
  return isYes(text)
    || /\b(agrega|agregar|agregalo|agregala|anade|anadelo|anadela|sumalo|sumala|metelo|metela|ponlo|ponla|echalo|echala)\b/.test(n)
    || /\b(al|a mi|en el|al mi)?\s*carrito\b/.test(n)
    || /\b(lo quiero|la quiero|quiero ese|quiero esa|quiero este|quiero esta|me lo llevo|me la llevo|me sirve|ese me sirve|esa me sirve)\b/.test(n)
    || /\b(quiero|agrega|agregar|anade|anadelo|pon|ponme|mete|meteme|llevo|me llevo)\s+(el\s+|la\s+)?(1|2|3|uno|dos|tres|primer|primero|segundo|tercero|ultimo)\b/.test(n)
    || /\b(compremos|pidelo|pidala|reservalo|reserva ese)\b/.test(n);
}

function isNo(text) {
  return /^(no|nop|no gracias|descarta|cancelar|ese no|esa no|no quiero)$/i.test(normalizeText(text));
}

function isDone(text) {
  return /finalizar|terminar|confirmar compra|finalizar compra|eso es todo|eso seria|seria todo|nada mas|listo mi pedido|listo ese seria|todo mi pedido|ese es mi pedido|eso es mi pedido|con eso seria|con eso es todo/.test(normalizeText(text));
}

function isCheckoutOption(text) {
  const n = normalizeText(text);
  return isDone(text) || /^(3|finalizar|finalizar compra|terminar|terminar pedido|cerrar compra)$/.test(n);
}

function cartPricingItem(product, qty) {
  return {
    sku: product.id || product.sku || product.productId,
    name: product.name,
    category: product.category || "",
    brand: product.brand || "",
    qty,
    wholesalePrice: getWholesalePrice(product),
    retailPrice: getRetailPrice(product),
    freeShipping: Boolean(product.freeShipping ?? product.free_shipping)
  };
}

function simulatedCartAfterAdd(db, product, addedQty) {
  const productId = String(product.id);
  const items = cartItems(db).map((item) => ({ ...item }));
  const existing = items.find((item) => String(item.sku || item.productId || item.id) === productId);
  if (existing) {
    existing.qty = Number(existing.qty || 0) + addedQty;
    existing.wholesalePrice = getWholesalePrice(product);
    existing.retailPrice = getRetailPrice(product);
    existing.freeShipping = Boolean(product.freeShipping ?? product.free_shipping);
  } else {
    items.push(cartPricingItem(product, addedQty));
  }
  return priceBotCart(items, db.settings || {});
}

function simulatedCartAfterRemove(db, productId, removedQty) {
  const items = cartItems(db).map((item) => ({ ...item }));
  const index = items.findIndex((item) => String(item.sku || item.productId || item.id) === String(productId));
  if (index >= 0) {
    const nextQty = Number(items[index].qty || 0) - removedQty;
    if (nextQty > 0) items[index].qty = nextQty;
    else items.splice(index, 1);
  }
  return priceBotCart(items, db.settings || {});
}

function addProductToCart(db, from, memory, product, text, quantityOverride = 0) {
  const qty = Math.max(Math.round(Number(quantityOverride || 0) || parseQuantity(text)), 1);
  const currentQty = Number(cartItems(db).find((item) => String(item.sku || item.productId) === String(product.id))?.qty || 0);
  if (productStock(product) < currentQty + qty) {
    return reply(db, from, "Ese producto no tiene stock suficiente ahora mismo. Puedo mostrarte alternativas o pasarte con un asesor.", { estado: STATES.VIENDO_PRODUCTO });
  }
  db.cartAction = { type: "add", product, qty };
  const simulated = simulatedCartAfterAdd(db, product, qty);
  const pricedLine = simulated.items.find((item) => String(item.sku || item.productId || item.id) === String(product.id));
  const tier = pricedLine?.priceTier === "mayorista" ? "mayorista (P1)" : "al detal (P2)";
  return reply(db, from, `Listo, agregue este producto al carrito:\n\n${product.name}\nCodigo: ${product.id}\nCantidad en carrito: ${pricedLine?.qty || qty}\nPrecio ${tier}: ${money(pricedLine?.price || productPrice(product))} c/u\n\nTotal parcial: ${money(simulated.subtotal)}\n\nPuedes pedirme otro producto o decirme "finalizar compra" cuando quieras cerrar el pedido.`, {
    ...memory,
    estado: STATES.CARRITO,
    campo_esperado: "accion_carrito",
    producto_actual: product.id,
    intentos_fallidos: 0
  });
}

function paymentOptions(db) {
  const raw = db.settings?.paymentOptions;
  if (Array.isArray(raw) && raw.length) return raw.map(String);
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed.map(String);
    } catch {}
    return raw.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
  }
  return ["Transferencia", "Pago contra entrega", "Pago en el local", "Enlace de pago"];
}

function paymentMenu(db) {
  return paymentOptions(db).map((item, index) => `${index + 1}. ${item}`).join("\n");
}

function choosePayment(db, text) {
  const options = paymentOptions(db);
  const n = normalizeText(text);
  const num = Number(n.match(/\b\d{1,2}\b/)?.[0] || 0);
  if (num >= 1 && num <= options.length) return options[num - 1];
  if (/transferencia|consignacion|nequi|banco|pse/.test(n)) return options.find((item) => /transferencia|consignacion|nequi|banco|pse/i.test(item)) || "Transferencia";
  if (/contraentrega|contra entrega|efectivo/.test(n)) return options.find((item) => /contra|efectivo/i.test(item)) || "Pago contra entrega";
  if (/local|tienda|recoger/.test(n)) return options.find((item) => /local|tienda/i.test(item)) || "Pago en el local";
  if (/enlace|link|tarjeta/.test(n)) return options.find((item) => /enlace|link|tarjeta/i.test(item)) || "Enlace de pago";
  return "";
}

function latestOrder(db, from) {
  return customerOrders(db, from)[0] || null;
}

function customerOrders(db, from) {
  const phone = phoneOf(from);
  return (db.orders || []).filter((order) => samePhone(order.phone, phone));
}

function findOrder(db, id) {
  return (db.orders || []).find((order) => String(order.id).toUpperCase() === String(id || "").toUpperCase()) || null;
}

function referencedOrder(db, from, text) {
  const match = String(text || "").match(/\bPED-[A-Z0-9-]+\b/i);
  if (!match) return null;
  const order = findOrder(db, match[0]);
  return order && samePhone(order.phone, from) ? order : null;
}

function pendingPaymentOrder(db, from, text, memory = {}) {
  const orders = customerOrders(db, from);
  const referenced = referencedOrder(db, from, text);
  if (referenced) return referenced;
  const active = findOrder(db, memory.activeOrderId);
  if (active && samePhone(active.phone, from) && /pendiente comprobante|pendiente validacion pago/i.test(`${active.status} ${active.paymentStatus}`)) {
    return active;
  }
  return orders.find((order) => /pendiente comprobante|pendiente validacion pago/i.test(`${order.status} ${order.paymentStatus}`)) || null;
}

function orderStatus(order) {
  if (!order) return "No encuentro pedidos asociados a este WhatsApp. Si quieres comprar, escribe MENU.";
  if (normalizeText(order.status) === "despachado") {
    const carrier = order.dispatch?.carrier || "";
    const guide = order.dispatch?.guide || "";
    return `Tu pedido ${order.id} ya fue despachado.\nGuia: ${guide ? `${carrier ? `${carrier}: ` : ""}${guide}` : "pendiente por registrar"}\nTotal: ${money(order.total)}.`;
  }
  return `Tu pedido ${order.id} esta asi:\nEstado: ${order.status}\nPago: ${order.paymentStatus}\nValidacion: ${order.validationStatus}\nTotal: ${money(order.total)}.`;
}

function orderStatusReply(db, from, text, memory = {}) {
  const orders = customerOrders(db, from);
  const exact = referencedOrder(db, from, text);
  if (exact) return orderStatus(exact);
  if (!orders.length) return orderStatus(null);
  if (/\b(mis|los|todos)\s+pedidos\b|\bpedidos anteriores\b/.test(normalizeText(text)) && orders.length > 1) {
    return `Estos son tus pedidos mas recientes:\n\n${orders.slice(0, 5).map((order) => `- ${order.id}: ${order.status} | ${money(order.total)}`).join("\n")}\n\nSi quieres el detalle de uno, escribeme su numero.`;
  }
  const active = findOrder(db, memory.activeOrderId);
  return orderStatus(active && samePhone(active.phone, from) ? active : orders[0]);
}

function buildOrderFromConversation(db, from, memory) {
  const items = cartItems(db);
  const totals = checkoutTotals(items);
  const payment = memory.metodo_pago || "Por confirmar";
  const isTransfer = isTransferPayment(payment);
  return {
    id: `PED-${Date.now().toString().slice(-6)}`,
    customerId: currentCustomer(db, from).id,
    customerName: currentCustomer(db, from).name || "Cliente WhatsApp",
    phone: phoneOf(from),
    items,
    subtotal: totals.subtotal,
    freight: totals.freight,
    total: totals.total,
    status: isTransfer ? "Pendiente comprobante" : "Pendiente datos envio",
    paymentStatus: isTransfer ? "Pendiente comprobante" : payment,
    channel: "whatsapp",
    source: "bot",
    botStatus: "reservado_por_bot",
    validationStatus: isTransfer ? "pendiente_comprobante" : "pendiente_datos_envio",
    priority: "normal",
    customerCompany: "",
    customerDocument: "",
    contactPhone: "",
    customerCity: "",
    deliveryAddress: "",
    deliveryType: memory.tipo_entrega || "",
    requestedText: `Pedido confirmado por WhatsApp. Entrega: ${memory.tipo_entrega || ""}. Pago: ${payment}.`,
    notes: `Tipo de entrega: ${memory.tipo_entrega || ""}. Metodo de pago: ${payment}.`,
    dispatch: { carrier: "", guide: "", city: "", address: "", notes: "" },
    createdAt: new Date().toLocaleString("es-CO", { hour12: false })
  };
}

function parseCustomerDocument(text) {
  const value = String(text || "").trim();
  const normalized = value.replace(/[^a-z0-9]/gi, "");
  return normalized.length >= 5 && normalized.length <= 20 ? value : "";
}

function parseContactPhone(text, from) {
  const normalized = normalizeText(text);
  if (/este numero|mismo numero|el mismo|mi whatsapp|este whatsapp|numero de aqui/.test(normalized)) {
    return phoneOf(from);
  }
  const digits = String(text || "").replace(/\D/g, "");
  if (digits.length === 10) return `+57${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return "";
}

function completeDispatchData(db, from, memory, patch = {}) {
  const completed = { ...memory, ...patch };
  const order = findOrder(db, completed.activeOrderId);
  if (!order || !samePhone(order.phone, from)) return resetConversation(db, from);

  const pickup = isPickupDelivery(completed.tipo_entrega || order.deliveryType);
  const city = pickup ? "Pitalito" : String(completed.ciudad || "").trim();
  const address = pickup ? "Recoger en el local" : String(completed.direccion || "").trim();
  const next = {
    ...order,
    customerName: completed.nombre_cliente,
    customerDocument: completed.documento_cliente,
    contactPhone: completed.telefono_contacto || phoneOf(from),
    customerCity: city,
    deliveryAddress: address,
    deliveryType: completed.tipo_entrega || order.deliveryType || "",
    status: "Pendiente validacion",
    botStatus: "confirmado_por_bot",
    validationStatus: "pendiente_validacion",
    confirmedAt: new Date().toLocaleString("es-CO", { hour12: false }),
    dispatch: {
      ...(order.dispatch || {}),
      city,
      address
    },
    notes: `${order.notes || ""}\nDatos de despacho confirmados por el cliente.`.trim()
  };
  db.orderUpdate = next;
  return reply(
    db,
    from,
    `Perfecto. Tu pedido ${order.id} quedo recibido por ${money(order.total)}.\n\nVamos a validar los detalles y te enviaremos la confirmacion o la guia de seguimiento por este WhatsApp. Puedes seguir escribiendome para consultar este pedido o hacer una compra nueva.`,
    {
      resetPurchaseContext: true,
      estado: STATES.MENU_PRINCIPAL,
      activeOrderId: "",
      modo_asesor: false,
      campo_esperado: "producto_o_necesidad",
      datos_despacho_completos: false
    }
  );
}

function bankInfo(db) {
  return db.settings?.bankInfo || "Datos bancarios pendientes por configurar. Un asesor te los confirmara antes de validar el pago.";
}

function isPaymentProof(text, context = {}) {
  const explicitText = /comprobante|soporte|recibo|ticket|voucher|ya pague|transferi|consigne|adjunto/.test(normalizeText(text));
  const mediaKind = String(context.mediaKind || "").toLowerCase();
  const compatibleMedia = Boolean(context.hasMedia) && ["image", "file"].includes(mediaKind);
  return explicitText || compatibleMedia;
}

function queuePaymentProof(db, order, text, context = {}) {
  const next = {
    ...order,
    status: "Pendiente validacion",
    validationStatus: "pendiente_validacion",
    paymentStatus: "Pendiente validacion pago",
    notes: `${order.notes || ""}\nComprobante recibido por WhatsApp y enviado a validacion interna.`.trim()
  };
  db.orderUpdate = next;
  db.paymentProofValidation = {
    order: next,
    text,
    mediaUrl: context.mediaUrl || "",
    mediaType: context.mediaContentType || ""
  };
}

function transferToAdvisor(db, from, memory, reason = "solicitud del cliente") {
  const viewed = shownProducts(db, memory).map((product) => product.name).join(", ") || "Sin productos vistos";
  db.requestHumanAttention = true;
  return reply(
    db,
    from,
    `Deje registrada tu solicitud para que un asesor revise la conversacion.\n\nResumen: ${memory.uso_principal || memory.tipo_producto || "consulta general"}. Productos vistos: ${viewed}. Motivo: ${reason}.\n\nMientras el equipo la revisa, el bot seguira disponible para ayudarte.`,
    { estado: memory.estado || STATES.MENU_PRINCIPAL, modo_asesor: false, intencion_actual: "SOLICITAR_ASESOR", campo_esperado: memory.campo_esperado || "producto_o_necesidad" }
  );
}

function globalCommand(text) {
  const n = normalizeText(text);
  if (/^(menu|menú|inicio|volver al inicio|menu principal)$/.test(n)) return "MENU";
  if (/reiniciar|comenzar de nuevo|empezar de nuevo/.test(n)) return "REINICIAR";
  if (/^(volver|atras|regresar)$/.test(n)) return "VOLVER";
  if (/cancelar|quiero cancelar/.test(n)) return "CANCELAR";
  if (isCartQuestion(text) || /ver carrito|mi carrito|muestrame el carrito|mostrar.*carrito|todo.*carrito|total.*carrito|valor.*carrito|productos.*carrito|que llevo|que hay en el carrito|cuales.*carrito/.test(n)) return "VER_CARRITO";
  if (/vaciar carrito|limpiar carrito|borrar carrito|quita todo/.test(n)) return "VACIAR_CARRITO";
  if (/finalizar compra|confirmar compra|cerrar compra|terminar pedido/.test(n)) return "FINALIZAR_COMPRA";
  if (/\b(?:asesor|humano|persona|vendedor)\b|hablar con alguien/.test(n)) return "ASESOR";
  if (/ayuda|opciones|que puedo hacer/.test(n)) return "AYUDA";
  return "";
}

function handleGlobalCommand(db, from, text, memory) {
  const command = globalCommand(text);
  if (!command) return null;
  if (command === "MENU" || command === "REINICIAR") return resetConversation(db, from);
  if (command === "ASESOR") return transferToAdvisor(db, from, memory, "solicita asesor");
  if (command === "VER_CARRITO") return reply(db, from, formatCart(cartItems(db)), { estado: memory.estado || STATES.CARRITO });
  if (command === "VACIAR_CARRITO") {
    db.clearCart = true;
    return reply(db, from, "Listo, deje el carrito vacio. Puedes escribir MENU para empezar de nuevo.", { estado: STATES.MENU_PRINCIPAL, productos_mostrados: [], producto_actual: null });
  }
  if (command === "FINALIZAR_COMPRA") return startCheckout(db, from, memory);
  if (command === "CANCELAR") {
    const activeOrder = findOrder(db, memory.activeOrderId);
    if (activeOrder && activeOrder.botStatus === "reservado_por_bot") {
      db.orderUpdate = {
        ...activeOrder,
        status: "Cancelado por cliente",
        validationStatus: "cancelado",
        notes: `${activeOrder.notes || ""}\nPedido cancelado por el cliente desde WhatsApp.`.trim()
      };
      return reply(db, from, `Listo, cancele el pedido ${activeOrder.id}. La reserva de inventario sera liberada. Puedes iniciar otra compra cuando quieras.`, {
        resetPurchaseContext: true,
        estado: STATES.MENU_PRINCIPAL,
        activeOrderId: "",
        modo_asesor: false,
        campo_esperado: "producto_o_necesidad"
      });
    }
    db.clearCart = true;
    return reply(db, from, "Listo, cancele el proceso actual y vacie el carrito. Cuando quieras, escribe MENU para iniciar de nuevo.", {
      resetPurchaseContext: true,
      estado: STATES.MENU_PRINCIPAL,
      activeOrderId: "",
      modo_asesor: false,
      campo_esperado: "producto_o_necesidad",
      productos_mostrados: [],
      producto_actual: null
    });
  }
  if (command === "VOLVER") return reply(db, from, mainMenu(db), { estado: STATES.MENU_PRINCIPAL, campo_esperado: "categoria" });
  if (command === "AYUDA") {
    return reply(db, from, "Puedes escribir: MENU, VER CARRITO, VACIAR CARRITO, FINALIZAR COMPRA o ASESOR. Tambien puedes decirme el producto que buscas con marca, referencia o presupuesto.", { estado: memory.estado || STATES.MENU_PRINCIPAL });
  }
  return null;
}

function startCheckout(db, from, memory) {
  if (!cartItems(db).length) {
    return reply(db, from, `Tu carrito esta vacio. Primero elige una categoria:\n\n${categoryMenu(db)}`, {
      estado: STATES.ESPERANDO_CATEGORIA,
      campo_esperado: "categoria"
    });
  }
  const unavailable = cartItems(db).find((item) => {
    const product = findProductById(db, item.sku || item.productId);
    return !product || productStock(product) < Number(item.qty || 1);
  });
  if (unavailable) {
    return reply(db, from, `Antes de finalizar necesito ajustar ${unavailable.name}: ya no hay suficientes unidades disponibles. Puedes quitarlo, reducir la cantidad o pedirme otra opcion.`, {
      estado: STATES.CARRITO,
      campo_esperado: "accion_carrito"
    });
  }
  const missingPrice = cartItems(db).find((item) => Number(item.price || 0) <= 0);
  if (missingPrice) {
    return reply(db, from, `Antes de finalizar necesito validar el Precio 2 de ${missingPrice.name}. Aun no puedo confirmar ese valor.`, {
      estado: STATES.CARRITO,
      campo_esperado: "accion_carrito"
    });
  }
  return reply(db, from, `Perfecto. Vamos a finalizar tu compra.\n\n${formatCart(cartItems(db))}\n\nComo deseas recibir tu pedido?\n1. Recoger en el local\n2. Domicilio en Pitalito\n3. Envio nacional`, {
    estado: STATES.ESPERANDO_TIPO_ENTREGA,
    campo_esperado: "tipo_entrega"
  });
}

function recovery(db, from, memory, expected) {
  const attempts = Number(memory.intentos_fallidos || 0) + 1;
  if (memory.estado === STATES.MOSTRANDO_PRODUCTOS && shownProducts(db, memory).length) {
    return reply(db, from, `Te leo. De las opciones que te mostré, dime cuál te gustó o qué quieres saber de ella. Puedes decirlo natural, por ejemplo: "la más económica", "explícame la segunda", "agrega la de $6.200" o "muéstrame otras".`, {
      estado: STATES.MOSTRANDO_PRODUCTOS,
      intentos_fallidos: attempts
    });
  }
  if (memory.estado === STATES.CARRITO) {
    return reply(db, from, `Te entiendo. Si quieres seguir comprando, dime el siguiente producto como lo dirías normalmente: "holder para carro", "cargador iPhone 35W", "cable tipo C". Si ya terminaste, dime "finalizar compra".`, {
      estado: STATES.CARRITO,
      intentos_fallidos: attempts
    });
  }
  if (memory.estado === STATES.ESPERANDO_TIPO_ENTREGA) {
    return reply(db, from, "Para continuar, dime cómo quieres recibirlo: recoger en el local, domicilio en Pitalito o envío a otra ciudad. Puedes responder natural, por ejemplo: \"envíamelo a mi casa, vivo en Acevedo\".", {
      estado: STATES.ESPERANDO_TIPO_ENTREGA,
      campo_esperado: "tipo_entrega",
      intentos_fallidos: attempts
    });
  }
  if (memory.estado === STATES.ESPERANDO_NOMBRE) {
    return reply(db, from, "¿A nombre de quién registramos el pedido? Escríbeme el nombre completo o la razón social.", {
      estado: STATES.ESPERANDO_NOMBRE,
      campo_esperado: "nombre_cliente",
      intentos_fallidos: attempts
    });
  }
  if (memory.estado === STATES.ESPERANDO_DOCUMENTO) {
    return reply(db, from, "Escríbeme la cédula o NIT de quien realiza la compra.", {
      estado: STATES.ESPERANDO_DOCUMENTO,
      campo_esperado: "documento_cliente",
      intentos_fallidos: attempts
    });
  }
  if (memory.estado === STATES.ESPERANDO_TELEFONO) {
    return reply(db, from, "¿Cuál es el teléfono de contacto? Puedes escribir el número o responder ESTE MISMO NÚMERO.", {
      estado: STATES.ESPERANDO_TELEFONO,
      campo_esperado: "telefono_contacto",
      intentos_fallidos: attempts
    });
  }
  if (memory.estado === STATES.ESPERANDO_CIUDAD) {
    return reply(db, from, "¿En qué ciudad o municipio debemos entregar el pedido?", {
      estado: STATES.ESPERANDO_CIUDAD,
      campo_esperado: "ciudad",
      intentos_fallidos: attempts
    });
  }
  if (memory.estado === STATES.ESPERANDO_DIRECCION) {
    return reply(db, from, "Necesito la dirección completa de entrega y una referencia del lugar. Ejemplo: Calle 5 # 8-20, barrio Centro, casa de portón blanco.", {
      estado: STATES.ESPERANDO_DIRECCION,
      campo_esperado: "direccion",
      intentos_fallidos: attempts
    });
  }
  if (memory.estado === STATES.ESPERANDO_METODO_PAGO) {
    return reply(db, from, `Elige cómo deseas pagar:\n${paymentMenu(db)}`, {
      estado: STATES.ESPERANDO_METODO_PAGO,
      campo_esperado: "metodo_pago",
      intentos_fallidos: attempts
    });
  }
  const hint = attempts === 1
    ? "Ayúdame con una pista más para ubicarlo bien."
    : `Quiero ayudarte bien. En este punto necesito: ${expected}.`;
  return reply(db, from, `${hint} Puedes decirme marca, referencia, uso o cómo lo conoces.`, {
    estado: memory.estado || STATES.MENU_PRINCIPAL,
    intentos_fallidos: attempts
  });
}

function askNeed(db, from, memory, category) {
  const n = normalizeText(category);
  let text = "Para que lo necesitas principalmente?";
  if (/celular/.test(n)) text = "Para que usarias principalmente el celular?\n1. Fotos y videos\n2. Juegos\n3. Redes sociales\n4. Trabajo\n5. Uso general";
  else if (/computador|portatil/.test(n)) text = "Para que necesitas principalmente el computador?\n1. Estudio y oficina\n2. Programacion\n3. Diseno y edicion\n4. Juegos\n5. Trabajo empresarial";
  else if (/cargador|audio|cable|accesorio|controles|tv|smartwatch/.test(n)) text = "Que caracteristica o tipo especifico necesitas? Ejemplo: cargador iPhone 35W, audifonos bluetooth, control LG.";
  return reply(db, from, text, {
    estado: STATES.ESPERANDO_NECESIDAD,
    categoria: category,
    campo_esperado: "uso_principal"
  });
}

function runSearch(db, from, memory, rawText = "") {
  const criteria = {
    categoria: memory.categoria,
    tipo_producto: memory.tipo_producto,
    uso_principal: memory.uso_principal,
    presupuesto_minimo: memory.presupuesto_minimo,
    presupuesto_maximo: memory.presupuesto_maximo,
    preferencias: memory.preferencias,
    orden: memory.orden,
    rawText
  };
  const offset = Number(memory.resultOffset || 0);
  const products = searchProducts(db, criteria, offset);
  if (!products.length) {
    const requested = rawText || memory.tipo_producto || "ese producto";
    return reply(db, from, `Por ahora no hay disponibilidad de "${requested}" en inventario. Si lo conoces con otra referencia, marca o nombre, escribemelo y lo vuelvo a buscar.`, {
      estado: STATES.ESPERANDO_ACLARACION,
      campo_esperado: "ajuste_busqueda",
      intentos_fallidos: Number(memory.intentos_fallidos || 0) + 1
    });
  }
  const shown = products.map((product, index) => ({ posicion: index + 1, producto_id: product.id }));
  return reply(db, from, formatResults(products, memory), {
    estado: STATES.MOSTRANDO_PRODUCTOS,
    categoria: memory.categoria || null,
    tipo_producto: rawText || memory.tipo_producto || null,
    uso_principal: memory.uso_principal || null,
    presupuesto_minimo: memory.presupuesto_minimo ?? null,
    presupuesto_maximo: memory.presupuesto_maximo ?? null,
    orden: memory.orden || "",
    preferencias: memory.preferencias || [],
    productos_mostrados: shown,
    campo_esperado: "seleccion_producto",
    resultOffset: offset,
    intentos_fallidos: 0
  });
}

function summaryText(db, memory) {
  const items = cartItems(db);
  const totals = checkoutTotals(items);
  const productFreeShipping = hasProductFreeShipping(items);
  const freightLine = productFreeShipping
    ? "Incluido por beneficio de los productos seleccionados"
    : "Se cotiza por separado con la transportadora";
  return `Por favor revisa tu pedido:\n\nProductos:\n${items.map(itemLine).join("\n")}\n\nValor de productos: ${money(totals.subtotal)}\nTransporte: ${freightLine}\nTotal de productos: ${money(totals.total)}\nEntrega: ${memory.tipo_entrega || "Pendiente"}\nMetodo de pago: ${memory.metodo_pago || "Pendiente"}\n\nSi todo esta bien, responde CONFIRMAR PEDIDO. Los datos de despacho te los pedire al final.`;
}

function aiPlanConfidence(plan) {
  const confidence = Number(plan?.confidence || 0);
  return Number.isFinite(confidence) ? confidence : 0;
}

function productFromCartItem(db, item) {
  const product = findProductById(db, item?.sku || item?.productId || item?.id);
  if (product) return product;
  if (!item) return null;
  return {
    id: item.sku || item.productId || item.id,
    name: item.name || "Producto",
    category: item.category || "",
    brand: item.brand || "",
    stock: Number(item.stockSnapshot || item.qty || 0),
    availableStock: Number(item.stockSnapshot || item.qty || 0),
    wholesalePrice: Number(item.wholesalePrice || item.price || item.unitPrice || 0),
    retailPrice: Number(item.retailPrice || item.price || item.unitPrice || 0),
    deposito: item.deposito || "",
    puesto: item.puesto || ""
  };
}

function findCartItemFromPlan(db, plan, text) {
  const items = cartItems(db);
  if (!items.length) return null;
  const requestedIds = [
    plan?.cartProductId,
    plan?.selectedProductId
  ].filter(Boolean).map((value) => normalizeText(value));
  for (const requestedId of requestedIds) {
    const exact = items.find((item) => normalizeText(item.sku || item.productId || item.id) === requestedId);
    if (exact) return exact;
  }

  const query = normalizeText(`${plan?.productQuery || ""} ${text || ""}`);
  const tokens = queryTokens(query);
  const scored = items
    .map((item) => {
      const haystack = normalizeText(`${item.sku || ""} ${item.name || ""} ${item.category || ""} ${item.brand || ""}`);
      const score = tokens.reduce((total, token) => total + (haystack.includes(token) ? 1 : 0), 0);
      return { item, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!scored.length) return null;
  if (scored.length > 1 && scored[0].score === scored[1].score) return null;
  return scored[0].item;
}

function findProductFromPlan(db, memory, plan, text) {
  const directIds = [
    plan?.selectedProductId,
    plan?.cartProductId
  ].filter(Boolean);
  for (const id of directIds) {
    const product = findProductById(db, id);
    if (product && matchesSpecificProductFamily(product, text)) return product;
  }

  const shown = shownProducts(db, memory);
  const selectedShown = selectShownProduct(db, memory, plan?.selectedProductId || text);
  if (selectedShown && matchesSpecificProductFamily(selectedShown, text)) return selectedShown;
  if (shown.length === 1 && /^(si|ese|esa|agregalo|agregala|lo quiero|la quiero)$/i.test(normalizeText(text))) {
    return shown[0];
  }

  const query = String(plan?.productQuery || "").trim();
  if (!query) return null;
  const exact = findProductById(db, query);
  if (exact && matchesSpecificProductFamily(exact, text || query)) return exact;
  const matches = searchProducts(db, { rawText: query, tipo_producto: query }, 0);
  return matches.length === 1 ? matches[0] : null;
}

function removeCartItemFromPlan(db, from, memory, plan, text) {
  const item = findCartItemFromPlan(db, plan, text);
  if (!item) {
    return reply(db, from, `No identifique cual producto deseas quitar.\n\n${formatCart(cartItems(db))}\n\nDime el codigo o el nombre exacto y lo retiro.`, {
      estado: STATES.CARRITO,
      campo_esperado: "producto_a_eliminar"
    });
  }
  const qty = Math.max(Math.round(Number(plan?.quantity || 1)), 1);
  db.cartAction = { type: "remove", productId: item.sku || item.productId || item.id, qty };
  const removedAll = qty >= Number(item.qty || 1);
  const simulated = simulatedCartAfterRemove(db, item.sku || item.productId || item.id, qty);
  return reply(db, from, removedAll
    ? `Listo, quite ${item.name} del carrito.\n\nTotal parcial: ${money(simulated.subtotal)}`
    : `Listo, quite ${qty} unidad(es) de ${item.name} del carrito.\n\nTotal parcial recalculado: ${money(simulated.subtotal)}`, {
    ...memory,
    estado: STATES.CARRITO,
    campo_esperado: "accion_carrito",
    intentos_fallidos: 0
  });
}

function replaceCartFromPlan(db, from, memory, plan, text) {
  const cartItem = findCartItemFromPlan(db, plan, text);
  const product = findProductFromPlan(db, memory, plan, text) || productFromCartItem(db, cartItem);
  if (!product) {
    const query = String(plan?.productQuery || "").trim();
    if (query) return searchFromText(db, from, memory, query);
    return reply(db, from, "Dime cual producto quieres dejar como unico en el carrito, por nombre o codigo.", {
      estado: STATES.CARRITO,
      campo_esperado: "producto_unico"
    });
  }
  const qty = Math.max(Math.round(Number(plan?.quantity || 1)), 1);
  if (productStock(product) < qty) {
    return reply(db, from, "Ese producto no tiene stock suficiente para dejarlo en el carrito.", {
      estado: STATES.CARRITO
    });
  }
  db.cartAction = { type: "replace", product, qty };
  const simulated = priceBotCart([cartPricingItem(product, qty)], db.settings || {});
  const pricedLine = simulated.items[0];
  const tier = pricedLine?.priceTier === "mayorista" ? "mayorista P1" : "detal P2";
  return reply(db, from, `Listo. Deje unicamente ${qty} x ${product.name} en el carrito.\n\nPrecio ${tier}: ${money(pricedLine?.price || productPrice(product))} c/u\nTotal parcial: ${money(simulated.subtotal)}`, {
    ...memory,
    estado: STATES.CARRITO,
    producto_actual: product.id,
    productos_mostrados: [{ posicion: 1, producto_id: product.id }],
    campo_esperado: "accion_carrito",
    intentos_fallidos: 0
  });
}

function contextualGreeting(db, from, memory, state, activeOrder) {
  if (activeOrder && [
    STATES.PEDIDO_CONFIRMADO,
    STATES.ESPERANDO_COMPROBANTE,
    STATES.PAGO_PENDIENTE_VERIFICACION
  ].includes(state)) {
    return reply(db, from, `Hola. Claro, seguimos con tu pedido.\n\n${orderStatus(activeOrder)}`, { estado: state });
  }
  if (cartItems(db).length) {
    return reply(db, from, `Hola. Ya tienes ${cartItems(db).length} producto(s) en el carrito. Podemos seguir buscando o finalizar la compra cuando quieras.`, {
      estado: state === STATES.INICIO ? STATES.CARRITO : state
    });
  }
  return reply(db, from, mainMenu(db), {
    estado: STATES.MENU_PRINCIPAL,
    campo_esperado: "producto_o_necesidad",
    intentos_fallidos: 0
  });
}

function handleAiPlan(db, from, text, context, memory, state, activeOrder) {
  const plan = context?.aiPlan;
  if (!plan || aiPlanConfidence(plan) < 0.55) return null;

  const intent = String(plan.intent || "");
  const protectedCheckoutState = [
    STATES.ESPERANDO_TIPO_ENTREGA,
    STATES.ESPERANDO_NOMBRE,
    STATES.ESPERANDO_DOCUMENTO,
    STATES.ESPERANDO_TELEFONO,
    STATES.ESPERANDO_CIUDAD,
    STATES.ESPERANDO_DIRECCION,
    STATES.ESPERANDO_METODO_PAGO,
    STATES.RESUMEN_PEDIDO,
    STATES.ESPERANDO_COMPROBANTE
  ].includes(state);
  const alwaysAllowed = new Set(["greeting", "order_status", "post_order_followup", "human_help", "view_cart", "new_order"]);
  if (protectedCheckoutState && !alwaysAllowed.has(intent)) return null;

  if (intent === "greeting") return contextualGreeting(db, from, memory, state, activeOrder);
  if (intent === "human_help") return transferToAdvisor(db, from, memory, "solicita atencion humana");
  if (intent === "view_cart") return reply(db, from, formatCart(cartItems(db)), { estado: cartItems(db).length ? STATES.CARRITO : state });
  if (intent === "clear_cart") {
    db.clearCart = true;
    return reply(db, from, "Listo, vacie el carrito. Dime que producto buscas y empezamos de nuevo.", {
      estado: STATES.MENU_PRINCIPAL,
      productos_mostrados: [],
      producto_actual: null
    });
  }
  if (intent === "order_status" || intent === "post_order_followup") {
    return reply(db, from, orderStatusReply(db, from, text, memory), { estado: state });
  }
  if (intent === "new_order") {
    return resetConversation(db, from);
  }
  if (intent === "checkout_confirm") return startCheckout(db, from, memory);
  if (intent === "remove_from_cart") return removeCartItemFromPlan(db, from, memory, plan, text);
  if (intent === "replace_cart") return replaceCartFromPlan(db, from, memory, plan, text);

  if (intent === "add_to_cart") {
    const selected = findProductFromPlan(db, memory, plan, text);
    if (selected) return addProductToCart(db, from, memory, selected, text, plan.quantity);
    const query = mergePlannerProductQuery(text, plan.productQuery, memory);
    if (query) return searchFromText(db, from, memory, query);
    return reply(db, from, "Quiero agregarlo bien. Dime el codigo o cual de las opciones elegiste.", {
      estado: state,
      campo_esperado: "seleccion_producto"
    });
  }

  if (intent === "product_images" || intent === "product_question") {
    const product = findProductFromPlan(db, memory, plan, text)
      || findProductById(db, memory.producto_actual)
      || (shownProducts(db, memory).length === 1 ? shownProducts(db, memory)[0] : null);
    if (product) {
      return reply(db, from, intent === "product_images" ? productImageLinkReply(db, product) : productDetail(product), {
        estado: STATES.VIENDO_PRODUCTO,
        producto_actual: product.id,
        campo_esperado: "accion_producto",
        intentos_fallidos: 0
      });
    }
    const query = mergePlannerProductQuery(text, plan.productQuery, memory);
    if (query) return searchFromText(db, from, memory, query);
    return reply(db, from, plan.clarificationQuestion || "De cual producto quieres que te explique las caracteristicas?", {
      estado: state,
      campo_esperado: "seleccion_producto"
    });
  }

  if (intent === "product_search") {
    const query = mergePlannerProductQuery(text, plan.productQuery, memory);
    if (!query) {
      return reply(db, from, plan.clarificationQuestion || "Que producto estas buscando?", {
        estado: STATES.MENU_PRINCIPAL,
        campo_esperado: "producto_o_necesidad"
      });
    }
    return searchFromText(db, from, memory, query);
  }

  if (intent === "catalog") {
    return reply(db, from, `Claro. Puedes ver el catálogo completo aquí:\n${STORE_CATALOG_URL}\n\nRevísalo y luego dime qué producto te interesa. También puedes describirme lo que necesitas y lo busco por ti.`, {
      estado: STATES.MENU_PRINCIPAL,
      campo_esperado: "producto_o_necesidad"
    });
  }

  return null;
}

async function handleIncomingMessage(db, from, body, context = {}) {
  try {
    const text = String(body || "").trim();
    const n = normalizeText(text);
    const memory = memoryOf(db, from);
    const state = memory.estado || memory.salesFlowStage || STATES.INICIO;

    if (currentCustomer(db, from).manualAttention) {
      return "";
    }

    const activeOrder = findOrder(db, memory.activeOrderId) || latestOrder(db, from);
    const paymentOrder = pendingPaymentOrder(db, from, text, memory);

    if (isPaymentProof(text, context) && paymentOrder) {
      queuePaymentProof(db, paymentOrder, text, context);
      return reply(db, from, `Comprobante recibido para tu pedido ${paymentOrder.id}. Lo enviaremos a validacion de pago y te confirmaremos por este mismo WhatsApp apenas quede validado.`, {
        estado: STATES.PAGO_PENDIENTE_VERIFICACION,
        activeOrderId: paymentOrder.id,
        campo_esperado: null
      });
    }

    if (cartItems(db).length && isDone(text)) {
      return startCheckout(db, from, memory);
    }

    if (/estado|guia|seguimiento|como va|mi pedido|mi producto|cuando llega|a la espera/.test(n)) {
      return reply(db, from, orderStatusReply(db, from, text, memory), { estado: state });
    }

    const addIntentInProductContext = (state === STATES.MOSTRANDO_PRODUCTOS || state === STATES.VIENDO_PRODUCTO) && wantsAddToCart(text);
    const global = addIntentInProductContext ? null : handleGlobalCommand(db, from, text, memory);
    if (global !== null) return global;

    const aiAnswer = handleAiPlan(db, from, text, context, memory, state, activeOrder);
    if (aiAnswer !== null) return aiAnswer;

    const unsupportedGlobal = unsupportedProductLine(text);
    if (unsupportedGlobal) {
      return reply(db, from, unsupportedProductReply(unsupportedGlobal), {
        estado: state === STATES.INICIO ? STATES.MENU_PRINCIPAL : state,
        campo_esperado: state === STATES.CARRITO ? "accion_carrito" : "producto_o_necesidad",
        intentos_fallidos: 0,
        tipo_producto: null,
        uso_principal: null,
        categoria: null,
        productos_mostrados: []
      });
    }

    if (state === STATES.INICIO || state === "start" || state === "lead_new") {
      if (looksLikeProductRequest(text)) return searchFromText(db, from, { ...memory, estado: STATES.MENU_PRINCIPAL }, text);
      return resetConversation(db, from);
    }

    if (state === STATES.MENU_PRINCIPAL || state === STATES.ESPERANDO_CATEGORIA) {
      const unsupported = unsupportedProductLine(text);
      if (unsupported) {
        return reply(db, from, unsupportedProductReply(unsupported), {
          estado: STATES.MENU_PRINCIPAL,
          campo_esperado: "producto_o_necesidad",
          intentos_fallidos: 0,
          tipo_producto: null,
          uso_principal: null,
          categoria: null,
          productos_mostrados: []
        });
      }
      const category = findCategory(db, text);
      const budget = parseBudget(text);
      const need = inferNeed(text);
      const prefs = extractPreferences(text);
      if (!category) {
        if (looksLikeProductRequest(text)) return searchFromText(db, from, memory, text);
        return reply(db, from, "Claro, dime qué producto necesitas y te busco opciones reales del inventario. Puede ser por nombre, marca, referencia o uso. Ejemplo: cargador Samsung 25W, holder para carro, audífonos bluetooth.", {
          estado: STATES.MENU_PRINCIPAL,
          campo_esperado: "producto_o_necesidad",
          intentos_fallidos: Number(memory.intentos_fallidos || 0) + 1
        });
      }
      const patch = {
        estado: STATES.ESPERANDO_NECESIDAD,
        categoria: category,
        presupuesto_minimo: budget.presupuesto_minimo ?? memory.presupuesto_minimo ?? null,
        presupuesto_maximo: budget.presupuesto_maximo ?? memory.presupuesto_maximo ?? null,
        orden: budget.orden || memory.orden || "",
        uso_principal: need || memory.uso_principal || null,
        preferencias: [...new Set([...(memory.preferencias || []), ...prefs])],
        tipo_producto: text
      };
      const hasEnough = need || budget.presupuesto_maximo || budget.any || budget.orden || prefs.length || queryTokens(text).length >= 1;
      if (hasEnough) {
        setConversation(db, from, patch);
        return runSearch(db, from, { ...memory, ...patch }, text);
      }
      return askNeed(db, from, memory, category);
    }

    if (state === STATES.ESPERANDO_NECESIDAD) {
      const need = inferNeed(text) || text;
      const category = normalizeText(memory.categoria || "");
      const productLike = queryTokens(text).length >= 2 || /\b\d{2,}\w*\b/.test(n);
      if (productLike && /cargador|audio|cable|accesorio|controles|tv|smartwatch|radio|iluminacion|soporte/.test(category)) {
        const patch = {
          ...memory,
          estado: STATES.MOSTRANDO_PRODUCTOS,
          tipo_producto: text,
          uso_principal: need,
          preferencias: [...new Set([...(memory.preferencias || []), ...extractPreferences(text)])]
        };
        setConversation(db, from, patch);
        return runSearch(db, from, patch, text);
      }
      return reply(db, from, "Cual es tu presupuesto maximo aproximado? Puedes escribir, por ejemplo: hasta 1500000, entre 1 y 2 millones, lo mas economico o sin presupuesto.", {
        estado: STATES.ESPERANDO_PRESUPUESTO,
        uso_principal: need,
        tipo_producto: text,
        campo_esperado: "presupuesto_maximo"
      });
    }

    if (state === STATES.ESPERANDO_PRESUPUESTO) {
      const budget = parseBudget(text);
      if (!budget.any && !budget.orden && !budget.presupuesto_maximo && !budget.presupuesto_minimo) {
        return recovery(db, from, { ...memory, estado: state }, "presupuesto maximo. Ejemplo: hasta $1.500.000");
      }
      const patch = {
        ...memory,
        estado: STATES.ESPERANDO_PREFERENCIAS,
        presupuesto_minimo: budget.presupuesto_minimo ?? memory.presupuesto_minimo ?? null,
        presupuesto_maximo: budget.presupuesto_maximo ?? memory.presupuesto_maximo ?? null,
        orden: budget.orden || memory.orden || ""
      };
      setConversation(db, from, patch);
      return reply(db, from, "Tienes alguna marca o caracteristica preferida? Puedes responder Samsung, iPhone, bluetooth, original, buena camara o no tengo preferencia.", {
        ...patch,
        estado: STATES.ESPERANDO_PREFERENCIAS,
        campo_esperado: "preferencias"
      });
    }

    if (state === STATES.ESPERANDO_PREFERENCIAS) {
      const prefs = /no importa|sin preferencia|no tengo/.test(n) ? [] : extractPreferences(text);
      const patch = { ...memory, preferencias: [...new Set([...(memory.preferencias || []), ...prefs])], estado: STATES.MOSTRANDO_PRODUCTOS };
      setConversation(db, from, patch);
      return runSearch(db, from, patch, text);
    }

    if (state === STATES.MOSTRANDO_PRODUCTOS) {
      const correctedProduct = correctionProductFromText(text, memory);
      if (correctedProduct) {
        const patch = {
          ...memory,
          categoria: findCategory(db, correctedProduct) || memory.categoria || null,
          tipo_producto: correctedProduct,
          uso_principal: correctedProduct,
          productos_mostrados: [],
          producto_actual: null,
          resultOffset: 0
        };
        setConversation(db, from, patch);
        return runSearch(db, from, patch, correctedProduct);
      }
      if (isAvailabilityListRequest(text) && (memory.tipo_producto || memory.uso_principal || memory.categoria)) {
        return runSearch(db, from, { ...memory, resultOffset: 0 }, "");
      }
      if (/mostrar otros|ver otros|mas opciones|otros/.test(n)) {
        const nextMemory = { ...memory, resultOffset: Number(memory.resultOffset || 0) + 3 };
        setConversation(db, from, nextMemory);
        return runSearch(db, from, nextMemory, "");
      }
      if (/barato|economico/.test(n)) {
        const nextMemory = { ...memory, orden: "precio_ascendente", resultOffset: 0 };
        setConversation(db, from, nextMemory);
        return runSearch(db, from, nextMemory, text);
      }
      const shown = shownProducts(db, memory);
      const selected = selectShownProduct(db, memory, text) || findProductById(db, text) || (wantsAddToCart(text) && shown.length === 1 ? shown[0] : null);
      if (isImageRequest(text)) {
        const imageProduct = selected || (shown.length === 1 ? shown[0] : null);
        if (imageProduct) {
          return reply(db, from, productImageLinkReply(db, imageProduct), {
            estado: STATES.MOSTRANDO_PRODUCTOS,
            producto_actual: imageProduct.id,
            campo_esperado: "seleccion_producto",
            intentos_fallidos: 0
          });
        }
      }
      if (isProductInfoQuestion(text) && !selected && shown.length === 1) {
        return reply(db, from, productDetail(shown[0]), {
          estado: STATES.VIENDO_PRODUCTO,
          producto_actual: shown[0].id,
          campo_esperado: "accion_producto",
          intentos_fallidos: 0
        });
      }
      if (!selected && looksLikeProductRequest(text)) return searchFromText(db, from, memory, text);
      if (!selected) return recovery(db, from, { ...memory, estado: state }, "cual producto quieres revisar: primero, segundo, tercero o codigo");
      if (wantsAddToCart(text)) return addProductToCart(db, from, memory, selected, text);
      return reply(db, from, productDetail(selected), {
        estado: STATES.VIENDO_PRODUCTO,
        producto_actual: selected.id,
        campo_esperado: "accion_producto"
      });
    }

    if (state === STATES.VIENDO_PRODUCTO) {
      const product = findProductById(db, memory.producto_actual);
      if (!product) return resetConversation(db, from);
      if (isNo(text)) {
        return reply(db, from, "Listo, descartamos esa opcion. Dime que producto buscas y lo reviso en inventario.", {
          estado: STATES.MENU_PRINCIPAL,
          producto_actual: null,
          productos_mostrados: [],
          campo_esperado: "producto_o_necesidad",
          intentos_fallidos: 0
        });
      }
      if (isImageRequest(text)) {
        return reply(db, from, productImageLinkReply(db, product), {
          estado: STATES.VIENDO_PRODUCTO,
          producto_actual: product.id,
          campo_esperado: "accion_producto",
          intentos_fallidos: 0
        });
      }
      if (looksLikeProductRequest(text) && !wantsAddToCart(text) && !isProductInfoQuestion(text)) {
        return searchFromText(db, from, memory, text);
      }
      if (isProductInfoQuestion(text)) {
        return reply(db, from, productDetail(product), {
          estado: STATES.VIENDO_PRODUCTO,
          producto_actual: product.id,
          campo_esperado: "accion_producto",
          intentos_fallidos: 0
        });
      }
      if (/descuento|rebaja|mas barato|minimo/.test(n)) {
        return reply(db, from, `Puedo registrar tu solicitud para que un asesor revise si hay descuento disponible.\n\nEl precio actual registrado es ${money(productPrice(product))}.\n\nResponde ASESOR si quieres que lo revise una persona, o AGREGAR para continuar con el precio actual.`, {
          estado: STATES.VIENDO_PRODUCTO
        });
      }
      if (wantsAddToCart(text) || /^\d{1,3}$/.test(n) || /1\b/.test(n)) return addProductToCart(db, from, memory, product, text);
      if (/otro|ver otros/.test(n)) return runSearch(db, from, memory, "");
      if (isCheckoutOption(text)) return startCheckout(db, from, memory);
      return reply(db, from, productDetail(product), { estado: STATES.VIENDO_PRODUCTO });
    }

    if (state === STATES.CARRITO) {
      const unsupportedInCart = unsupportedProductLine(text);
      if (unsupportedInCart) {
        return reply(db, from, unsupportedProductReply(unsupportedInCart), { estado: STATES.CARRITO, campo_esperado: "accion_carrito", intentos_fallidos: 0 });
      }
      if (isAvailabilityListRequest(text) && (memory.tipo_producto || memory.uso_principal || memory.categoria)) {
        return runSearch(db, from, { ...memory, estado: STATES.MOSTRANDO_PRODUCTOS, resultOffset: 0 }, "");
      }
      if (/seguir|comprando|otro|1\b/.test(n)) return reply(db, from, mainMenu(db), { estado: STATES.MENU_PRINCIPAL, campo_esperado: "categoria" });
      if (/ver carrito|2\b/.test(n)) return reply(db, from, formatCart(cartItems(db)), { estado: STATES.CARRITO });
      if (isCheckoutOption(text)) return startCheckout(db, from, memory);
      if (looksLikeProductRequest(text)) return searchFromText(db, from, memory, text);
      return reply(db, from, "Te entiendo. Si quieres agregar otro producto, dime que buscas. Ejemplo: holder para carro, cable tipo C, cargador iPhone. Tambien puedes escribir VER CARRITO o FINALIZAR COMPRA.", {
        estado: STATES.CARRITO,
        campo_esperado: "accion_carrito",
        intentos_fallidos: Number(memory.intentos_fallidos || 0) + 1
      });
    }

    if (state === STATES.ESPERANDO_TIPO_ENTREGA) {
      const delivery = parseDeliveryChoice(text);
      if (!delivery) return recovery(db, from, { ...memory, estado: state }, "tipo de entrega");
      return reply(db, from, `¿Cómo deseas pagar?\n${paymentMenu(db)}`, {
        estado: STATES.ESPERANDO_METODO_PAGO,
        tipo_entrega: delivery.type,
        ciudad: delivery.city || null,
        campo_esperado: "metodo_pago"
      });
    }

    if (state === STATES.ESPERANDO_NOMBRE) {
      if (!text || /^\d+$/.test(text) || text.length < 2) return recovery(db, from, { ...memory, estado: state }, "nombre del cliente");
      return reply(db, from, "Gracias. Ahora escríbeme la cédula o NIT de quien realiza la compra.", {
        estado: STATES.ESPERANDO_DOCUMENTO,
        nombre_cliente: text,
        campo_esperado: "documento_cliente"
      });
    }

    if (state === STATES.ESPERANDO_DOCUMENTO) {
      const document = parseCustomerDocument(text);
      if (!document) return recovery(db, from, { ...memory, estado: state }, "cedula o NIT");
      return reply(db, from, "¿Cuál es el teléfono de contacto? Puedes responder ESTE MISMO NÚMERO si usamos el WhatsApp desde el que escribes.", {
        estado: STATES.ESPERANDO_TELEFONO,
        documento_cliente: document,
        campo_esperado: "telefono_contacto"
      });
    }

    if (state === STATES.ESPERANDO_TELEFONO) {
      const contactPhone = parseContactPhone(text, from);
      if (!contactPhone) return recovery(db, from, { ...memory, estado: state }, "telefono de contacto");
      const nextMemory = { ...memory, telefono_contacto: contactPhone };
      if (isPickupDelivery(memory.tipo_entrega)) {
        return completeDispatchData(db, from, nextMemory);
      }
      if (memory.ciudad) {
        return reply(db, from, `Perfecto. Tengo registrada la ciudad ${memory.ciudad}. Ahora escribe la direccion completa de entrega y una referencia del lugar.`, {
          estado: STATES.ESPERANDO_DIRECCION,
          telefono_contacto: contactPhone,
          campo_esperado: "direccion"
        });
      }
      return reply(db, from, "¿En qué ciudad o municipio debemos entregar el pedido?", {
        estado: STATES.ESPERANDO_CIUDAD,
        telefono_contacto: contactPhone,
        campo_esperado: "ciudad"
      });
    }

    if (state === STATES.ESPERANDO_CIUDAD) {
      if (!text || text.length < 2 || /^\d+$/.test(text)) return recovery(db, from, { ...memory, estado: state }, "ciudad de entrega");
      return reply(db, from, "Escribe la direccion completa de entrega y una referencia del lugar.", {
        estado: STATES.ESPERANDO_DIRECCION,
        ciudad: text,
        campo_esperado: "direccion"
      });
    }

    if (state === STATES.ESPERANDO_DIRECCION) {
      if (text.length < 10) {
        return reply(db, from, "Necesito una direccion un poco mas completa. Ejemplo: Calle 5 # 8-20, barrio Centro, casa de porton blanco.", {
          estado: STATES.ESPERANDO_DIRECCION,
          intentos_fallidos: Number(memory.intentos_fallidos || 0) + 1
        });
      }
      return completeDispatchData(db, from, memory, { direccion: text });
    }

    if (state === STATES.ESPERANDO_METODO_PAGO) {
      const payment = choosePayment(db, text);
      if (!payment) return recovery(db, from, { ...memory, estado: state }, "metodo de pago");
      const nextMemory = { ...memory, metodo_pago: payment };
      return reply(db, from, summaryText(db, nextMemory), {
        ...nextMemory,
        estado: STATES.RESUMEN_PEDIDO,
        campo_esperado: "confirmacion_final"
      });
    }

    if (state === STATES.RESUMEN_PEDIDO) {
      if (/modificar|cambiar/.test(n)) return reply(db, from, "¿Qué deseas modificar: entrega o método de pago?", { estado: STATES.ESPERANDO_ACLARACION, campo_esperado: "dato_a_modificar" });
      if (!/confirmar pedido|confirmo pedido|confirmar|correcto|si correcto|esta correcto/.test(n)) {
        return reply(db, from, "Para crear el pedido necesito confirmacion clara. Responde CONFIRMAR PEDIDO, MODIFICAR o CANCELAR.", { estado: STATES.RESUMEN_PEDIDO });
      }
      const order = buildOrderFromConversation(db, from, memory);
      db.orders.unshift(order);
      db.clearCart = true;
      const transfer = isTransferPayment(memory.metodo_pago);
      if (transfer) {
        return reply(db, from, `Pedido ${order.id} reservado.\nTotal: ${money(order.total)}\n\nDatos bancarios:\n${bankInfo(db)}\n\nCuando realices el pago, envia el comprobante por este WhatsApp. Cuando sea validado te pedire los datos para el despacho.`, {
          estado: STATES.ESPERANDO_COMPROBANTE,
          activeOrderId: order.id,
          campo_esperado: "comprobante_pago",
          modo_asesor: false
        });
      }
      return reply(db, from, `Pedido ${order.id} reservado por ${money(order.total)}.\n\nPara dejarlo listo para despacho, ¿a nombre de quién registramos el pedido?`, {
        estado: STATES.ESPERANDO_NOMBRE,
        activeOrderId: order.id,
        campo_esperado: "nombre_cliente",
        modo_asesor: false
      });
    }

    if (state === STATES.ESPERANDO_COMPROBANTE) {
      const order = findOrder(db, memory.activeOrderId) || activeOrder;
      if (!order) return resetConversation(db, from);
      if (!isPaymentProof(text, context)) {
        return reply(db, from, `Seguimos pendientes del comprobante del pedido ${order.id}. Puedes enviar imagen, documento o texto del soporte.`, {
          estado: STATES.ESPERANDO_COMPROBANTE,
          activeOrderId: order.id
        });
      }
      queuePaymentProof(db, order, text, context);
      return reply(db, from, `Comprobante recibido para tu pedido ${order.id}. Lo enviaremos a validacion de pago y te confirmaremos por este mismo WhatsApp apenas quede validado.`, {
        estado: STATES.PAGO_PENDIENTE_VERIFICACION,
        activeOrderId: order.id
      });
    }

    if (state === STATES.PAGO_PENDIENTE_VERIFICACION || state === STATES.PEDIDO_CONFIRMADO) {
      if (/compra nueva|nuevo pedido|hacer otro|otra compra/.test(n)) return resetConversation(db, from);
      return reply(db, from, orderStatusReply(db, from, text, memory), { estado: state });
    }

    if (state === STATES.ESPERANDO_ACLARACION) {
      if (/entrega/.test(n)) return reply(db, from, "Como deseas recibir tu pedido?\n1. Recoger en el local\n2. Domicilio en Pitalito\n3. Envio nacional", { estado: STATES.ESPERANDO_TIPO_ENTREGA, campo_esperado: "tipo_entrega" });
      if (/pago/.test(n)) return reply(db, from, `Como deseas pagar?\n${paymentMenu(db)}`, { estado: STATES.ESPERANDO_METODO_PAGO, campo_esperado: "metodo_pago" });
      if (looksLikeProductRequest(text)) return searchFromText(db, from, memory, text);
      return recovery(db, from, { ...memory, estado: state }, "dato a modificar");
    }

    if (/capital|chiste|partido|noticia|clima/.test(n)) {
      return reply(db, from, "Estoy disenado para ayudarte con productos, pedidos y servicios de VEGA IMPORTADORA.\n\nDeseas buscar un producto o hablar con un asesor?", { estado: STATES.MENU_PRINCIPAL });
    }

    return recovery(db, from, { ...memory, estado: state }, "una opcion valida");
  } catch (error) {
    console.error("Error controlado en botFlow:", error);
    return "Tu mensaje fue recibido, pero necesito reorganizar la conversacion para continuar. Escribe MENU para empezar de nuevo o ASESOR para hablar con una persona.";
  }
}

module.exports = {
  handleIncomingMessage,
  _test: {
    checkoutTotals,
    matchesRequestedProduct,
    mergePlannerProductQuery,
    scoreProduct,
    searchProducts
  }
};
