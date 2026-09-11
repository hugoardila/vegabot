const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const OPENAI_TRANSCRIPTIONS_URL = "https://api.openai.com/v1/audio/transcriptions";
const DEFAULT_OPENAI_MODEL = "gpt-5.6";
const DEFAULT_OPENAI_TIMEOUT_MS = 10000;
const { getWholesalePolicy } = require("./pricingPolicy");

async function enhanceBotReply(settings = {}, context = {}, options = {}) {
  if (!isAiEnabled(settings)) return context.answer;

  const apiKey = String(settings.aiApiKey || "").trim();
  if (!apiKey || shouldBypassAi(context.answer, options)) return context.answer;

  try {
    const prompt = buildRewritePrompt(settings, context);
    const text = await callOpenAI(settings, apiKey, [
      {
        role: "developer",
        content: `Eres el asesor conversacional de ${settings.businessName || "VEGA IMPORTADORA"} por WhatsApp. Tu unica tarea es convertir una respuesta segura del sistema en una respuesta natural, humana y comercial.`
      },
      { role: "user", content: prompt }
    ], {
      temperature: Number(settings.aiTemperature || 0.45),
      maxOutputTokens: 320
    });

    return sanitizeAiReply(text, context.answer);
  } catch (error) {
    console.error("OpenAI IA desactivada para este mensaje:", error.message);
    return context.answer;
  }
}

async function analyzeCustomerMessage(settings = {}, context = {}) {
  if (!isAiEnabled(settings)) return null;
  const apiKey = String(settings.aiApiKey || "").trim();
  if (!apiKey) return null;

  try {
    const text = await callOpenAI(settings, apiKey, [
      {
        role: "developer",
        content: `Eres el cerebro conversacional de ${settings.businessName || "VEGA IMPORTADORA"}. Interpreta lo que el cliente realmente quiere usando el mensaje, el historial, el carrito, el pedido y los productos disponibles. Responde solo JSON valido, sin markdown.`
      },
      { role: "user", content: buildPlannerPrompt(settings, context) }
    ], {
      temperature: 0.15,
      maxOutputTokens: 700,
      timeoutMs: 10000
    });

    return normalizePlan(parseJsonObject(text));
  } catch (error) {
    console.error("OpenAI no pudo interpretar el mensaje:", error.message);
    return null;
  }
}

async function generateConversationalReply(settings = {}, context = {}) {
  if (!isAiEnabled(settings)) return context.fallback || "";
  const apiKey = String(settings.aiApiKey || "").trim();
  if (!apiKey) return context.fallback || "";

  try {
    const text = await callOpenAI(settings, apiKey, [
      {
        role: "developer",
        content: `Eres un asesor real de ventas por WhatsApp de ${settings.businessName || "VEGA IMPORTADORA"}. Vendes tecnologia al detal y por mayor en Colombia.`
      },
      { role: "user", content: buildConversationalPrompt(settings, context) }
    ], {
      temperature: Number(settings.aiTemperature || 0.55),
      maxOutputTokens: 650
    });

    return sanitizeAiReply(text, context.fallback || "Te leo. Dame un poco mas de detalle y te ayudo a resolverlo.");
  } catch (error) {
    console.error("OpenAI no pudo responder:", error.message);
    return context.fallback || "";
  }
}

