const twilio = require("twilio");
const { getPool, readDb } = require("./mysqlStore");
const { createSaintWaitingInvoice } = require("./saintInvoices");

const DEFAULT_NOTIFICATION_PHONE = "+573212947266";
const BOGOTA_TIME_ZONE = "America/Bogota";
const RETRY_INTERVAL_MS = 10 * 60 * 1000;
const RETRY_START_HOUR = 8;
const RETRY_END_HOUR = 10;
const SAINT_CLOSE_HOUR = 19;
const MAX_BATCH_SIZE = 100;

let queueProcessing = false;
let retryTimer = null;

function normalizePhone(value) {
  const raw = String(value || "").replace("whatsapp:", "").trim();
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10 && digits.startsWith("3")) return `+57${digits}`;
  return `+${digits}`;
}

function getNotificationPhone(settings = {}) {
  return normalizePhone(settings.orderNotificationNumber || DEFAULT_NOTIFICATION_PHONE);
}

function isNotificationOnlyNumber(value, settings = {}) {
  return normalizePhone(value) === getNotificationPhone(settings);
}

function bogotaParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BOGOTA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(now);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function bogotaHour(now = new Date()) {
  return Number(bogotaParts(now).hour || 0);
}

function isRetryWindow(now = new Date()) {
  const hour = bogotaHour(now);
  return hour >= RETRY_START_HOUR && hour < RETRY_END_HOUR;
}

function isImmediateAttemptWindow(now = new Date()) {
  const hour = bogotaHour(now);
  return hour >= RETRY_START_HOUR && hour < SAINT_CLOSE_HOUR;
}

function nextRetryDate(now = new Date()) {
  if (isRetryWindow(now)) return new Date(now.getTime() + RETRY_INTERVAL_MS);
  const parts = bogotaParts(now);
  const hour = Number(parts.hour || 0);
  const addDay = hour >= RETRY_START_HOUR ? 1 : 0;
  return new Date(Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day) + addDay,
    13,
    0,
    0
  ));
}

function notificationMessage(job, invoice = {}) {
  const source = String(job.source || "").toLowerCase() === "tienda"
    ? "LA TIENDA VIRTUAL"
    : "EL BOT DE VENTAS";
  const invoiceType = invoice.tipoFac || job.invoiceType || "G";
  const invoiceNumber = invoice.numeroD || job.invoiceNumber || "";
  const invoiceLine = invoiceNumber ? `\nFactura: ${invoiceType}-${invoiceNumber}` : "";
  return `SE HA GENERADO UNA NUEVA FACTURA DESDE ${source}. INGRESA A SAINT VENTAS PARA VALIDAR.${invoiceLine}\nPedido: ${job.orderId}`;
}

async function sendInvoiceNotification(settings, job, invoice) {
  if (!settings.accountSid || !settings.authToken || (!settings.whatsappNumber && !settings.messagingServiceSid)) {
    return { sent: false, reason: "twilio_not_configured" };
  }
  const client = twilio(settings.accountSid, settings.authToken);
  const notificationPhone = getNotificationPhone(settings);
  const payload = {
    to: `whatsapp:${notificationPhone}`,
    body: notificationMessage(job, invoice)
  };
  if (settings.whatsappNumber) {
    payload.from = `whatsapp:${settings.whatsappNumber}`;
  } else {
    payload.messagingServiceSid = settings.messagingServiceSid;
  }
  const message = await client.messages.create(payload);
  return { sent: true, sid: message.sid || "" };
}

function mapQueueRow(row = {}) {
  let payload = {};
  try {
    payload = JSON.parse(row.payload_json || "{}");
  } catch {}
  return {
    id: Number(row.id || 0),
    source: row.source || "",
    orderId: row.order_id || "",
    payload,
    status: row.status || "pending",
    attempts: Number(row.attempts || 0),
    notificationAttempts: Number(row.notification_attempts || 0),
    invoiceType: row.invoice_type || "G",
    invoiceNumber: row.invoice_number || "",
    lastError: row.last_error || "",
    lastAttemptAt: row.last_attempt_at || null,
    nextAttemptAt: row.next_attempt_at || null,
    invoiceCreatedAt: row.invoice_created_at || null,
    notifiedAt: row.notified_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null
  };
}

