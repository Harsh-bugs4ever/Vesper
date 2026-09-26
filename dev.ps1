# Launch Vesper Backend and Frontend in separate PowerShell windows
Write-Host "Starting Vesper Development Stack..." -ForegroundColor Cyan

# 1. Start Backend in a new window
Start-Process powershell.exe -ArgumentList '-NoExit', '-NoProfile', '-Command', "
    Write-Host 'Starting Vesper API (FastAPI)...' -ForegroundColor Green
    if (Test-Path '.\venv\Scripts\Activate.ps1') { & '.\venv\Scripts\Activate.ps1' }
    python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
"

# 2. Start Frontend in a new window
Start-Process powershell.exe -ArgumentList '-NoExit', '-NoProfile', '-Command', "
    Write-Host 'Starting Vesper Web App (Next.js)...' -ForegroundColor Green
    Set-Location 'apps\web'
    if (-not (Test-Path 'node_modules')) {
        Write-Host 'Installing web dependencies...' -ForegroundColor Yellow
        npm install
    }
    npm run dev
"

Write-Host ""
Write-Host "Services launched in separate windows:" -ForegroundColor Green
Write-Host "  Backend API:  http://127.0.0.1:8000/docs" -ForegroundColor Yellow
Write-Host "  Frontend Web: http://localhost:3000" -ForegroundColor Yellow
Write-Host ""
Write-Host "Login credentials: gm@vesper.demo / vesper123" -ForegroundColor Cyan
Write-Host "Close either window to stop that service."
