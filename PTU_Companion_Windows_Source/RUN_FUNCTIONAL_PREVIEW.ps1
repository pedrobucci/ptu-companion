Set-Location $PSScriptRoot
Start-Process powershell -ArgumentList '-NoExit','-Command','node --no-warnings server.mjs'
Start-Sleep -Seconds 2
Start-Process 'http://127.0.0.1:4173'
