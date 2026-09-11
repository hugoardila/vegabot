let state = {};
let selectedCustomerId = null;
let selectedOrderId = null;
let pendingAttachment = null;
let isLoadingData = false;
let lastSnapshot = "";
let orderModalOpen = false;
let customerModalOpen = false;
let twilioTemplates = [];
let templatesLoading = false;
let templatePanelOpen = false;
let activeSettingsModal = null;
const allAdminViews = ["dashboard", "clientes", "pedidos", "inventario", "facturas", "config", "tienda"];

const money = (value) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(value || 0);

const titles = {
  dashboard: "Panel comercial",
  clientes: "Clientes y atencion manual",
  pedidos: "Pedidos y despacho",
  inventario: "Inventario profesional",
  facturas: "Facturas SAINT del bot",
  config: "Ajustes del sistema",
  tienda: "Tienda online"
};

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function cssEscape(value) {
  if (window.CSS?.escape) return window.CSS.escape(String(value || ""));
  return String(value || "").replace(/["\\]/g, "\\$&");
}

function attachmentLabel(type) {
  const labels = { image: "Imagen", audio: "Audio", video: "Video", file: "Documento" };
  return labels[type] || "Adjunto";
}

async function loadData() {
  if (isLoadingData) return;
  isLoadingData = true;
  try {
    const response = await fetch("/api/dashboard");
    const nextState = await response.json().catch(() => ({}));
    if (response.status === 401) {
      window.location.href = "/login";
      return;
    }
    if (!response.ok) throw new Error(nextState.error || "No fue posible cargar el panel.");
    const nextSnapshot = JSON.stringify({
      user: [nextState.user?.id, nextState.user?.role, nextState.user?.name],
      customers: nextState.customers.map((item) => [item.id, item.status, item.lastMessage, item.lastContact, item.manualAttention]),
      conversations: nextState.conversations.map((item) => [item.id, item.customerId, item.from, item.text, item.time]),
      orders: nextState.orders.map((item) => [
        item.id,
        item.status,
        item.paymentStatus,
        item.validationStatus,
        item.inventoryDeducted,
        item.subtotal,
        item.freight,
        item.total,
        item.customerDocument,
        item.contactPhone,
        item.customerCity,
        item.deliveryType,
        item.deliveryAddress,
        item.requestedText,
        item.internalNotes,
        item.dispatch?.carrier,
        item.dispatch?.guide,
        item.dispatch?.city,
        item.dispatch?.address,
        item.dispatch?.notes,
        item.items?.map((orderItem) => [
          orderItem.sku,
          orderItem.name,
          orderItem.qty,
          orderItem.price,
          orderItem.lineTotal,
          orderItem.stockSnapshot,
          orderItem.status
        ]),
        item.updatedAt
      ]),
      saintInvoices: (nextState.saintInvoices || []).map((item) => [
        item.id,
        item.orderId,
        item.status,
        item.attempts,
        item.notificationAttempts,
        item.invoiceNumber,
        item.lastError,
        item.lastAttemptAt,
        item.nextAttemptAt,
        item.updatedAt
      ]),
      adminUsers: (nextState.adminUsers || []).map((item) => [
        item.id,
        item.name,
        item.email,
        item.role,
        item.status
      ]),
      products: nextState.products.map((item) => [
        item.id,
        item.name,
        item.category,
        item.brand,
        item.stock,
        item.wholesalePrice,
        item.retailPrice,
        item.botPrice,
        item.storePrice,
        item.status,
        item.updatedAt
      ])
    });
    state = nextState;
    applyAccessControl();
    if (!state.customers.some((customer) => customer.id === selectedCustomerId)) {
      selectedCustomerId = null;
      customerModalOpen = false;
    }
    if (selectedOrderId && !state.orders.some((order) => order.id === selectedOrderId)) {
      selectedOrderId = null;
      orderModalOpen = false;
    }
    if (nextSnapshot !== lastSnapshot) {
      render();
      lastSnapshot = nextSnapshot;
    }
  } finally {
    isLoadingData = false;
  }
}

function setView(view) {
  if (!allowedAdminViews().includes(view)) return;
  if (view !== "config" && activeSettingsModal) closeSettingsModal();
  document.querySelectorAll(".view").forEach((item) => item.classList.toggle("active", item.id === view));
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === view));
  document.querySelector("#viewTitle").textContent = titles[view] || "Panel";
}

function allowedAdminViews() {
  const allowed = state.permissions?.allowedViews;
  return Array.isArray(allowed) && allowed.length ? allowed : allAdminViews;
}

function applyAccessControl() {
  const allowed = allowedAdminViews();
  document.body.dataset.adminRole = state.user?.role || "";
  document.querySelectorAll("[data-view]").forEach((item) => {
    item.hidden = !allowed.includes(item.dataset.view);
  });
  document.querySelectorAll("[data-go]").forEach((item) => {
    item.hidden = !allowed.includes(item.dataset.go);
  });
  document.querySelectorAll(".view").forEach((item) => {
    item.hidden = !allowed.includes(item.id);
  });
  const activeView = document.querySelector(".view.active")?.id || "";
  if (!allowed.includes(activeView)) setView(allowed[0] || "clientes");
  const usersEntry = document.querySelector("#botUsersEntry");
  if (usersEntry) usersEntry.hidden = !state.permissions?.canManageUsers;
  document.querySelector("#adminSessionName").textContent = state.user?.name || "Usuario";
  document.querySelector("#adminSessionRole").textContent = state.user?.roleLabel || roleLabel(state.user?.role);
}

function render() {
  renderMetrics();
  renderRecentOrders();
  renderAttentionCustomers();
  renderCustomers();
  renderConversation();
  renderOrders();
  renderOrderForm();
  renderInventory();
  renderInvoices();
  renderSettings();
  renderAdminUsers();
}

function renderMetrics() {
  const pendingOrders = state.orders.filter((order) => ["Pendiente comprobante", "Pendiente validacion"].includes(order.status)).length;
  const manualCustomers = state.customers.filter((customer) => /manual|humano|Requiere/i.test(customer.status)).length;
  const stockValue = state.products.reduce((sum, product) => sum + product.stock * product.wholesalePrice, 0);
  const monthSales = state.orders.reduce((sum, order) => sum + order.total, 0);
  document.querySelector("#metrics").innerHTML = [
    ["Pedidos pendientes", pendingOrders],
    ["Clientes para asesor", manualCustomers],
    ["Referencias inventario", state.products.length],
    ["Valor pedidos", money(monthSales)]
  ]
    .map(([label, value]) => `<article class="metric"><span>${label}</span><strong>${value}</strong></article>`)
    .join("");
}

