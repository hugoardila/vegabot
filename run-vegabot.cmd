@echo off
setlocal
set "VEGA_ROOT=C:\xampp\htdocs\vegabot"
set "VEGA_LOGS=%VEGA_ROOT%\logs"

if not exist "%VEGA_LOGS%" mkdir "%VEGA_LOGS%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%VEGA_ROOT%\ensure-mysql.ps1"
if errorlevel 1 (
  echo [%date% %time%] No se pudo iniciar MySQL.>> "%VEGA_LOGS%\server.err.log"
  exit /b 1
)

cd /d C:\xampp\htdocs\vegabot
"C:\Program Files\nodejs\node.exe" server\index.js >> logs\server.out.log 2>> logs\server.err.log
exit /b %errorlevel%