async function enqueueSaintInvoice({ source, orderId, payload }, options = {}) {
  const normalizedSource = String(source || "").toLowerCase() === "tienda" ? "tienda" : "bot";
  const normalizedOrderId = String(orderId || payload?.id || "").trim();
  if (!normalizedOrderId || !Array.isArray(payload?.items) || !payload.items.length) {
    return { ok: false, queued: false, reason: "missing_sale_data" };
  }

  const db = await getPool();
  await db.query(
    `INSERT INTO saint_invoice_queue
      (source, order_id, payload_json, status, invoice_type, next_attempt_at)
     VALUES (?, ?, ?, 'pending', 'G', ?)
     ON DUPLICATE KEY UPDATE
       payload_json = IF(status = 'completed', payload_json, VALUES(payload_json)),
       next_attempt_at = IF(status = 'completed', next_attempt_at, VALUES(next_attempt_at))`,
    [normalizedSource, normalizedOrderId, JSON.stringify(payload), nextRetryDate()]
  );

  const [[storedJob]] = await db.query(
    `SELECT status, invoice_type, invoice_number
     FROM saint_invoice_queue
     WHERE source = ? AND order_id = ?`,
    [normalizedSource, normalizedOrderId]
  );
  if (storedJob?.status === "completed") {
    return {
      ok: true,
      queued: false,
      status: "completed",
      invoice: {
        tipoFac: storedJob.invoice_type || "G",
        numeroD: storedJob.invoice_number || ""
      },
      source: normalizedSource,
      orderId: normalizedOrderId
    };
  }

  if (options.attemptNow !== false && isImmediateAttemptWindow()) {
    const result = await processSaintInvoiceQueue({ orderId: normalizedOrderId, source: normalizedSource, force: true });
    return result.jobs?.[0] || { ok: true, queued: true, reason: "processor_busy" };
  }
  return {
    ok: true,
    queued: true,
    status: "pending",
    reason: "saint_closed",
    nextAttemptAt: nextRetryDate().toISOString()
  };
}

async function loadQueueJobs(filters = {}) {
  const db = await getPool();
  const clauses = ["status IN ('pending', 'invoice_created')"];
  const values = [];
  if (filters.id) {
    clauses.push("id = ?");
    values.push(Number(filters.id));
  }
  if (filters.orderId) {
    clauses.push("order_id = ?");
    values.push(filters.orderId);
  }
  if (filters.source) {
    clauses.push("source = ?");
    values.push(filters.source);
  }
  values.push(MAX_BATCH_SIZE);
  const [rows] = await db.query(
    `SELECT * FROM saint_invoice_queue
     WHERE ${clauses.join(" AND ")}
     ORDER BY created_at ASC
     LIMIT ?`,
    values
  );
  return rows.map(mapQueueRow);
}

async function listBotSaintInvoices(options = {}) {
  const db = await getPool();
  const limit = Math.min(Math.max(Number(options.limit) || 200, 1), 500);
  const [rows] = await db.query(
    `SELECT *
     FROM saint_invoice_queue
     WHERE source = 'bot'
     ORDER BY created_at DESC, id DESC
     LIMIT ?`,
    [limit]
  );
  return rows.map(mapQueueRow);
}

async function markInvoiceAttempt(job, patch = {}) {
  const db = await getPool();
  await db.query(
    `UPDATE saint_invoice_queue
     SET status = ?,
         attempts = attempts + ?,
         notification_attempts = notification_attempts + ?,
         invoice_type = ?,
         invoice_number = ?,
         last_error = ?,
         last_attempt_at = NOW(),
         next_attempt_at = ?,
         invoice_created_at = COALESCE(invoice_created_at, ?),
         notified_at = COALESCE(notified_at, ?)
     WHERE id = ?`,
    [
      patch.status || job.status,
      Number(patch.attemptIncrement || 0),
      Number(patch.notificationIncrement || 0),
      patch.invoiceType || job.invoiceType || "G",
      patch.invoiceNumber || job.invoiceNumber || "",
      String(patch.lastError || "").slice(0, 4000),
      patch.nextAttemptAt || nextRetryDate(),
      patch.invoiceCreatedAt || null,
      patch.notifiedAt || null,
      job.id
    ]
  );
}