function renderRecentOrders() {
  if (!state.orders.length) {
    document.querySelector("#recentOrders").innerHTML = `<article class="empty-state">Aun no hay pedidos. Cuando el bot confirme una compra por WhatsApp, aparecera aqui.</article>`;
    return;
  }
  document.querySelector("#recentOrders").innerHTML = state.orders
    .slice(0, 4)
    .map(
      (order) => `<article class="item">
        <div class="item-row"><strong>${order.id}</strong><span class="badge">${order.status}</span></div>
        <p class="muted">${order.customerName} | ${order.items.length} item(s) | ${order.channel || "whatsapp"} | ${money(order.total)}</p>
      </article>`
    )
    .join("");
}

function renderAttentionCustomers() {
  const customers = state.customers.filter((customer) => customer.status !== "Atencion bot");
  if (!customers.length) {
    document.querySelector("#attentionCustomers").innerHTML = `<article class="empty-state">No hay clientes pendientes de atencion.</article>`;
    return;
  }
  document.querySelector("#attentionCustomers").innerHTML = customers
    .map(
      (customer) => `<article class="item">
        <div class="item-row"><strong>${customer.name}</strong><span class="badge">${customer.status}</span></div>
        <p class="muted">${customer.company} | ${customer.lastMessage}</p>
      </article>`
    )
    .join("");
}

function renderCustomers() {
  const query = (document.querySelector("#customerSearch")?.value || "").toLowerCase();
  const customers = state.customers
    .filter((customer) => `${customer.name} ${customer.company} ${customer.phone}`.toLowerCase().includes(query))
  if (!customers.length) {
    document.querySelector("#customersList").innerHTML = `<article class="empty-state">No hay clientes para mostrar.</article>`;
    return;
  }
  document.querySelector("#customersList").innerHTML = customers
    .map(
      (customer) => `<article class="customer-card compact-customer-card ${customer.id === selectedCustomerId && customerModalOpen ? "active" : ""}" data-customer="${escapeHtml(customer.id)}">
        <div class="customer-card-main">
          <strong>${escapeHtml(customer.name || "Cliente WhatsApp")}</strong>
          <button class="primary-btn open-customer-btn" type="button">Abrir chat</button>
        </div>
      </article>`
    )
    .join("");
}

function renderConversation() {
  const customer = state.customers.find((item) => item.id === selectedCustomerId);
  const messages = state.conversations.filter((item) => item.customerId === selectedCustomerId);
  const modal = document.querySelector("#customerModal");
  if (modal) modal.hidden = !customerModalOpen;
  updateModalLock();
  document.querySelector("#chatTitle").textContent = customer ? `${customer.name} | ${customer.company}` : "Conversacion";
  document.querySelector("#chatSubtitle").textContent = customer?.manualAttention
    ? "Atencion manual activa: el bot no respondera a este cliente."
    : "Bot activo: responde automaticamente si el cliente escribe.";
  document.querySelector("#manualAttentionToggle").checked = Boolean(customer?.manualAttention);
  if (!customer) {
    document.querySelector("#conversation").innerHTML = `<article class="empty-state">Selecciona un cliente para ver la conversacion.</article>`;
    return;
  }
  document.querySelector("#conversation").innerHTML = messages
    .map((message) => renderMessageBubble(message))
    .join("");
  document.querySelector("#conversation").scrollTop = document.querySelector("#conversation").scrollHeight;
}

function renderMessageBubble(message) {
  const type = message.type || "text";
  const mediaName = message.mediaName || message.mediaUrl || attachmentLabel(type);
  const media = renderMessageMedia(type, message.mediaUrl, mediaName, message.mediaMeta);
  return `<div class="bubble ${escapeHtml(message.from)}">
    <strong>${escapeHtml(message.from)}</strong><br>
    ${escapeHtml(message.text || "")}
    ${media}
    <small>${escapeHtml(message.time || "")}</small>
  </div>`;
}

function renderMessageMedia(type, rawUrl, mediaName, mediaMeta) {
  if (type === "text") return "";
  const url = safeMediaUrl(rawUrl);
  const label = attachmentLabel(type);
  let preview = `<div class="media-icon">${escapeHtml(label)}</div>`;
  if (url && type === "image") {
    preview = `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">
      <img class="chat-media-image" src="${escapeHtml(url)}" alt="${escapeHtml(mediaName || label)}" loading="lazy">
    </a>`;
  } else if (url && type === "audio") {
    preview = `<audio class="chat-media-audio" controls preload="metadata" src="${escapeHtml(url)}"></audio>`;
  } else if (url && type === "video") {
    preview = `<video class="chat-media-video" controls preload="metadata" src="${escapeHtml(url)}"></video>`;
  } else if (url) {
    preview = `<a class="chat-media-file" href="${escapeHtml(url)}" target="_blank" rel="noopener">Abrir documento</a>`;
  }
  return `<div class="message-media">
    ${preview}
    <div class="message-media-info">
      <strong>${escapeHtml(mediaName || label)}</strong>
      <span class="muted">${escapeHtml(mediaMeta || "Adjunto guardado en la conversacion")}</span>
    </div>
  </div>`;
}

