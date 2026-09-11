const { execFile } = require("child_process");

const DEFAULT_TIMEOUT_MS = 12000;

function setting(settings, key, fallback = "") {
  const value = settings?.[key];
  return value === undefined || value === null || value === "" ? fallback : String(value);
}

function isEnabled(settings = {}) {
  const value = settings.saintInventoryEnabled;
  return value === true || value === 1 || ["true", "1"].includes(String(value || "").toLowerCase());
}

function configFromSettings(settings = {}) {
  return {
    server: setting(settings, "saintSqlServer", process.env.SAINT_SQL_SERVER || ""),
    database: setting(settings, "saintSqlDatabase", process.env.SAINT_SQL_DATABASE || ""),
    user: setting(settings, "saintSqlUser", process.env.SAINT_SQL_USER || ""),
    password: setting(settings, "saintSqlPassword", process.env.SAINT_SQL_PASSWORD || ""),
    timeoutMs: Math.max(3000, Number(settings.saintInventoryTimeoutMs || DEFAULT_TIMEOUT_MS))
  };
}

function psLiteral(value) {
  return `'${String(value || "").replace(/'/g, "''")}'`;
}

function sanitizeCustomer(customer = {}) {
  const email = String(customer.email || "").trim();
  const isGenericEmail = /^(generico|ventas|admin)@mascontrol\.com$/i.test(email);
  return {
    code: String(customer.code || "").trim(),
    full_name: String(customer.full_name || "").trim(),
    id_number: String(customer.id_number || "").trim(),
    phone: String(customer.phone || "").trim(),
    email: isGenericEmail ? "" : email
  };
}

function runPowerShell(script, timeoutMs) {
  return new Promise((resolve, reject) => {
    const encoded = Buffer.from(script, "utf16le").toString("base64");
    execFile(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded],
      { windowsHide: true, maxBuffer: 2 * 1024 * 1024, timeout: timeoutMs },
      (error, stdout, stderr) => {
        if (error) {
          const detail = String(stderr || "").replace(/\s+/g, " ").trim();
          return reject(new Error((detail || "No fue posible consultar los clientes en SAINT").slice(0, 900)));
        }
        resolve(String(stdout || ""));
      }
    );
  });
}

function buildScript(config, query, exactCode = false) {
  const escapedQuery = exactCode ? String(query || "").trim() : `%${String(query || "").trim()}%`;
  return `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Data
$cs = "Server=${config.server.replace(/'/g, "''")};Database=${config.database.replace(/'/g, "''")};User ID=${config.user.replace(/'/g, "''")};Password=${config.password.replace(/'/g, "''")};TrustServerCertificate=True;Connection Timeout=8;"
$cn = New-Object System.Data.SqlClient.SqlConnection $cs
$cn.Open()
$cmd = $cn.CreateCommand()
$cmd.CommandTimeout = 10
$cmd.Parameters.Add('@query', [System.Data.SqlDbType]::VarChar, 180).Value = ${psLiteral(escapedQuery)}
$cmd.CommandText = @"
SELECT TOP ${exactCode ? 1 : 8}
  RTRIM(CodClie) AS code,
  RTRIM(ISNULL(Descrip, '')) AS full_name,
  RTRIM(ISNULL(ID3, '')) AS id_number,
  RTRIM(ISNULL(NULLIF(Movil, ''), NULLIF(Telef, ''))) AS phone,
  RTRIM(ISNULL(Email, '')) AS email
FROM SACLIE
WHERE Activo = 1
  AND ${exactCode ? "RTRIM(CodClie) = @query" : "(RTRIM(CodClie) LIKE @query OR RTRIM(Descrip) LIKE @query OR RTRIM(ID3) LIKE @query OR RTRIM(Telef) LIKE @query OR RTRIM(Movil) LIKE @query OR RTRIM(Email) LIKE @query)"}
ORDER BY Descrip, CodClie
"@
$da = New-Object System.Data.SqlClient.SqlDataAdapter $cmd
$dt = New-Object System.Data.DataTable
[void]$da.Fill($dt)
$cn.Close()
$rows = @()
foreach ($row in $dt.Rows) {
  $rows += [PSCustomObject]@{
    code = [string]$row.code
    full_name = [string]$row.full_name
    id_number = [string]$row.id_number
    phone = [string]$row.phone
    email = [string]$row.email
  }
}
if ($rows.Count -eq 0) {
  '[]'
} else {
  '[' + (($rows | ForEach-Object { $_ | ConvertTo-Json -Compress }) -join ',') + ']'
}
`;
}

async function querySaintCustomers(settings = {}, query = "") {
  if (!isEnabled(settings)) throw new Error("La conexión con clientes SAINT no está habilitada");
  const normalized = String(query || "").trim();
  if (normalized.length < 3) return [];
  const config = configFromSettings(settings);
  const output = await runPowerShell(buildScript(config, normalized), config.timeoutMs);
  const start = output.indexOf("[");
  const end = output.lastIndexOf("]");
  if (start < 0 || end < start) return [];
  return JSON.parse(output.slice(start, end + 1)).map(sanitizeCustomer);
}

async function findSaintCustomer(settings = {}, clientCode = "") {
  if (!isEnabled(settings)) throw new Error("La conexión con clientes SAINT no está habilitada");
  const code = String(clientCode || "").trim();
  if (!code) return null;
  const config = configFromSettings(settings);
  const output = await runPowerShell(buildScript(config, code, true), config.timeoutMs);
  const start = output.indexOf("[");
  const end = output.lastIndexOf("]");
  if (start < 0 || end < start) return null;
  const customer = JSON.parse(output.slice(start, end + 1))[0];
  return customer ? sanitizeCustomer(customer) : null;
}

module.exports = { querySaintCustomers, findSaintCustomer };
