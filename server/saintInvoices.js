const { execFile } = require("child_process");

function decodeSetting(settings, key, fallback = "") {
  const value = settings?.[key];
  if (value === undefined || value === null || value === "") return fallback;
  return String(value);
}

function enabled(settings = {}) {
  const raw = settings.saintInvoiceEnabled ?? settings.saintInventoryEnabled;
  return raw === true || raw === 1 || String(raw).toLowerCase() === "true" || String(raw) === "1";
}

function configFromSettings(settings = {}) {
  return {
    server: decodeSetting(settings, "saintSqlServer", process.env.SAINT_SQL_SERVER || ""),
    database: decodeSetting(settings, "saintSqlDatabase", process.env.SAINT_SQL_DATABASE || ""),
    user: decodeSetting(settings, "saintSqlUser", process.env.SAINT_SQL_USER || ""),
    password: decodeSetting(settings, "saintSqlPassword", process.env.SAINT_SQL_PASSWORD || ""),
    codSucu: decodeSetting(settings, "saintCodSucu", "00000"),
    codEsta: decodeSetting(settings, "saintCodEsta", "DESKTOP-RS"),
    codUsua: decodeSetting(settings, "saintCodUsua", "001"),
    codVend: decodeSetting(settings, "saintCodVend", "VIRTUAL"),
    codUbic: decodeSetting(settings, "saintCodUbic", "01")
  };
}