function safeMediaUrl(value) {
  const raw = String(value || "").trim();
  if (raw.startsWith("/")) return raw;
  if (/^https:\/\//i.test(raw)) return raw;
  return "";
}

function renderOrders() {
  const filter = document.querySelector("#orderFilter")?.value || "todos";
  const orders = state.orders.filter((order) => filter === "todos" || order.status === filter);
  if (!orders.length) {
    document.querySelector("#ordersList").innerHTML = `<article class="empty-state">No hay pedidos en este filtro.</article>`;
    return;
  }
  document.querySelector("#ordersList").innerHTML = orders
    .map(
      (order) => `<article class="order-card compact-order-card ${order.id === selectedOrderId && orderModalOpen ? "active" : ""}" data-order="${escapeHtml(order.id)}">
        <div class="order-head">
          <div>
            <strong>Pedido ${escapeHtml(order.id.replace(/^PED-?/i, ""))}, ${escapeHtml(order.customerName || "Cliente")}</strong>
            <span class="muted card-tap-hint">Toca para ver y validar</span>
          </div>
          <div class="card-actions">
            <span class="badge">${escapeHtml(order.status)}</span>
            <button class="ghost-btn open-order-btn" type="button">Ver y validar</button>
          </div>
        </div>
        <p class="muted">${escapeHtml(order.phone)} | ${escapeHtml(order.items.length)} item(s) | ${money(order.total)}</p>
        <div class="order-meta">
          <span>${escapeHtml(order.paymentStatus || "Por confirmar")}</span>
          <span>${escapeHtml(order.validationStatus || "pendiente_validacion")}</span>
          <span>${order.inventoryDeducted ? "Inventario descontado" : "Inventario sin descontar"}</span>
          <span>${escapeHtml(order.priority || "normal")}</span>
        </div>
      </article>`
    )
    .join("");
}

function renderOrderForm() {
  const order = state.orders.find((item) => item.id === selectedOrderId);
  const modal = document.querySelector("#orderModal");
  if (modal) modal.hidden = !orderModalOpen;
  updateModalLock();
  document.querySelector("#selectedOrderBadge").textContent = order?.id || "Sin pedido";
  if (!order) {
    document.querySelector("#orderSummary").innerHTML = "";
    document.querySelector("#orderModalTitle").textContent = "Pedido";
    return;
  }
  document.querySelector("#orderModalTitle").textContent = `Pedido ${order.id.replace(/^PED-?/i, "")}, ${order.customerName || "Cliente"}`;
  document.querySelector("#orderSummary").innerHTML = renderOrderSummary(order);
  setSelectValue(document.querySelector("#orderStatus"), order.status, "Pendiente validacion");
  setSelectValue(document.querySelector("#paymentStatus"), order.paymentStatus, "Por confirmar");
  setSelectValue(document.querySelector("#validationStatus"), order.validationStatus, "pendiente_validacion");
  setSelectValue(document.querySelector("#priority"), order.priority, "normal");
  const dispatch = order.dispatch || {};
  document.querySelector("#carrier").value = dispatch.carrier || "";
  document.querySelector("#guide").value = dispatch.guide || "";
  document.querySelector("#city").value = dispatch.city || order.customerCity || "";
  document.querySelector("#address").value = dispatch.address || order.deliveryAddress || "";
  document.querySelector("#dispatchNotes").value = dispatch.notes || "";
  document.querySelector("#internalNotes").value = order.internalNotes || "";
}

function setSelectValue(select, value, fallback) {
  const selectedValue = String(value || fallback || "").trim();
  if (!select || !selectedValue) return;
  const hasOption = [...select.options].some((option) => option.value === selectedValue);
  if (!hasOption) {
    const option = document.createElement("option");
    option.value = selectedValue;
    option.textContent = selectedValue;
    select.append(option);
  }
  select.value = selectedValue;
}

function renderOrderSummary(order) {
  const dispatch = order.dispatch || {};
  const items = Array.isArray(order.items) ? order.items : [];
  const city = dispatch.city || order.customerCity || "Sin registrar";
  const address = dispatch.address || order.deliveryAddress || "Sin registrar";
  const subtotal = Number(order.subtotal || 0);
  const freight = Number(order.freight || 0);
  const total = Number(order.total || subtotal + freight);
  return `<div class="summary-grid">
    <div><span>Cliente</span><strong>${escapeHtml(order.customerName)}</strong></div>
    <div><span>WhatsApp</span><strong>${escapeHtml(order.phone)}</strong></div>
    <div><span>Documento</span><strong>${escapeHtml(order.customerDocument || "Sin registrar")}</strong></div>
    <div><span>Telefono de contacto</span><strong>${escapeHtml(order.contactPhone || "Sin registrar")}</strong></div>
    <div><span>Canal</span><strong>${escapeHtml(order.channel || "whatsapp")}</strong></div>
    <div><span>Origen</span><strong>${escapeHtml(order.source || order.botStatus || "bot")}</strong></div>
    <div><span>Fecha</span><strong>${escapeHtml(order.createdAt || "")}</strong></div>
    <div><span>Pago</span><strong>${escapeHtml(order.paymentStatus || "Por confirmar")}</strong></div>
    <div><span>Tipo de entrega</span><strong>${escapeHtml(order.deliveryType || "Sin registrar")}</strong></div>
    <div><span>Ciudad</span><strong>${escapeHtml(city)}</strong></div>
    <div><span>Direccion</span><strong>${escapeHtml(address)}</strong></div>
    <div><span>Inventario</span><strong>${order.inventoryDeducted ? "Descontado" : "Sin descontar"}</strong></div>
    <div><span>Validacion</span><strong>${escapeHtml(order.validationStatus || "pendiente_validacion")}</strong></div>
  </div>
  <div class="requested-text"><strong>Solicitud:</strong> ${escapeHtml(order.requestedText || "Pedido creado manualmente")}</div>
  <div class="order-items-table">
    <table>
      <thead><tr><th>Codigo</th><th>Producto</th><th>Cant.</th><th>Precio</th><th>Total</th><th>Stock</th><th>Estado</th></tr></thead>
      <tbody>${items
        .map(
          (item) => `<tr>
            <td data-label="Codigo">${escapeHtml(item.sku || "")}</td>
            <td data-label="Producto">${escapeHtml(item.name || "")}</td>
            <td data-label="Cantidad">${escapeHtml(item.qty || "")}</td>
            <td data-label="Precio">${money(item.price || 0)}</td>
            <td data-label="Total">${money(item.lineTotal || Number(item.qty || 1) * Number(item.price || 0))}</td>
            <td data-label="Stock">${escapeHtml(item.stockSnapshot ?? "")}</td>
            <td data-label="Estado">${escapeHtml(item.status || "pendiente_validacion")}</td>
          </tr>`
        )
        .join("")}</tbody>
    </table>
  </div>
  <div class="order-totals">
    <span>Subtotal <strong>${money(subtotal)}</strong></span>
    <span>Envio <strong>${freight ? money(freight) : "Sin costo"}</strong></span>
    <span class="grand-total">Total <strong>${money(total)}</strong></span>
  </div>`;
}

function renderInventory() {
  const categorySelect = document.querySelector("#categoryFilter");
  if (categorySelect) {
    const currentCategory = categorySelect.value || "todas";
    categorySelect.innerHTML = `<option value="todas">Todas las categorias</option>${state.categories
      .map((category) => `<option value="${escapeHtml(category.name)}">${escapeHtml(category.name)}</option>`)
      .join("")}`;
    categorySelect.value = [...categorySelect.options].some((option) => option.value === currentCategory) ? currentCategory : "todas";
    categorySelect.dataset.ready = "true";
  }
  const categoryOptions = document.querySelector("#categoryOptions");
  if (categoryOptions) {
    categoryOptions.innerHTML = state.categories
      .map((category) => `<option value="${escapeHtml(category.name)}"></option>`)
      .join("");
  }
  const category = categorySelect?.value || "todas";
  const query = (document.querySelector("#inventorySearch")?.value || "").toLowerCase();
  const products = state.products.filter((product) => {
    const matchCategory = category === "todas" || product.category === category;
    const matchQuery = `${product.id} ${product.storeName || ""} ${product.saintName || product.name} ${product.category}`.toLowerCase().includes(query);
    return matchCategory && matchQuery;
  });
  const inventorySource = state.settings?.inventorySource || "mysql:vegabot";
  const isSaintInventory = inventorySource === "saint:bodega";
  const sourceLabel = isSaintInventory
    ? `Inventario Saint/Bodega conectado (${state.settings?.saintInventoryCount || state.products.length} referencias)`
    : "Inventario local VegaBot";
  document.querySelector("#inventoryCount").textContent = `${products.length} de ${state.products.length} referencias - ${sourceLabel}`;
  const saintReadonly = isSaintInventory ? "readonly aria-readonly=\"true\" title=\"Dato leído directamente desde SAINT\"" : "";
  document.querySelector("#inventoryTable").innerHTML = `<table>
    <caption class="inventory-source ${isSaintInventory ? "source-saint" : "source-local"}">
      ${escapeHtml(sourceLabel)}${isSaintInventory ? " - lectura directa desde SQL Server Saint. La app no modifica esa base." : ""}
    </caption>
    <thead><tr><th>Codigo</th><th>Nombre tienda</th><th>Ref. SAINT</th><th>Categoria</th><th>Bodega</th><th>Existencia</th><th>Precio 1 mayorista</th><th>Precio 2 detal</th><th></th></tr></thead>
    <tbody>${products
      .map(
        (product) => `<tr class="inventory-row" data-product="${escapeHtml(product.id)}">
          <td><strong>${escapeHtml(product.id)}</strong></td>
          <td><input class="cell-input product-store-name" value="${escapeHtml(product.storeName || (isSaintInventory ? "SIN NOMBRE" : product.name))}" /></td>
          <td><small class="muted saint-reference">${escapeHtml(product.saintName || product.name)}</small></td>
          <td><input class="cell-input product-category" list="categoryOptions" value="${escapeHtml(product.category || "General")}" ${saintReadonly} /></td>
          <td><span class="source-chip">${escapeHtml(product.deposito || product.source || "Local")}</span></td>
          <td><input class="cell-input numeric product-stock ${product.stock < 15 ? "stock-low" : "stock-ok"}" type="number" min="0" value="${escapeHtml(product.stock)}" ${saintReadonly} /></td>
          <td><input class="cell-input numeric product-wholesale" type="number" min="0" step="100" value="${escapeHtml(product.price1 ?? product.wholesalePrice ?? 0)}" ${saintReadonly} /></td>
          <td><input class="cell-input numeric product-retail" type="number" min="0" step="100" value="${escapeHtml(product.price2 ?? product.retailPrice ?? 0)}" ${saintReadonly} /></td>
          <td><button class="ghost-btn save-product" type="button">${isSaintInventory ? "Guardar ficha" : "Guardar"}</button></td>
        </tr>
        <tr class="inventory-row knowledge-row" data-product="${escapeHtml(product.id)}">
          <td></td>
          <td colspan="8">
            <label class="knowledge-label">Características para el bot</label>
            <textarea class="cell-input product-bot-features" placeholder="Qué es, para qué sirve, cómo funciona, compatibilidad, características, recomendaciones y dudas frecuentes.">${escapeHtml(product.botFeatures || "")}</textarea>
          </td>
        </tr>`
      )
      .join("")}</tbody>
  </table>`;
}

function renderInvoices() {
  const list = document.querySelector("#invoicesList");
  if (!list) return;
  const filter = document.querySelector("#invoiceFilter")?.value || "todos";
  const invoices = (state.saintInvoices || []).filter((invoice) => filter === "todos" || invoice.status === filter);
  if (!invoices.length) {
    list.innerHTML = `<article class="empty-state">No hay facturas del bot en este estado.</article>`;
    return;
  }

  list.innerHTML = invoices.map((invoice) => {
    const payload = invoice.payload || {};
    const status = invoiceStatus(invoice.status);
    const hasInvoice = Boolean(invoice.invoiceNumber);
    const actionLabel = invoice.status === "invoice_created" ? "Enviar notificacion" : "Enviar a SAINT";
    const button = invoice.status === "completed"
      ? `<button class="ghost-btn invoice-send-btn" type="button" disabled>Completada</button>`
      : `<button class="primary-btn invoice-send-btn" type="button" data-send-invoice="${escapeHtml(invoice.id)}">${actionLabel}</button>`;
    return `<article class="invoice-card" data-invoice-status="${escapeHtml(invoice.status)}">
      <div class="invoice-card-head">
        <div>
          <span class="invoice-kicker">${hasInvoice ? `Factura ${escapeHtml(invoice.invoiceType || "G")}-${escapeHtml(invoice.invoiceNumber)}` : "Factura G pendiente"}</span>
          <strong>Pedido ${escapeHtml(invoice.orderId)}</strong>
          <span class="muted">${escapeHtml(payload.customer_name || "Cliente WhatsApp")}</span>
        </div>
        <span class="badge invoice-status ${escapeHtml(status.className)}">${escapeHtml(status.label)}</span>
      </div>
      <div class="invoice-data">
        <div><span>Total</span><strong>${money(payload.total_amount || 0)}</strong></div>
        <div><span>Creada en cola</span><strong>${formatDateTime(invoice.createdAt)}</strong></div>
        <div><span>Intentos SAINT</span><strong>${escapeHtml(String(invoice.attempts ?? 0))}</strong></div>
        <div><span>Intentos de aviso</span><strong>${escapeHtml(String(invoice.notificationAttempts ?? 0))}</strong></div>
        <div><span>Ultimo intento</span><strong>${formatDateTime(invoice.lastAttemptAt)}</strong></div>
        <div><span>Proximo intento</span><strong>${invoice.status === "completed" ? "No aplica" : formatDateTime(invoice.nextAttemptAt)}</strong></div>
      </div>
      ${invoice.lastError ? `<div class="invoice-error"><strong>Ultimo error:</strong> ${escapeHtml(invoice.lastError)}</div>` : ""}
      <div class="invoice-card-actions">
        <span class="muted">${invoice.status === "pending" ? "El envio manual intenta crear la Factura G inmediatamente." : invoice.status === "invoice_created" ? "La factura ya existe; solo se reintentara el aviso por WhatsApp." : `Notificada ${formatDateTime(invoice.notifiedAt)}.`}</span>
        ${button}
      </div>
    </article>`;
  }).join("");
}

function invoiceStatus(status) {
  if (status === "completed") return { label: "Creada y notificada", className: "is-completed" };
  if (status === "invoice_created") return { label: "Aviso pendiente", className: "is-created" };
  return { label: "Pendiente de SAINT", className: "is-pending" };
}

function formatDateTime(value) {
  if (!value) return "Sin registro";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

async function sendBotInvoice(invoiceId, button) {
  const invoice = (state.saintInvoices || []).find((item) => String(item.id) === String(invoiceId));
  if (!invoice) return;
  const prompt = invoice.status === "invoice_created"
    ? `La Factura ${invoice.invoiceType || "G"}-${invoice.invoiceNumber} ya existe. Se reintentara solamente la notificacion por WhatsApp.`
    : `Se intentara crear ahora la Factura G del pedido ${invoice.orderId} en SAINT.`;
  if (!window.confirm(`${prompt}\n\nDeseas continuar?`)) return;

  const previousLabel = button.textContent;
  button.disabled = true;
  button.textContent = "Procesando...";
  try {
    const response = await fetch(`/api/saint-invoices/${encodeURIComponent(invoiceId)}/send`, {
      method: "POST"
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      window.alert(payload.error || "No fue posible procesar la factura.");
      return;
    }
    const result = payload.result || {};
    if (result.alreadyCompleted) {
      window.alert("La factura ya estaba creada y notificada.");
    } else if (result.invoice?.numeroD && result.notification?.sent) {
      window.alert(`Factura ${result.invoice.tipoFac || "G"}-${result.invoice.numeroD} creada y notificada correctamente.`);
    } else if (result.invoice?.numeroD) {
      window.alert(`La Factura ${result.invoice.tipoFac || "G"}-${result.invoice.numeroD} ya esta en SAINT. La notificacion quedo pendiente de reintento.`);
    } else {
      window.alert("SAINT no confirmo la factura. Quedo pendiente para otro intento.");
    }
    lastSnapshot = "";
    await loadData();
    renderInvoices();
  } finally {
    button.disabled = false;
    button.textContent = previousLabel;
  }
}

function renderSettings() {
  const settings = state.settings || {};
  const settingsEditing = Boolean(activeSettingsModal);
  [
    "businessName",
    "whatsappNumber",
    "paymentValidatorNumber",
    "orderNotificationNumber",
    "accountSid",
    "authToken",
    "messagingServiceSid",
    "publicBaseUrl",
    "minimumWholesaleReferences",
    "minimumWholesaleUnits",
    "minimumWholesaleTotalUnits",
    "minimumWholesaleAmount",
    "paymentTerms",
    "bankInfo",
    "inventoryKey",
    "storeGoogleClientId",
    "wompiPublicKey",
    "wompiApiUrl",
    "wompiPrivateKey",
    "aiModel",
    "aiApiKey",
    "aiStyle"
  ].forEach((key) => {
    const input = document.querySelector(`#${key}`);
    if (input && !settingsEditing && document.activeElement !== input) input.value = settings[key] || "";
  });
  const aiEnabled = document.querySelector("#aiEnabled");
  if (aiEnabled && !settingsEditing) aiEnabled.checked = settings.aiEnabled === true || settings.aiEnabled === "true" || settings.aiEnabled === "1";
  const authInput = document.querySelector("#authToken");
  if (authInput && settings.authTokenConfigured) {
    authInput.placeholder = "Token configurado - escribe uno nuevo solo si deseas cambiarlo";
  }
  const aiApiKeyInput = document.querySelector("#aiApiKey");
  if (aiApiKeyInput && settings.aiApiKeyConfigured) {
    aiApiKeyInput.placeholder = "Clave OpenAI configurada - escribe una nueva solo si deseas cambiarla";
  }
  const wompiPrivateKeyInput = document.querySelector("#wompiPrivateKey");
  if (wompiPrivateKeyInput && settings.wompiPrivateKeyConfigured) {
    wompiPrivateKeyInput.placeholder = "Llave privada Wompi configurada - escribe una nueva solo si deseas cambiarla";
  }
  const inventoryKeyInput = document.querySelector("#inventoryKey");
  if (inventoryKeyInput) {
    if (!settingsEditing && document.activeElement !== inventoryKeyInput) inventoryKeyInput.value = "";
    inventoryKeyInput.placeholder = settings.inventoryKeyConfigured ? "Clave configurada - escribe una nueva para cambiarla" : "6 digitos";
  }
  document.querySelector("#webhookUrl").textContent = state.webhookUrl || "";
  document.querySelector("#brandName").textContent = settings.businessName || "VEGA IMPORTADORA";
  document.querySelector("#brandMark").textContent = getBrandInitials(settings.businessName || "VEGA IMPORTADORA");
  document.querySelector("#configBrandBadge").textContent = settings.businessName || "VEGA IMPORTADORA";
  document.querySelector("#topEyebrow").textContent = `${settings.businessName || "VEGA IMPORTADORA"} | WhatsApp B2B`;
  document.title = settings.businessName || "VEGA IMPORTADORA";
}

function renderAdminUsers() {
  const list = document.querySelector("#botUsersList");
  if (!list || !state.permissions?.canManageUsers) return;
  const users = state.adminUsers || [];
  const summary = document.querySelector("#usersSettingSummary");
  if (summary) summary.textContent = `${users.length} cuenta(s) configurada(s)`;
  if (!users.length) {
    list.innerHTML = `<article class="empty-state">No hay usuarios administrativos para mostrar.</article>`;
    return;
  }
  list.innerHTML = users.map((user) => {
    const current = String(user.id) === String(state.user?.id);
    const active = user.status !== false;
    return `<article class="bot-user-card">
      <div class="bot-user-main">
        <span class="bot-user-initial">${escapeHtml((user.name || "U").slice(0, 1).toUpperCase())}</span>
        <div>
          <strong>${escapeHtml(user.name)}</strong>
          <span>${escapeHtml(user.email)}</span>
        </div>
      </div>
      <div class="bot-user-meta">
        <span class="badge">${escapeHtml(user.roleLabel || roleLabel(user.role))}</span>
        <span class="badge ${active ? "user-active" : "user-inactive"}">${active ? "Activo" : "Inactivo"}</span>
      </div>
      <div class="bot-user-actions">
        <button class="ghost-btn" type="button" data-reset-bot-user="${escapeHtml(user.id)}">Cambiar clave</button>
        <button class="ghost-btn" type="button" data-toggle-bot-user="${escapeHtml(user.id)}" data-next-status="${active ? "false" : "true"}" ${current ? "disabled title=\"No puedes desactivar tu propia cuenta\"" : ""}>${active ? "Desactivar" : "Activar"}</button>
      </div>
    </article>`;
  }).join("");
}

function roleLabel(role) {
  return role === "admin" ? "Administrador" : "Asesor / Caja";
}

async function updateBotUser(userId, patch) {
  const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "No fue posible actualizar el usuario.");
  lastSnapshot = "";
  await loadData();
  return result.user;
}

function getBrandInitials(name) {
  return String(name || "VI")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

document.addEventListener("click", (event) => {
  const nav = event.target.closest("[data-view]");
  if (nav) setView(nav.dataset.view);

  const go = event.target.closest("[data-go]");
  if (go) setView(go.dataset.go);

  const openSettingsButton = event.target.closest("[data-open-settings]");
  if (openSettingsButton) {
    openSettingsModal(openSettingsButton.dataset.openSettings);
  }

  if (event.target.closest("[data-close-settings]")) {
    closeSettingsModal();
  }

  const settingsBackdrop = event.target.closest("[data-settings-modal]");
  if (settingsBackdrop && event.target === settingsBackdrop) {
    closeSettingsModal();
  }

  const customerCard = event.target.closest("[data-customer]");
  if (customerCard) {
    selectedCustomerId = customerCard.dataset.customer;
    customerModalOpen = true;
    renderCustomers();
    renderConversation();
    loadTwilioTemplates();
  }

  if (event.target.closest("#closeCustomerModal")) {
    closeCustomerModal();
  }

  const customerModalBackdrop = event.target.closest("#customerModal");
  if (customerModalBackdrop && event.target === customerModalBackdrop) {
    closeCustomerModal();
  }

  const orderCard = event.target.closest("[data-order]");
  if (orderCard) {
    selectedOrderId = orderCard.dataset.order;
    orderModalOpen = true;
    renderOrders();
    renderOrderForm();
  }

  if (event.target.closest("#closeOrderModal")) {
    closeOrderModal();
  }

  const modalBackdrop = event.target.closest("#orderModal");
  if (modalBackdrop && event.target === modalBackdrop) {
    closeOrderModal();
  }

  const attachmentButton = event.target.closest("[data-attachment]");
  if (attachmentButton) {
    pendingAttachment = { type: attachmentButton.dataset.attachment, name: "", meta: "", file: null };
    document.querySelector("#mediaInput").accept = acceptForAttachment(pendingAttachment.type);
    document.querySelector("#mediaInput").click();
  }

  const saveProductButton = event.target.closest(".save-product");
  if (saveProductButton) {
    saveInventoryRow(saveProductButton.closest(".inventory-row"));
  }

  const sendInvoiceButton = event.target.closest("[data-send-invoice]");
  if (sendInvoiceButton) {
    sendBotInvoice(sendInvoiceButton.dataset.sendInvoice, sendInvoiceButton);
  }

  const toggleBotUserButton = event.target.closest("[data-toggle-bot-user]");
  if (toggleBotUserButton) {
    const nextStatus = toggleBotUserButton.dataset.nextStatus === "true";
    const action = nextStatus ? "activar" : "desactivar";
    if (window.confirm(`Se va a ${action} esta cuenta del panel. Deseas continuar?`)) {
      toggleBotUserButton.disabled = true;
      updateBotUser(toggleBotUserButton.dataset.toggleBotUser, { status: nextStatus }).catch((error) => {
        toggleBotUserButton.disabled = false;
        window.alert(error.message);
      });
    }
  }

  const resetBotUserButton = event.target.closest("[data-reset-bot-user]");
  if (resetBotUserButton) {
    const password = window.prompt("Nueva contrasena para esta cuenta (minimo 10 caracteres):");
    if (password) {
      resetBotUserButton.disabled = true;
      updateBotUser(resetBotUserButton.dataset.resetBotUser, { password })
        .then(() => window.alert("Contrasena actualizada. Las sesiones anteriores fueron cerradas."))
        .catch((error) => {
          resetBotUserButton.disabled = false;
          window.alert(error.message);
        });
    }
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && orderModalOpen) closeOrderModal();
  if (event.key === "Escape" && customerModalOpen) closeCustomerModal();
  if (event.key === "Escape" && activeSettingsModal) closeSettingsModal();
});

function openSettingsModal(name) {
  if (!state.permissions?.canManageSettings) return;
  if (name === "users" && !state.permissions?.canManageUsers) return;
  const modal = document.querySelector(`[data-settings-modal="${cssEscape(name)}"]`);
  if (!modal) return;
  renderSettings();
  document.querySelectorAll("[data-settings-modal]").forEach((item) => {
    item.hidden = true;
  });
  activeSettingsModal = name;
  modal.hidden = false;
  updateModalLock();
}

function closeSettingsModal() {
  document.querySelectorAll("[data-settings-modal]").forEach((item) => {
    item.hidden = true;
  });
  activeSettingsModal = null;
  updateModalLock();
  renderSettings();
}

function closeOrderModal() {
  orderModalOpen = false;
  renderOrders();
  renderOrderForm();
}

function closeCustomerModal() {
  customerModalOpen = false;
  templatePanelOpen = false;
  pendingAttachment = null;
  document.querySelector("#mediaInput").value = "";
  renderAttachmentPreview();
  renderTemplatePanel();
  renderCustomers();
  renderConversation();
}

function updateModalLock() {
  document.body.classList.toggle("modal-open", orderModalOpen || customerModalOpen || Boolean(activeSettingsModal));
}

document.querySelector("#customerSearch").addEventListener("input", renderCustomers);
document.querySelector("#inventorySearch").addEventListener("input", renderInventory);
document.querySelector("#categoryFilter").addEventListener("change", renderInventory);
document.querySelector("#orderFilter").addEventListener("change", renderOrders);
document.querySelector("#invoiceFilter").addEventListener("change", renderInvoices);

document.querySelector("#manualAttentionToggle").addEventListener("change", async (event) => {
  if (!selectedCustomerId) return;
  await fetch(`/api/customers/${selectedCustomerId}/manual-attention`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled: event.target.checked })
  });
  await loadData();
  renderConversation();
});