async function transcribeCustomerAudio(settings = {}, media = {}) {
  if (!isAiEnabled(settings)) return "";
  const apiKey = String(settings.aiApiKey || "").trim();
  if (!apiKey || !media.buffer?.length) return "";

  const contentType = String(media.contentType || "audio/ogg").split(";")[0];
  const filename = String(media.filename || `audio${extensionForAudio(contentType)}`);
  const form = new FormData();
  form.append("file", new Blob([media.buffer], { type: contentType }), filename);
  form.append("model", String(settings.aiTranscriptionModel || "gpt-4o-transcribe"));
  form.append("language", "es");
  form.append("response_format", "json");
  form.append(
    "prompt",
    `Conversacion de ventas de tecnologia de ${settings.businessName || "VEGA IMPORTADORA"} en Colombia. Conserva marcas, referencias, cantidades y modelos exactamente como se escuchan.`
  );

  try {
    const response = await fetch(OPENAI_TRANSCRIPTIONS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(Number(settings.aiMediaTimeoutMs || 25000))
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI transcription ${response.status}: ${errorText.slice(0, 220)}`);
    }
    const result = await response.json();
    return String(result.text || "").trim();
  } catch (error) {
    console.error("OpenAI no pudo transcribir el audio:", error.message);
    return "";
  }
}

async function analyzeCustomerImage(settings = {}, context = {}) {
  if (!isAiEnabled(settings)) return null;
  const apiKey = String(settings.aiApiKey || "").trim();
  const buffer = context.media?.buffer;
  if (!apiKey || !buffer?.length) return null;

  const contentType = String(context.media.contentType || "image/jpeg").split(";")[0];
  const imageUrl = `data:${contentType};base64,${Buffer.from(buffer).toString("base64")}`;
  try {
    const text = await callOpenAI(settings, apiKey, [
      {
        role: "developer",
        content: "Analiza imagenes recibidas por WhatsApp en una tienda de tecnologia. Describe solo lo visible y responde exclusivamente JSON valido, sin markdown."
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: buildImageAnalysisPrompt(settings, context)
          },
          {
            type: "input_image",
            image_url: imageUrl,
            detail: "high"
          }
        ]
      }
    ], {
      maxOutputTokens: 500,
      timeoutMs: Number(settings.aiMediaTimeoutMs || 15000)
    });
    return normalizeImageAnalysis(parseJsonObject(text));
  } catch (error) {
    console.error("OpenAI no pudo analizar la imagen:", error.message);
    return null;
  }
}

function isAiEnabled(settings = {}) {
  return settings.aiEnabled === true || settings.aiEnabled === "true" || settings.aiEnabled === "1" || settings.aiEnabled === 1;
}

async function callOpenAI(settings, apiKey, input, options = {}) {
  const model = getOpenAiModel(settings);
  const requestBody = {
    model,
    input,
    max_output_tokens: options.maxOutputTokens || 700
  };
  if (/^gpt-5/i.test(model)) {
    requestBody.reasoning = { effort: String(settings.aiReasoningEffort || "low") };
  } else {
    requestBody.temperature = options.temperature;
  }

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    signal: AbortSignal.timeout(Number(options.timeoutMs || settings.aiTimeoutMs || DEFAULT_OPENAI_TIMEOUT_MS)),
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI ${response.status}: ${errorText.slice(0, 220)}`);
  }

  const data = await response.json();
  return extractResponseText(data);
}

function getOpenAiModel(settings = {}) {
  return String(settings.aiModel || DEFAULT_OPENAI_MODEL).trim() || DEFAULT_OPENAI_MODEL;
}

function extractResponseText(data = {}) {
  if (typeof data.output_text === "string") return data.output_text.trim();
  const chunks = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") chunks.push(content.text);
      if (typeof content.output_text === "string") chunks.push(content.output_text);
    }
  }
  return chunks.join("").trim();
}

function buildRewritePrompt(settings, context) {
  const style = String(settings.aiStyle || "").trim();
  const products = formatProducts(context.products || context.candidates || [], 10);
  const cart = formatCart(context.cart);
  const history = formatConversation(context.recentConversation);
  const latestOrder = formatOrder(context.latestOrder);

  return `Reescribe la respuesta segura para que suene como un asesor humano, natural y conversacional por WhatsApp.

Reglas duras:
- Mantén exactamente los codigos, cantidades, precios, totales, stock, estados, datos bancarios, pedido, guia e instrucciones de validacion que vengan en la respuesta segura.
- Conserva completos y sin modificar todos los enlaces que aparezcan en la respuesta segura.
- No agregues productos, precios, descuentos, guias, disponibilidad ni promesas que no aparezcan en los datos.
- ${formatWholesaleRule(settings)}
- Si la respuesta segura dice que no hay disponibilidad, manten esa idea de forma natural y empatica. No propongas productos alternativos, categorias ni rutas nuevas salvo que la respuesta segura ya las incluya.
- Si la respuesta segura explica un producto, resume en maximo 2 ideas utiles. No copies fichas largas completas.
- Cuando falte una caracteristica tecnica, dilo de forma natural: "ese dato no aparece en la ficha, lo podemos validar".
- No cambies la etapa de la venta. Si pide datos, pide datos. Si espera comprobante, espera comprobante. Si responde estado de pedido, no ofrezcas catalogo.
- Si la respuesta segura trae una lista de productos, conserva las mismas referencias y orden. Puedes mejorar la introduccion y cierre.
- Si el cliente esta confundido, corrige con tacto y haz una pregunta concreta.
- Adapta el tono y el nivel de detalle a la forma de hablar del cliente y a sus correcciones anteriores, sin perder precision.
- Respeta el tipo exacto solicitado: cabina, parlante, diadema, radio, consola, control y cable no son intercambiables.
- Responde solo el mensaje final para el cliente, sin explicaciones internas.
- Maximo 480 caracteres. En WhatsApp responde corto, especifico y vendedor.

Estilo deseado:
${style || "Cercano, claro, profesional, colombiano, sin sonar acartonado ni exagerado."}

Mensaje del cliente:
${context.incomingText || "(sin texto)"}

Historial reciente:
${history || "Sin historial"}

Carrito:
${cart || "Vacio"}

Pedido:
${latestOrder}

Productos reales de contexto:
${products || "Sin productos necesarios para esta respuesta"}

Respuesta segura del sistema:
${context.answer || ""}`;
}

