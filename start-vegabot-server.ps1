Set-Location C:\xampp\htdocs\vegabot
$env:PORT = "3000"
node server\index.js *> logs\vegabot-node.log
