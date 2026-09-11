param(
  [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

if (-not (Test-Path "backups")) {
  New-Item -ItemType Directory -Force -Path "backups" | Out-Null
}

if (-not $OutputPath) {
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $OutputPath = "backups\vegabot-$stamp.sql"
}

$dump = "C:\xampp\mysql\bin\mysqldump.exe"
if (-not (Test-Path $dump)) {
  throw "No se encontro mysqldump en $dump"
}

Write-Host "Exportando base de datos vegabot a $OutputPath"
& $dump -u root --default-character-set=utf8mb4 --single-transaction --routines --triggers --events vegabot | Set-Content -Path $OutputPath -Encoding UTF8
Write-Host "Dump creado: $OutputPath"