function buildConversationalPrompt(settings, context) {
  const products = formatProducts(context.candidates || [], 10);
  const cart = formatCart(context.cart);
  const history = formatConversation(context.recentConversation);
  const latestOrder = formatOrder(context.latestOrder);

  return `Responde como ChatGPT pero con rol de asesor de ventas de tecnologia al detal y por mayor para ${settings.businessName || "VEGA IMPORTADORA"} en Colombia.

Reglas:
- Usa solo datos reales del contexto.
- No inventes productos, precios, stock, estados, guias ni pagos.
- ${formatWholesaleRule(settings)}
- Si pregunta por pedido, responde con el estado del pedido y no vendas.
- Si quiere comprar, guia paso a paso y pide solo la informacion que falta.
- Si no entiendes, pregunta una cosa concreta.
- Usa el historial y la memoria para conservar preferencias y correcciones del cliente, pero da prioridad al mensaje actual cuando pide un producto diferente.
- Cabina, parlante, diadema, radio, consola, control y cable son productos diferentes. No sustituyas el solicitado por un accesorio o por algo relacionado.
- Maximo 700 caracteres.

Mensaje actual:
${context.incomingText || ""}

Historial:
${history || "Sin historial"}

Carrito:
${cart || "Vacio"}

Pedido:
${latestOrder}

Productos candidatos:
${products || "No hay candidatos seguros"}`;
}

function buildPlannerPrompt(settings, context) {
  const products = formatProducts(context.candidates || [], 15);
  const cart = formatCart(context.cart);
  const latestOrder = formatOrder(context.latestOrder);

  return `Analiza el mensaje del cliente de ${settings.businessName || "VEGA IMPORTADORA"} y devuelve SOLO JSON valido.

Intenciones permitidas:
greeting, product_search, product_question, product_images, add_to_cart, remove_from_cart, replace_cart, clear_cart, view_cart, checkout_confirm, customer_data, payment_proof, order_status, post_order_followup, new_order, catalog, human_help, unknown.

Reglas:
- Interpreta mala ortografia, abreviaciones y frases incompletas.
- Usa el historial para resolver referencias como "ese", "la segunda", "los disponibles", "eso era todo", "quita ese" o "como funciona".
- Si hay pedido activo y pregunta por pago, guia, envio, despacho, estado o dice que queda a la espera, usa order_status o post_order_followup.
- Si corrige "ese no", "elimina", "quita", "deja unicamente", usa remove_from_cart o replace_cart.
- Si pregunta que es, para que sirve, como funciona, compatibilidad o caracteristicas, usa product_question.
- Si pide foto, imagen, enlace, ver la referencia, ver el producto o verlo en la tienda, usa product_images.
- Si pide ver el contenido o total del carrito, usa view_cart.
- Si dice que termino, que eso es todo o que quiere cerrar el pedido, usa checkout_confirm.
- Si pide otro pedido despues de uno existente, usa new_order.
- selected_product_id/cart_product_id solo puede ser un codigo de candidatos o carrito.
- product_query debe ser una consulta corta y util para buscar inventario. Elimina saludos, verbos como vender/mostrar y palabras de relleno. Incluye sinonimos utiles solo cuando aclaren el producto.
- Conserva literalmente la familia especifica que menciona el cliente. Cabina, parlante, diadema, radio, consola, control y cable son productos diferentes: no reemplaces uno por otro.
- No sustituyas un producto ausente por un accesorio o por algo apenas relacionado. Si pide una consola, un cable o un control no son una consola; si pide una cabina, un tripode o un parlante pequeno no son una cabina.
- En una aclaracion como "algo mas grande" o "de varias pulgadas", conserva el producto del turno anterior en product_query.
- No inventes datos.

Esquema:
{
  "intent": "product_search",
  "confidence": 0.0,
  "product_query": "",
  "selected_product_id": "",
  "cart_product_id": "",
  "quantity": 1,
  "payment_method": "",
  "needs_clarification": false,
  "clarification_question": "",
  "customer_reply": ""
}

Mensaje:
${context.incomingText || ""}

Historial:
${formatConversation(context.recentConversation) || "Sin historial"}

Memoria:
${JSON.stringify(context.customerMemory || {}, null, 2)}

Pedido:
${latestOrder}

Carrito:
${cart || "Vacio"}

Candidatos:
${products || "Sin candidatos"}`;
}

