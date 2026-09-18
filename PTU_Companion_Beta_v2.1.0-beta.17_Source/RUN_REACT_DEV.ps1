$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js is required. Install Node.js 20+ and run this script again."
}
if (-not (Test-Path "node_modules")) {
  npm install
}
npm run dev