document.querySelector("#toggleTemplatePanel").addEventListener("click", () => {
  templatePanelOpen = !templatePanelOpen;
  renderTemplatePanel();
  if (templatePanelOpen) loadTwilioTemplates();
});

document.querySelector("#sendTemplate").addEventListener("click", async () => {
  const select = document.querySelector("#twilioTemplateSelect");
  const contentSid = select.value;
  if (!selectedCustomerId || !contentSid) return;
  setTemplateStatus("Enviando plantilla...");
  const response = await fetch(`/api/customers/${selectedCustomerId}/send-template`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentSid })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    setTemplateStatus(result.error || "No se pudo enviar la plantilla.");
    return;
  }
  setTemplateStatus(`Plantilla enviada: ${result.template?.name || "Twilio"}`);
  await loadData();
});

document.querySelector("#twilioTemplateSelect").addEventListener("change", (event) => {
  const template = twilioTemplates.find((item) => item.sid === event.target.value);
  setTemplateStatus(template ? `Lista para enviar: ${template.name}` : "Selecciona una plantilla.");
});

async function loadTwilioTemplates(force = false) {
  if (templatesLoading) return;
  if (twilioTemplates.length && !force) {
    renderTemplateSelect();
    return;
  }
  templatesLoading = true;
  setTemplateStatus("Consultando plantillas en Twilio...");
  try {
    const response = await fetch("/api/twilio/templates");
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "No se pudieron cargar las plantillas.");
    twilioTemplates = result.templates || [];
    renderTemplateSelect();
    setTemplateStatus(twilioTemplates.length ? `${twilioTemplates.length} plantilla(s) disponibles.` : "No hay plantillas en Twilio.");
  } catch (error) {
    twilioTemplates = [];
    renderTemplateSelect();
    setTemplateStatus(error.message || "No se pudieron cargar las plantillas.");
  } finally {
    templatesLoading = false;
  }
}