async function processQueueJob(job, settings) {
  let current = { ...job };
  let invoice = {
    tipoFac: current.invoiceType || "G",
    numeroD: current.invoiceNumber || ""
  };

  if (current.status === "pending") {
    try {
      const result = await createSaintWaitingInvoice(settings, current.payload);
      if (!result?.ok) {
        const error = result?.reason || "saint_invoice_not_created";
        await markInvoiceAttempt(current, {
          status: "pending",
          attemptIncrement: 1,
          lastError: error
        });
        return { ok: false, queued: true, source: current.source, orderId: current.orderId, error };
      }
      invoice = {
        tipoFac: result.tipoFac || "G",
        numeroD: result.numeroD || ""
      };
      await markInvoiceAttempt(current, {
        status: "invoice_created",
        attemptIncrement: 1,
        invoiceType: invoice.tipoFac,
        invoiceNumber: invoice.numeroD,
        invoiceCreatedAt: new Date(),
        lastError: ""
      });
      current = {
        ...current,
        status: "invoice_created",
        invoiceType: invoice.tipoFac,
        invoiceNumber: invoice.numeroD
      };
      console.log(`Factura en espera Saint ${invoice.tipoFac}-${invoice.numeroD} lista para pedido ${current.orderId} (${current.source})`);
    } catch (error) {
      await markInvoiceAttempt(current, {
        status: "pending",
        attemptIncrement: 1,
        lastError: error.message
      });
      console.error(`Factura Saint pendiente de reintento para ${current.orderId}:`, error.message);
      return { ok: false, queued: true, source: current.source, orderId: current.orderId, error: error.message };
    }
  }

  try {
    const notification = await sendInvoiceNotification(settings, current, invoice);
    if (!notification.sent) {
      await markInvoiceAttempt(current, {
        status: "invoice_created",
        notificationIncrement: 1,
        lastError: notification.reason || "notification_not_sent"
      });
      return {
        ok: true,
        queued: true,
        invoice,
        source: current.source,
        orderId: current.orderId,
        notification
      };
    }
    await markInvoiceAttempt(current, {
      status: "completed",
      notificationIncrement: 1,
      invoiceType: invoice.tipoFac,
      invoiceNumber: invoice.numeroD,
      notifiedAt: new Date(),
      lastError: ""
    });
    return {
      ok: true,
      queued: false,
      status: "completed",
      invoice,
      source: current.source,
      orderId: current.orderId,
      notification
    };
  } catch (error) {
    await markInvoiceAttempt(current, {
      status: "invoice_created",
      notificationIncrement: 1,
      lastError: error.message
    });
    console.error(`Notificacion de factura pendiente para ${current.orderId}:`, error.message);
    return {
      ok: true,
      queued: true,
      invoice,
      source: current.source,
      orderId: current.orderId,
      notification: { sent: false, error: error.message }
    };
  }
}

async function processSaintInvoiceQueue(options = {}) {
  if (queueProcessing) return { ok: true, skipped: true, reason: "processor_busy", jobs: [] };
  if (!options.force && !isRetryWindow()) {
    return { ok: true, skipped: true, reason: "outside_retry_window", jobs: [] };
  }

  queueProcessing = true;
  try {
    const dbState = await readDb();
    const jobs = await loadQueueJobs(options);
    const results = [];
    for (const job of jobs) {
      results.push(await processQueueJob(job, dbState.settings || {}));
    }
    return { ok: true, processed: results.length, jobs: results };
  } finally {
    queueProcessing = false;
  }
}

async function sendBotSaintInvoiceNow(id) {
  const invoiceId = Number(id);
  if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
    return { ok: false, notFound: true, reason: "invalid_invoice_id" };
  }

  const db = await getPool();
  const [[row]] = await db.query(
    `SELECT *
     FROM saint_invoice_queue
     WHERE id = ? AND source = 'bot'
     LIMIT 1`,
    [invoiceId]
  );
  if (!row) {
    return { ok: false, notFound: true, reason: "bot_invoice_not_found" };
  }

  const job = mapQueueRow(row);
  if (job.status === "completed") {
    return {
      ok: true,
      alreadyCompleted: true,
      status: job.status,
      invoice: {
        tipoFac: job.invoiceType || "G",
        numeroD: job.invoiceNumber || ""
      },
      orderId: job.orderId
    };
  }

  const result = await processSaintInvoiceQueue({
    id: invoiceId,
    source: "bot",
    force: true
  });
  return result.jobs?.[0] || result;
}

function startSaintInvoiceRetryWorker() {
  if (retryTimer) return retryTimer;
  const run = () => {
    processSaintInvoiceQueue().catch((error) => {
      console.error("No se pudo procesar la cola de facturas Saint:", error.message);
    });
  };
  run();
  retryTimer = setInterval(run, RETRY_INTERVAL_MS);
  retryTimer.unref?.();
  return retryTimer;
}

module.exports = {
  NOTIFICATION_PHONE: DEFAULT_NOTIFICATION_PHONE,
  enqueueSaintInvoice,
  isImmediateAttemptWindow,
  isNotificationOnlyNumber,
  listBotSaintInvoices,
  processSaintInvoiceQueue,
  sendBotSaintInvoiceNow,
  startSaintInvoiceRetryWorker,
  _test: {
    bogotaHour,
    isImmediateAttemptWindow,
    isRetryWindow,
    nextRetryDate,
    notificationMessage
  }
};
