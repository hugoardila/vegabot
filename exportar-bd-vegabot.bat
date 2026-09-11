@echo off
setlocal
cd /d "%~dp0"
if not exist backups mkdir backups
for /f "tokens=1-4 delims=/ " %%a in ("%date%") do set TODAY=%%d%%b%%c
for /f "tokens=1-3 delims=:., " %%a in ("%time%") do set NOW=%%a%%b%%c
set NOW=%NOW: =0%
set DUMP=backups\vegabot-%TODAY%-%NOW%.sql
echo Exportando base de datos vegabot...
C:\xampp\mysql\bin\mysqldump.exe -u root --default-character-set=utf8mb4 --single-transaction --routines --triggers --events vegabot > "%DUMP%"
if errorlevel 1 (
  echo Error exportando la base de datos.
  pause
  exit /b 1
)
echo Dump creado: %DUMP%
pause