function renderTemplateSelect() {
  const select = document.querySelector("#twilioTemplateSelect");
  if (!select) return;
  if (!twilioTemplates.length) {
    select.innerHTML = `<option value="">Sin plantillas disponibles</option>`;
    return;
  }
  select.innerHTML = `<option value="">Seleccionar plantilla</option>${twilioTemplates
    .map((template) => `<option value="${escapeHtml(template.sid)}">${escapeHtml(template.name)}${template.language ? ` (${escapeHtml(template.language)})` : ""}</option>`)
    .join("")}`;
  const recoveryTemplate = twilioTemplates.find((template) => template.name === "recuperar_venta");
  if (recoveryTemplate) select.value = recoveryTemplate.sid;
}

function renderTemplatePanel() {
  const panel = document.querySelector("#templatePanel");
  const button = document.querySelector("#toggleTemplatePanel");
  if (panel) panel.hidden = !templatePanelOpen;
  if (button) button.classList.toggle("active-tool", templatePanelOpen);
}

function setTemplateStatus(message) {
  const status = document.querySelector("#templateStatus");
  if (status) status.textContent = message;
}

document.querySelector("#inventoryTable").addEventListener("input", (event) => {
  const row = event.target.closest(".inventory-row");
  if (row) row.classList.add("dirty");
});

