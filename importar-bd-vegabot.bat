@echo off
setlocal
cd /d "%~dp0"
if "%~1"=="" (
  echo Uso:
  echo   importar-bd-vegabot.bat backups\archivo.sql
  echo.
  echo Arrastra el archivo .sql encima de este .bat o pasa la ruta como parametro.
  pause
  exit /b 1
)
set DUMP=%~1
if not exist "%DUMP%" (
  echo No existe el archivo: %DUMP%
  pause
  exit /b 1
)
echo Creando base de datos vegabot si no existe...
C:\xampp\mysql\bin\mysql.exe -u root -e "CREATE DATABASE IF NOT EXISTS vegabot CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
if errorlevel 1 (
  echo Error creando/verificando la base de datos.
  pause
  exit /b 1
)
echo Importando %DUMP% en vegabot...
C:\xampp\mysql\bin\mysql.exe -u root --default-character-set=utf8mb4 vegabot < "%DUMP%"
if errorlevel 1 (
  echo Error importando la base de datos.
  pause
  exit /b 1
)
echo Importacion completada.
pause
