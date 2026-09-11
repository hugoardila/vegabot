param(
  [Parameter(Mandatory = $true)]
  [string]$DumpPath
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

if (-not (Test-Path $DumpPath)) {
  throw "No existe el archivo SQL: $DumpPath"
}

$mysql = "C:\xampp\mysql\bin\mysql.exe"
if (-not (Test-Path $mysql)) {
  throw "No se encontro mysql.exe en $mysql"
}

Write-Host "Creando base de datos vegabot si no existe..."
& $mysql -u root -e "CREATE DATABASE IF NOT EXISTS vegabot CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

Write-Host "Importando $DumpPath en vegabot..."
cmd /c "`"$mysql`" -u root --default-character-set=utf8mb4 vegabot < `"$DumpPath`""

if ($LASTEXITCODE -ne 0) {
  throw "La importacion fallo con codigo $LASTEXITCODE"
}

Write-Host "Importacion completada."