document.querySelector("#inventoryTable").addEventListener("change", (event) => {
  const row = event.target.closest(".inventory-row");
  if (row) row.classList.add("dirty");
});

document.querySelector("#mediaInput").addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file || !pendingAttachment) return;
  pendingAttachment.file = file;
  pendingAttachment.name = file.name;
  pendingAttachment.meta = `${Math.max(Math.round(file.size / 1024), 1)} KB | ${file.type || "archivo local"}`;
  renderAttachmentPreview();
});

document.querySelector("#clearAttachment").addEventListener("click", () => {
  pendingAttachment = null;
  document.querySelector("#mediaInput").value = "";
  renderAttachmentPreview();
});

document.querySelector("#manualMessageForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = document.querySelector("#manualMessage").value.trim();
  if (!selectedCustomerId || (!text && !pendingAttachment?.file)) return;
  const type = pendingAttachment?.type || "text";
  const formData = new FormData();
  formData.append("text", text);
  formData.append("sender", "asesor");
  formData.append("type", type);
  formData.append("simulateReply", "false");
  if (pendingAttachment?.file) formData.append("media", pendingAttachment.file);
  const response = await fetch(`/api/customers/${selectedCustomerId}/message`, {
    method: "POST",
    body: formData
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    window.alert(result.error || "No fue posible enviar el mensaje por WhatsApp.");
    return;
  }
  document.querySelector("#manualMessage").value = "";
  pendingAttachment = null;
  document.querySelector("#mediaInput").value = "";
  renderAttachmentPreview();
  await loadData();
});