function buildImageAnalysisPrompt(settings, context) {
  return `Analiza la imagen que envio un cliente de ${settings.businessName || "VEGA IMPORTADORA"}.

Determina si contiene:
- un producto o accesorio de tecnologia;
- una referencia, marca, modelo o texto util para buscar inventario;
- un comprobante de pago;
- un documento;
- otro contenido.

No confirmes pagos, precios, autenticidad ni disponibilidad. No inventes marca o modelo si no son visibles.

Devuelve este esquema JSON:
{
  "kind": "product|payment_proof|document|other",
  "summary": "descripcion breve y objetiva",
  "visible_text": "texto relevante visible",
  "product_query": "consulta corta para buscar el producto, o vacio",
  "confidence": 0.0
}

Texto o pie de foto enviado por el cliente:
${context.caption || "Sin texto"}

Historial reciente:
${formatConversation(context.recentConversation) || "Sin historial"}`;
}

function formatProducts(products = [], limit = 10) {
  return products
    .slice(0, limit)
    .map((item) => {
      const features = String(item.botFeatures || "").trim();
      const price1 = item.price1 ?? item.wholesalePrice ?? item.price ?? 0;
      const price2 = item.price2 ?? item.retailPrice ?? 0;
      return `${item.id}: ${item.name} | ${item.category || ""} | ${item.brand || ""} | Detal P2 ${formatMoney(price2)} | Mayorista P1 ${formatMoney(price1)} (aplica al cumplir la regla mayorista del pedido) | Stock ${item.availableStock ?? item.stock ?? ""}${features ? ` | Ficha: ${features.slice(0, 450)}` : ""}`;
    })
    .join("\n");
}

function formatCart(cart = {}) {
  return (cart.items || [])
    .map((item) => `${item.qty} x ${item.sku || item.id || item.productId}: ${item.name} | ${item.priceTier === "mayorista" ? "Mayorista P1" : "Detal P2"} ${formatMoney(item.price || item.unitPrice || 0)}`)
    .join("\n");
}

function formatConversation(conversation = []) {
  return conversation
    .slice(-12)
    .map((item) => `${item.from || item.sender}: ${item.text || ""}`)
    .join("\n");
}

function formatOrder(order) {
  if (!order) return "Sin pedido asociado";
  const guide = order.dispatch?.guide ? ` | Guia ${order.dispatch.guide}` : "";
  return `Pedido ${order.id}: estado ${order.status || ""}, pago ${order.paymentStatus || ""}, validacion ${order.validationStatus || ""}, total ${formatMoney(order.total || 0)}${guide}`;
}

function formatMoney(value) {
  const number = Number(value || 0);
  if (!number) return "$0";
  return `$${number.toLocaleString("es-CO")}`;
}

function formatWholesaleRule(settings = {}) {
  const policy = getWholesalePolicy(settings);
  return `Precio 2 es detal. Precio 1 es mayorista y solo aplica cuando el carrito tiene al menos ${policy.minimumReferences} referencias distintas con ${policy.minimumUnits} unidades cada una, suma ${policy.minimumTotalUnits} unidades o mas y el subtotal a precio detal supera ${formatMoney(policy.minimumAmount)}. Al cumplir todo, el carrito completo usa Precio 1. Ignora Precio 3.`;
}

