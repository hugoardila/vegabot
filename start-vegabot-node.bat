@echo off
cd /d C:\xampp\htdocs\vegabot
set PORT=3000
"C:\Program Files\nodejs\node.exe" server\index.js >> logs\node.out.log 2>> logs\node.err.log