document.querySelector("#orderForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!selectedOrderId) return;
  const submitButton = event.currentTarget.querySelector('button[type="submit"]');
  const previousLabel = submitButton.textContent;
  submitButton.disabled = true;
  submitButton.textContent = "Guardando...";
  try {
    const response = await fetch(`/api/orders/${selectedOrderId}/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: document.querySelector("#orderStatus").value,
        paymentStatus: document.querySelector("#paymentStatus").value,
        validationStatus: document.querySelector("#validationStatus").value,
        priority: document.querySelector("#priority").value,
        internalNotes: document.querySelector("#internalNotes").value,
        dispatch: {
          carrier: document.querySelector("#carrier").value,
          guide: document.querySelector("#guide").value,
          city: document.querySelector("#city").value,
          address: document.querySelector("#address").value,
          notes: document.querySelector("#dispatchNotes").value
        }
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      window.alert(result.error || "No fue posible guardar la validacion.");
      return;
    }
    await loadData();
    closeOrderModal();
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = previousLabel;
  }
});

document.querySelectorAll("[data-settings-form]").forEach((form) => {
  form.addEventListener("submit", saveSystemSettings);
});

async function saveSystemSettings(event) {
  event.preventDefault();
  const submitButton = event.currentTarget.querySelector('button[type="submit"]');
  const previousLabel = submitButton?.textContent || "Guardar";
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Guardando...";
  }
  const payload = {};
  [
    "businessName",
    "whatsappNumber",
    "paymentValidatorNumber",
    "orderNotificationNumber",
    "accountSid",
    "authToken",
    "messagingServiceSid",
    "publicBaseUrl",
    "minimumWholesaleReferences",
    "minimumWholesaleUnits",
    "minimumWholesaleTotalUnits",
    "minimumWholesaleAmount",
    "paymentTerms",
    "bankInfo",
    "inventoryKey",
    "storeGoogleClientId",
    "wompiPublicKey",
    "wompiApiUrl",
    "wompiPrivateKey",
    "aiModel",
    "aiApiKey",
    "aiStyle"
  ].forEach((key) => {
    const input = document.querySelector(`#${key}`);
    if (input) payload[key] = input.value;
  });
  payload.aiProvider = "openai";
  payload.aiModel = payload.aiModel || "gpt-5.6";
  payload.aiEnabled = document.querySelector("#aiEnabled")?.checked || false;
  payload.minimumWholesaleReferences = Number(payload.minimumWholesaleReferences || 2);
  payload.minimumWholesaleUnits = Number(payload.minimumWholesaleUnits || 6);
  payload.minimumWholesaleTotalUnits = Number(payload.minimumWholesaleTotalUnits || 12);
  payload.minimumWholesaleAmount = Number(payload.minimumWholesaleAmount || 300000);
  try {
    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      alert(result.error || "No se pudo guardar la configuracion.");
      return;
    }
    state.settings = result.settings;
    state.webhookUrl = result.webhookUrl;
    closeSettingsModal();
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = previousLabel;
    }
  }
}