function parseJsonObject(text = "") {
  const raw = String(text || "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function normalizePlan(plan) {
  if (!plan || typeof plan !== "object") return null;
  const allowed = new Set([
    "greeting",
    "product_search",
    "product_question",
    "product_images",
    "add_to_cart",
    "remove_from_cart",
    "replace_cart",
    "clear_cart",
    "view_cart",
    "checkout_confirm",
    "customer_data",
    "payment_proof",
    "order_status",
    "post_order_followup",
    "new_order",
    "catalog",
    "human_help",
    "unknown"
  ]);
  const intent = allowed.has(String(plan.intent || "")) ? String(plan.intent) : "unknown";
  return {
    intent,
    confidence: Number(plan.confidence || 0),
    productQuery: String(plan.product_query || plan.productQuery || "").trim(),
    selectedProductId: String(plan.selected_product_id || plan.selectedProductId || "").trim(),
    cartProductId: String(plan.cart_product_id || plan.cartProductId || plan.selected_product_id || "").trim(),
    quantity: Math.max(Number(plan.quantity || 1), 1),
    paymentMethod: String(plan.payment_method || plan.paymentMethod || "").trim().toLowerCase(),
    needsClarification: Boolean(plan.needs_clarification || plan.needsClarification),
    clarificationQuestion: String(plan.clarification_question || plan.clarificationQuestion || "").trim(),
    customerReply: String(plan.customer_reply || plan.customerReply || "").trim()
  };
}

function normalizeImageAnalysis(result) {
  if (!result || typeof result !== "object") return null;
  const allowedKinds = new Set(["product", "payment_proof", "document", "other"]);
  const kind = allowedKinds.has(String(result.kind || "")) ? String(result.kind) : "other";
  return {
    kind,
    summary: String(result.summary || "").trim().slice(0, 700),
    visibleText: String(result.visible_text || result.visibleText || "").trim().slice(0, 500),
    productQuery: String(result.product_query || result.productQuery || "").trim().slice(0, 240),
    confidence: Math.max(0, Math.min(Number(result.confidence || 0), 1))
  };
}

function extensionForAudio(contentType = "") {
  const type = String(contentType).toLowerCase();
  if (type.includes("mpeg") || type.includes("mp3")) return ".mp3";
  if (type.includes("mp4") || type.includes("m4a")) return ".m4a";
  if (type.includes("wav")) return ".wav";
  if (type.includes("webm")) return ".webm";
  return ".ogg";
}

function shouldBypassAi(answer = "", options = {}) {
  const text = String(answer || "");
  if (options.force) return false;
  if (!text.trim()) return true;
  return text.length > 2400;
}

function sanitizeAiReply(text, fallback) {
  const reply = String(text || "").trim().replace(/^["']|["']$/g, "");
  if (!reply) return fallback;
  if (reply.length > 900) return fallback;
  if (looksIncomplete(reply)) return fallback;
  if (isUnavailableAnswer(fallback) && !keepsUnavailableMeaning(reply)) return fallback;
  if (isUnavailableAnswer(fallback) && appearsToInventAlternatives(reply, fallback)) return fallback;
  return reply || fallback;
}

function isUnavailableAnswer(text = "") {
  return /no hay disponibilidad|no encuentro una coincidencia|no esta disponible|sin disponibilidad/i.test(String(text || ""));
}

function keepsUnavailableMeaning(text = "") {
  return /no hay|no tenemos|no esta disponible|sin disponibilidad|no aparece disponible|no lo tengo disponible|no lo encuentro disponible/i.test(String(text || ""));
}

function appearsToInventAlternatives(reply = "", fallback = "") {
  const replyText = String(reply || "");
  const fallbackText = String(fallback || "");
  const productCodeLike = /\b[A-Z0-9]{2,}(?:-[A-Z0-9]+)?\b/g;
  const replyCodes = new Set((replyText.match(productCodeLike) || []).filter((code) => !["VEGA", "IMPORTADORA"].includes(code)));
  const safeCodes = new Set(fallbackText.match(productCodeLike) || []);
  for (const code of replyCodes) {
    if (!safeCodes.has(code)) return true;
  }
  return /\b(te puedo ofrecer|te muestro|tenemos estas opciones|mira estas opciones|alternativa|similar|parecido)\b/i.test(replyText)
    && !/\b(si lo conoces|otra referencia|otro nombre|otra marca)\b/i.test(replyText);
}

function looksIncomplete(reply) {
  const text = String(reply || "").trim();
  if (!text) return true;
  if (/[,:;]$/.test(text)) return true;
  if (/\b(y|o|de|del|la|el|los|las|para|por|con|en|que|si)$/i.test(text)) return true;
  if (text.length > 90 && !/[.!?)]$/.test(text)) return true;
  return false;
}

module.exports = {
  DEFAULT_OPENAI_MODEL,
  enhanceBotReply,
  analyzeCustomerMessage,
  analyzeCustomerImage,
  generateConversationalReply,
  isAiEnabled,
  transcribeCustomerAudio
};
