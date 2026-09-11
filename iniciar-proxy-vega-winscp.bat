@echo off
cd /d "%~dp0"
echo Proxy SSH VEGA para WinSCP
echo.
echo Deja esta ventana abierta mientras uses WinSCP.
echo Host WinSCP: 127.0.0.1
echo Puerto: 2222
echo Usuario: admin
echo.
tools\cloudflared.exe access tcp --hostname ssh.vegaimportadoracolombia.com --url 127.0.0.1:2222
pause
