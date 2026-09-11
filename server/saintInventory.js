const { execFile } = require("child_process");

const DEFAULT_CACHE_MS = 300000;
const DEFAULT_TIMEOUT_MS = 30000;
const ERROR_THROTTLE_MS = 60000;
let cache = {
  expiresAt: 0,
  fetchedAt: 0,
  products: [],
  categories: [],
  brands: [],
  error: "",
  errorExpiresAt: 0,
  refreshPromise: null
};

function decodeSetting(settings, key, fallback = "") {
  const value = settings?.[key];
  if (value === undefined || value === null || value === "") return fallback;
  return String(value);
}

function enabled(settings = {}) {
  const raw = settings.saintInventoryEnabled;
  if (raw === undefined || raw === null || raw === "") return false;
  return raw === true || raw === 1 || String(raw).toLowerCase() === "true" || String(raw) === "1";
}

function configFromSettings(settings = {}) {
  return {
    server: decodeSetting(settings, "saintSqlServer", process.env.SAINT_SQL_SERVER || ""),
    database: decodeSetting(settings, "saintSqlDatabase", process.env.SAINT_SQL_DATABASE || ""),
    user: decodeSetting(settings, "saintSqlUser", process.env.SAINT_SQL_USER || ""),
    password: decodeSetting(settings, "saintSqlPassword", process.env.SAINT_SQL_PASSWORD || ""),
    cacheMs: Number(settings.saintInventoryCacheMs || DEFAULT_CACHE_MS),
    timeoutMs: Number(settings.saintInventoryTimeoutMs || DEFAULT_TIMEOUT_MS)
  };
}

function psLiteral(value) {
  return `'${String(value || "").replace(/'/g, "''")}'`;
}

function buildScript(config) {
  return `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Data
$server = ${psLiteral(config.server)}
$database = ${psLiteral(config.database)}
$user = ${psLiteral(config.user)}
$pass = ${psLiteral(config.password)}
$cs = "Server=$server;Database=$database;User ID=$user;Password=$pass;TrustServerCertificate=True;Connection Timeout=8;"
$cn = New-Object System.Data.SqlClient.SqlConnection $cs
$cn.Open()
$cmd = $cn.CreateCommand()
$cmd.CommandTimeout = 30
$cmd.CommandText = @"
SELECT
  RTRIM(p.CodProd) AS id,
  RTRIM(ISNULL(p.Descrip, '')) AS name,
  RTRIM(ISNULL(inst.Descrip, 'General')) AS category,
  RTRIM(ISNULL(NULLIF(p.Marca, ''), 'General')) AS brand,
  CAST(CASE WHEN ex.stock IS NULL THEN p.Existen ELSE ex.stock END AS float) AS stock,
  CAST(p.Precio1 AS float) AS price1,
  CAST(p.Precio2 AS float) AS price2,
  CAST(p.Precio3 AS float) AS price3,
  CAST(p.CostAct AS float) AS cost,
  RTRIM(ISNULL(p.Refere, '')) AS reference,
  RTRIM(ISNULL(p.Unidad, '')) AS unit,
  CAST(p.Activo AS int) AS active,
  RTRIM(ISNULL(dep.depositos, '')) AS deposito,
  RTRIM(ISNULL(bar.barcodes, '')) AS barcodes
FROM SAPROD p
LEFT JOIN SAINSTA inst ON inst.CodInst = p.CodInst
LEFT JOIN (
  SELECT CodProd, SUM(Existen) AS stock
  FROM SAEXIS
  GROUP BY CodProd
) ex ON ex.CodProd = p.CodProd
LEFT JOIN (
  SELECT e.CodProd,
    STUFF((
      SELECT '; ' + RTRIM(e2.CodUbic) + ':' + CONVERT(varchar(30), CONVERT(decimal(18,0), e2.Existen))
      FROM SAEXIS e2
      WHERE e2.CodProd = e.CodProd
      ORDER BY e2.CodUbic
      FOR XML PATH(''), TYPE
    ).value('.', 'nvarchar(max)'), 1, 2, '') AS depositos
  FROM SAEXIS e
  GROUP BY e.CodProd
) dep ON dep.CodProd = p.CodProd
LEFT JOIN (
  SELECT c.CodProd,
    STUFF((
      SELECT ', ' + RTRIM(c2.CodAlte)
      FROM SACODBAR c2
      WHERE c2.CodProd = c.CodProd
      ORDER BY c2.CodAlte
      FOR XML PATH(''), TYPE
    ).value('.', 'nvarchar(max)'), 1, 2, '') AS barcodes
  FROM SACODBAR c
  GROUP BY c.CodProd
) bar ON bar.CodProd = p.CodProd
WHERE p.Activo = 1
ORDER BY inst.Descrip, p.Descrip, p.CodProd
"@
$da = New-Object System.Data.SqlClient.SqlDataAdapter $cmd
$dt = New-Object System.Data.DataTable
[void]$da.Fill($dt)
$cn.Close()
$rows = @()
foreach ($row in $dt.Rows) {
  $stock = [double]$row.stock
  $rows += [PSCustomObject]@{
    id = [string]$row.id
    name = [string]$row.name
    category = if ([string]::IsNullOrWhiteSpace([string]$row.category)) { 'General' } else { [string]$row.category }
    brand = if ([string]::IsNullOrWhiteSpace([string]$row.brand)) { 'General' } else { [string]$row.brand }
    stock = [int][Math]::Floor([Math]::Max(0, $stock))
    price1 = [int][Math]::Round([double]$row.price1, 0)
    price2 = [int][Math]::Round([double]$row.price2, 0)
    price3 = [int][Math]::Round([double]$row.price3, 0)
    wholesalePrice = [int][Math]::Round([double]$row.price1, 0)
    retailPrice = [int][Math]::Round([double]$row.price2, 0)
    cost = [int][Math]::Round([double]$row.cost, 0)
    warranty = ''
    status = if ([int]$row.active -eq 1 -and $stock -gt 0) { 'Disponible' } else { 'Sin stock' }
    deposito = [string]$row.deposito
    puesto = ''
    source = 'saint:bodega'
    reference = [string]$row.reference
    unit = [string]$row.unit
    barcodes = [string]$row.barcodes
    storeDescription = ''
    botFeatures = ''
    updatedAt = (Get-Date).ToString('s')
  }
}
$rows | ConvertTo-Json -Depth 5 -Compress
`;
}

