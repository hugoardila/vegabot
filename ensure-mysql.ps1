$ErrorActionPreference = "Stop"

$xamppRoot = "C:\xampp"
$mysqlAdmin = Join-Path $xamppRoot "mysql\bin\mysqladmin.exe"
$mysqld = Join-Path $xamppRoot "mysql\bin\mysqld.exe"
$mysqlConfig = Join-Path $xamppRoot "mysql\bin\my.ini"
$startupLog = Join-Path $xamppRoot "htdocs\vegabot\logs\startup.log"

function Test-MySql {
  & $mysqlAdmin --user=root --host=127.0.0.1 --port=3306 ping --silent *> $null
  return $LASTEXITCODE -eq 0
}

if (Test-MySql) {
  exit 0
}

$mysqlProcess = Get-Process mysqld -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $mysqlProcess) {
  Start-Process `
    -FilePath $mysqld `
    -ArgumentList "--defaults-file=$mysqlConfig", "--standalone" `
    -WorkingDirectory $xamppRoot `
    -WindowStyle Hidden
}

$deadline = (Get-Date).AddSeconds(45)
do {
  Start-Sleep -Seconds 1
  if (Test-MySql) {
    Add-Content -LiteralPath $startupLog -Encoding UTF8 -Value "$(Get-Date -Format s) MySQL disponible en 127.0.0.1:3306"
    exit 0
  }
} while ((Get-Date) -lt $deadline)

Add-Content -LiteralPath $startupLog -Encoding UTF8 -Value "$(Get-Date -Format s) ERROR: MySQL no respondio en 127.0.0.1:3306"
exit 1