document.querySelector("#botUserForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button[type="submit"]');
  const previousLabel = button.textContent;
  button.disabled = true;
  button.textContent = "Creando...";
  try {
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: document.querySelector("#botUserName").value,
        email: document.querySelector("#botUserEmail").value,
        role: document.querySelector("#botUserRole").value,
        password: document.querySelector("#botUserPassword").value
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      window.alert(result.error || "No fue posible crear el usuario.");
      return;
    }
    event.currentTarget.reset();
    lastSnapshot = "";
    await loadData();
    window.alert(`Usuario ${result.user.name} creado correctamente.`);
  } finally {
    button.disabled = false;
    button.textContent = previousLabel;
  }
});

document.querySelector("#adminLogout")?.addEventListener("click", async () => {
  await fetch("/api/admin/logout", { method: "POST" }).catch(() => null);
  window.location.href = "/login";
});

document.querySelector("#copyWebhook").addEventListener("click", async () => {
  await navigator.clipboard.writeText(document.querySelector("#webhookUrl").textContent);
  document.querySelector("#copyWebhook").textContent = "Copiado";
  setTimeout(() => (document.querySelector("#copyWebhook").textContent = "Copiar"), 1200);
});

function acceptForAttachment(type) {
  if (type === "image") return "image/*";
  if (type === "audio") return "audio/*";
  if (type === "video") return "video/*";
  return ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,application/pdf";
}

function renderAttachmentPreview() {
  const preview = document.querySelector("#attachmentPreview");
  if (!pendingAttachment) {
    preview.textContent = "Sin adjunto";
    return;
  }
  preview.textContent = `${attachmentLabel(pendingAttachment.type)} listo: ${pendingAttachment.name || "selecciona un archivo"}`;
}

async function saveInventoryRow(row) {
  if (!row) return;
  const productId = row.dataset.product;
  const button = row.querySelector(".save-product");
  const inventoryKey = window.prompt("Clave inventario requerida para guardar cambios sensibles:");
  if (!inventoryKey) return;
  button.textContent = "Guardando";
  button.disabled = true;
  const payload = {
    storeName: row.querySelector(".product-store-name").value || "SIN NOMBRE",
    category: row.querySelector(".product-category").value || "General",
    brand: "General",
    deposito: "",
    puesto: "",
    stock: Number(row.querySelector(".product-stock").value || 0),
    wholesalePrice: Number(row.querySelector(".product-wholesale").value || 0),
    retailPrice: Number(row.querySelector(".product-retail").value || 0),
    botFeatures: document.querySelector(`.knowledge-row[data-product="${cssEscape(productId)}"] .product-bot-features`)?.value || "",
    status: "Disponible",
    inventoryKey
  };
  const response = await fetch(`/api/products/${encodeURIComponent(productId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    button.textContent = "Error";
    button.disabled = false;
    alert(result.error || "No se pudo guardar el producto.");
    return;
  }
  row.classList.remove("dirty");
  row.classList.add("saved");
  button.textContent = "Guardado";
  lastSnapshot = "";
  await loadData();
  setTimeout(() => {
    row.classList.remove("saved");
    button.textContent = "Guardar";
    button.disabled = false;
  }, 900);
}

loadData();
setInterval(loadData, 5000);