function decodePowerShellXml(value = "") {
  return String(value || "")
    .replace(/_x000D__x000A_/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

function summarizePowerShellFailure(error, stderr = "") {
  const raw = String(stderr || "");
  const xmlMessages = [...raw.matchAll(/<S S="Error">([\s\S]*?)<\/S>/gi)]
    .map((match) => decodePowerShellXml(match[1]));
  let detail = xmlMessages.length ? xmlMessages.join(" ") : decodePowerShellXml(raw);
  detail = detail
    .replace(/#< CLIXML/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/Password\s*=\s*[^;\s]+/gi, "Password=***")
    .replace(/\s+/g, " ")
    .trim();

  if (!detail) {
    if (error?.killed || error?.code === "ETIMEDOUT") return "SAINT no respondio dentro del tiempo esperado";
    return "SAINT no estuvo disponible durante el intento de facturacion";
  }
  return `SAINT no disponible: ${detail.slice(0, 900)}`;
}

function runPowerShell(script) {
  return new Promise((resolve, reject) => {
    const encoded = Buffer.from(script, "utf16le").toString("base64");
    execFile(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded],
      { windowsHide: true, maxBuffer: 10 * 1024 * 1024, timeout: 45000 },
      (error, stdout, stderr) => {
        if (error) {
          const safeError = new Error(summarizePowerShellFailure(error, stderr));
          safeError.code = error.code;
          return reject(safeError);
        }
        resolve(stdout);
      }
    );
  });
}

function psSingleQuoted(value) {
  return `'${String(value ?? "").replace(/'/g, "''")}'`;
}

function buildInvoiceScript(config, sale) {
  const saleJson = JSON.stringify(sale).replace(/'/g, "''");
  return `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Data
$server = ${psSingleQuoted(config.server)}
$database = ${psSingleQuoted(config.database)}
$user = ${psSingleQuoted(config.user)}
$pass = ${psSingleQuoted(config.password)}
$codSucu = ${psSingleQuoted(config.codSucu)}
$codEsta = ${psSingleQuoted(config.codEsta)}
$codUsua = ${psSingleQuoted(config.codUsua)}
$defaultCodVend = ${psSingleQuoted(config.codVend)}
$defaultCodUbic = ${psSingleQuoted(config.codUbic)}
$sale = '${saleJson}' | ConvertFrom-Json
$cs = "Server=$server;Database=$database;User ID=$user;Password=$pass;TrustServerCertificate=True;Connection Timeout=8;"
$cn = New-Object System.Data.SqlClient.SqlConnection $cs
$cn.Open()
try {
  $vendorCmd = $cn.CreateCommand()
  $vendorCmd.CommandTimeout = 10
  $vendorCmd.CommandText = @"
IF OBJECT_ID('SAVEND','U') IS NOT NULL
   AND COL_LENGTH('SAVEND','CodVend') IS NOT NULL
   AND COL_LENGTH('SAVEND','Descrip') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM SAVEND WHERE CodVend=@CodVend)
BEGIN
  IF COL_LENGTH('SAVEND','Activo') IS NOT NULL
    INSERT INTO SAVEND (CodVend, Descrip, Activo) VALUES (@CodVend, @Descrip, 1)
  ELSE
    INSERT INTO SAVEND (CodVend, Descrip) VALUES (@CodVend, @Descrip)
END
"@
  [void]$vendorCmd.Parameters.AddWithValue("@CodVend", $defaultCodVend)
  [void]$vendorCmd.Parameters.AddWithValue("@Descrip", "Vendedor virtual")
  [void]$vendorCmd.ExecuteNonQuery()
} catch {
  Write-Verbose "No se pudo asegurar vendedor virtual. La factura continuara con CodVend=$defaultCodVend"
}
$tx = $cn.BeginTransaction([System.Data.IsolationLevel]::Serializable)

function New-Cmd($sql) {
  $cmd = $cn.CreateCommand()
  $cmd.Transaction = $tx
  $cmd.CommandTimeout = 30
  $cmd.CommandText = $sql
  return $cmd
}

function Add-Param($cmd, $name, $value) {
  if ($null -eq $value) { $value = [DBNull]::Value }
  [void]$cmd.Parameters.AddWithValue($name, $value)
}

function Scalar($sql) {
  $cmd = New-Cmd $sql
  $value = $cmd.ExecuteScalar()
  if ($value -is [System.DBNull]) { return $null }
  return $value
}

function Trim-Len($value, $len) {
  if ($null -eq $value) { $value = '' }
  $text = [string]$value
  if ($text.Length -gt $len) { return $text.Substring(0, $len) }
  return $text
}

try {
  $existingCmd = New-Cmd "SELECT TOP 1 NumeroD FROM SAFACT WHERE TipoFac='G' AND Notas1=@saleId ORDER BY NroUnico DESC"
  Add-Param $existingCmd "@saleId" ([string]$sale.id)
  $existing = $existingCmd.ExecuteScalar()
  if ($existing -and -not ($existing -is [System.DBNull])) {
    $tx.Commit()
    $cn.Close()
    [PSCustomObject]@{ ok = $true; skipped = $true; tipoFac = 'G'; numeroD = [string]$existing } | ConvertTo-Json -Compress
    exit 0
  }

  $correlCmd = New-Cmd "SELECT ValueInt FROM SACORRELSIS WITH (UPDLOCK, HOLDLOCK) WHERE CodSucu=@CodSucu AND FieldName='PrxFactEs' AND CodEsta IS NULL"
  Add-Param $correlCmd "@CodSucu" $codSucu
  $correlValue = $correlCmd.ExecuteScalar()
  $maxNumber = [int](Scalar "SELECT ISNULL(MAX(TRY_CONVERT(int, NumeroD)), 0) FROM SAFACT WITH (UPDLOCK, HOLDLOCK) WHERE TipoFac='G' AND ISNUMERIC(NumeroD)=1")
  if ($correlValue -and -not ($correlValue -is [System.DBNull])) {
    $nextNumber = [int]$correlValue
    if ($nextNumber -le $maxNumber) { $nextNumber = $maxNumber + 1 }
  } else {
    $nextNumber = $maxNumber + 1
    $insertCorrel = New-Cmd "INSERT INTO SACORRELSIS (CodSucu, FieldName, CodEsta, ValueStr, ValueInt, ValueDec) VALUES (@CodSucu, 'PrxFactEs', NULL, '', @ValueInt, 0)"
    Add-Param $insertCorrel "@CodSucu" $codSucu
    Add-Param $insertCorrel "@ValueInt" $nextNumber
    [void]$insertCorrel.ExecuteNonQuery()
  }
  $numeroD = $nextNumber.ToString('000000')
  $nroUnico = 0
  $now = Get-Date
  $items = @($sale.items)
  $subtotal = 0
  foreach ($item in $items) { $subtotal += ([decimal]$item.quantity * [decimal]$item.unit_price) }
  $shipping = [decimal]$sale.shipping_amount
  $total = [decimal]$sale.total_amount
  if ($total -le 0) { $total = $subtotal + $shipping }
  $codClie = Trim-Len $(if ([string]::IsNullOrWhiteSpace([string]$sale.customer_id_number)) { [string]$sale.customer_phone } else { [string]$sale.customer_id_number }) 15
  if ([string]::IsNullOrWhiteSpace($codClie)) { $codClie = Trim-Len ([string]$sale.id) 15 }
  $descrip = Trim-Len (([string]$sale.customer_name + $(if ([string]::IsNullOrWhiteSpace([string]$sale.delivery_city)) { '' } else { '-' + [string]$sale.delivery_city })).Trim()) 60
  $address = Trim-Len ([string]$sale.delivery_address) 60
  $phone = Trim-Len ([string]$sale.customer_phone) 30
  $id3 = Trim-Len ([string]$sale.customer_id_number) 15
  $codUbic = $defaultCodUbic

  $header = New-Cmd @"
INSERT INTO SAFACT
  (CodSucu, TipoFac, NumeroD, CodEsta, CodUsua, Signo, FechaT,
   Factor, CodClie, CodVend, CodUbic, Descrip, Direc1, Telef, ID3,
   Monto, MtoTax, Fletes, TGravable, TExento, CostoPrd,
   FechaI, FechaE, FechaV, MtoTotal, Contado, Credito, SaldoAct,
   TotalPrd, TotalSrv, Notas1, Notas2, Notas3)
VALUES
  (@CodSucu, 'G', @NumeroD, @CodEsta, @CodUsua, 1, @FechaT,
   1, @CodClie, @CodVend, @CodUbic, @Descrip, @Direc1, @Telef, @ID3,
   @Monto, 0, @Fletes, 0, @Monto, @CostoPrd,
   @FechaI, @FechaE, @FechaV, @MtoTotal, 0, @MtoTotal, @MtoTotal,
   @TotalPrd, 0, @Notas1, @Notas2, @Notas3);
SELECT CAST(SCOPE_IDENTITY() AS int);
"@
  Add-Param $header "@CodSucu" $codSucu
  Add-Param $header "@NumeroD" $numeroD
  Add-Param $header "@CodEsta" $codEsta
  Add-Param $header "@CodUsua" $codUsua
  Add-Param $header "@FechaT" $now
  Add-Param $header "@CodClie" $codClie
  Add-Param $header "@CodVend" $defaultCodVend
  Add-Param $header "@CodUbic" $codUbic
  Add-Param $header "@Descrip" $descrip
  Add-Param $header "@Direc1" $address
  Add-Param $header "@Telef" $phone
  Add-Param $header "@ID3" $id3
  Add-Param $header "@Monto" $total
  Add-Param $header "@Fletes" $shipping
  Add-Param $header "@CostoPrd" 0
  Add-Param $header "@FechaI" $now
  Add-Param $header "@FechaE" $now
  Add-Param $header "@FechaV" $now
  Add-Param $header "@MtoTotal" $total
  Add-Param $header "@TotalPrd" $subtotal
  Add-Param $header "@Notas1" (Trim-Len ([string]$sale.id) 60)
  Add-Param $header "@Notas2" (Trim-Len ('VEGABOT TIENDA ' + [string]$sale.wompi_reference) 60)
  Add-Param $header "@Notas3" (Trim-Len ([string]$sale.payment_method) 60)
  $nroUnico = [int]$header.ExecuteScalar()

  $line = 1
  foreach ($item in $items) {
    $codProd = Trim-Len ([string]$item.product_id) 15
    $prodCmd = New-Cmd "SELECT TOP 1 RTRIM(CodProd) CodProd, RTRIM(ISNULL(Descrip,'')) Descrip, RTRIM(ISNULL(Descrip2,'')) Descrip2, RTRIM(ISNULL(Refere,'')) Refere, CostAct FROM SAPROD WHERE CodProd=@CodProd"
    Add-Param $prodCmd "@CodProd" $codProd
    $reader = $prodCmd.ExecuteReader()
    $product = $null
    if ($reader.Read()) {
      $product = [PSCustomObject]@{
        CodProd = [string]$reader["CodProd"]
        Descrip = [string]$reader["Descrip"]
        Descrip2 = [string]$reader["Descrip2"]
        Refere = [string]$reader["Refere"]
        CostAct = [decimal]$reader["CostAct"]
      }
    }
    $reader.Close()
    if ($null -eq $product) { throw "Producto no existe en Saint: $codProd" }

    $exCmd = New-Cmd "SELECT ISNULL(MAX(Existen),0) FROM SAEXIS WHERE CodProd=@CodProd AND CodUbic=@CodUbic"
    Add-Param $exCmd "@CodProd" $codProd
    Add-Param $exCmd "@CodUbic" $codUbic
    $existAnt = [decimal]$exCmd.ExecuteScalar()
    $qty = [decimal]$item.quantity
    $price = [decimal]$item.unit_price
    $totalItem = $qty * $price
    $desc1 = Trim-Len $(if ([string]::IsNullOrWhiteSpace($product.Descrip)) { [string]$item.product_name } else { $product.Descrip }) 40
    $desc2 = Trim-Len $(if ([string]::IsNullOrWhiteSpace($product.Descrip2)) { $desc1 } else { $product.Descrip2 }) 40
    $ref = Trim-Len $(if ([string]::IsNullOrWhiteSpace($product.Refere)) { $codProd } else { $product.Refere }) 20

    $detail = New-Cmd @"
INSERT INTO SAITEMFAC
  (CodSucu, TipoFac, NumeroD, NroLinea, NroLineaC, CodItem, CodUbic, CodVend,
   Descrip1, Descrip2, Descrip3, Refere, Signo, CantMayor, Cantidad,
   ExistAnt, TotalItem, Costo, Precio, Descto, FechaE, EsExento)
VALUES
  (@CodSucu, 'G', @NumeroD, @NroLinea, 0, @CodItem, @CodUbic, @CodVend,
   @Descrip1, @Descrip2, @Descrip3, @Refere, 1, 1, @Cantidad,
   @ExistAnt, @TotalItem, @Costo, @Precio, 0, @FechaE, 1)
"@
    Add-Param $detail "@CodSucu" $codSucu
    Add-Param $detail "@NumeroD" $numeroD
    Add-Param $detail "@NroLinea" $line
    Add-Param $detail "@CodItem" $codProd
    Add-Param $detail "@CodUbic" $codUbic
    Add-Param $detail "@CodVend" $defaultCodVend
    Add-Param $detail "@Descrip1" $desc1
    Add-Param $detail "@Descrip2" $desc2
    Add-Param $detail "@Descrip3" $desc2
    Add-Param $detail "@Refere" $ref
    Add-Param $detail "@Cantidad" $qty
    Add-Param $detail "@ExistAnt" $existAnt
    Add-Param $detail "@TotalItem" $totalItem
    Add-Param $detail "@Costo" $product.CostAct
    Add-Param $detail "@Precio" $price
    Add-Param $detail "@FechaE" $now
    [void]$detail.ExecuteNonQuery()
    $line++
  }

  $advanceCorrel = New-Cmd "UPDATE SACORRELSIS SET ValueInt=@NextValue WHERE CodSucu=@CodSucu AND FieldName='PrxFactEs' AND CodEsta IS NULL AND ValueInt < @NextValue"
  Add-Param $advanceCorrel "@NextValue" ($nextNumber + 1)
  Add-Param $advanceCorrel "@CodSucu" $codSucu
  [void]$advanceCorrel.ExecuteNonQuery()

  $tx.Commit()
  $cn.Close()
  [PSCustomObject]@{ ok = $true; skipped = $false; tipoFac = 'G'; numeroD = $numeroD; nroUnico = $nroUnico; total = $total } | ConvertTo-Json -Compress
} catch {
  try { $tx.Rollback() } catch {}
  try { $cn.Close() } catch {}
  throw
}
`;
}

async function createSaintWaitingInvoice(settings = {}, sale = {}) {
  if (!enabled(settings)) return { ok: false, skipped: true, reason: "disabled" };
  const config = configFromSettings(settings);
  const payload = {
    ...sale,
    items: Array.isArray(sale.items) ? sale.items : [],
    shipping_amount: Number(sale.shipping_amount || 0)
  };
  if (!payload.id || !payload.items.length) return { ok: false, skipped: true, reason: "missing_sale_data" };
  const stdout = await runPowerShell(buildInvoiceScript(config, payload));
  const jsonStart = stdout.indexOf("{");
  const jsonEnd = stdout.lastIndexOf("}");
  if (jsonStart < 0 || jsonEnd < jsonStart) throw new Error("Saint no devolvio resultado de factura");
  return JSON.parse(stdout.slice(jsonStart, jsonEnd + 1));
}

module.exports = { createSaintWaitingInvoice };