function runPowerShell(script, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const encoded = Buffer.from(script, "utf16le").toString("base64");
    execFile(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded],
      { windowsHide: true, maxBuffer: 20 * 1024 * 1024, timeout: timeoutMs },
      (error, stdout, stderr) => {
        if (error) {
          const detail = String(stderr || "").replace(/\s+/g, " ").trim();
          const message = error.killed
            ? `La consulta de inventario SAINT excedio ${timeoutMs} ms`
            : detail || `No fue posible consultar el inventario SAINT (${error.code || "error desconocido"})`;
          const wrapped = new Error(message.slice(0, 1000));
          wrapped.code = error.code;
          return reject(wrapped);
        }
        resolve(stdout);
      }
    );
  });
}

function rememberRefreshError(error) {
  cache.error = `${error.message || error}${error.stderr ? ` ${error.stderr}` : ""}`.slice(0, 1000);
  cache.errorExpiresAt = Date.now() + ERROR_THROTTLE_MS;
}

function beginRefresh(config, localProducts) {
  if (cache.refreshPromise) return cache.refreshPromise;
  const refreshPromise = refreshInventory(config, localProducts);
  cache.refreshPromise = refreshPromise;
  refreshPromise
    .catch(rememberRefreshError)
    .finally(() => {
      if (cache.refreshPromise === refreshPromise) cache.refreshPromise = null;
    });
  return refreshPromise;
}

async function readSaintInventory(settings = {}, localProducts = [], options = {}) {
  if (!enabled(settings)) return null;
  const now = Date.now();
  const config = configFromSettings(settings);

  if (options.forceRefresh === true) {
    try {
      return await beginRefresh(config, localProducts);
    } catch (error) {
      rememberRefreshError(error);
      return { products: null, categories: null, brands: null, error: cache.error };
    }
  }

  if (cache.products.length) {
    if (cache.expiresAt <= now && !cache.refreshPromise) {
      beginRefresh(config, localProducts);
    }
    return cache;
  }

  if (cache.refreshPromise) {
    try {
      return await cache.refreshPromise;
    } catch (error) {
      rememberRefreshError(error);
      return { products: null, categories: null, brands: null, error: cache.error };
    }
  }

  if (cache.error && cache.errorExpiresAt > now) {
    return { products: null, categories: null, brands: null, error: cache.error };
  }

  try {
    return await beginRefresh(config, localProducts);
  } catch (error) {
    rememberRefreshError(error);
    return { products: null, categories: null, brands: null, error: cache.error };
  }
}

async function refreshInventory(config, localProducts = []) {
  const stdout = await runPowerShell(buildScript(config), Math.max(3000, config.timeoutMs || DEFAULT_TIMEOUT_MS));
  const jsonStart = stdout.indexOf("[");
  const jsonEnd = stdout.lastIndexOf("]");
  if (jsonStart < 0 || jsonEnd < jsonStart) throw new Error("Saint no devolvio JSON de inventario");
  const products = JSON.parse(stdout.slice(jsonStart, jsonEnd + 1));
  const localById = new Map(localProducts.map((product) => [String(product.id).toUpperCase(), product]));
  const merged = products.map((product) => {
    const local = localById.get(String(product.id).toUpperCase()) || {};
    return {
      ...product,
      storeDescription: local.storeDescription || product.storeDescription || "",
      botFeatures: local.botFeatures || product.botFeatures || "",
      warranty: local.warranty || product.warranty || "",
      source: "saint:bodega"
    };
  });
  const categories = [...new Set(merged.map((product) => product.category || "General"))]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ id: name, name, margin: 0 }));
  const brands = [...new Set(merged.map((product) => product.brand || "General"))].sort((a, b) => a.localeCompare(b));
  cache = {
    expiresAt: Date.now() + Math.max(30000, config.cacheMs || DEFAULT_CACHE_MS),
    fetchedAt: Date.now(),
    products: merged,
    categories,
    brands,
    error: "",
    errorExpiresAt: 0,
    refreshPromise: null
  };
  return cache;
}

module.exports = { readSaintInventory };
