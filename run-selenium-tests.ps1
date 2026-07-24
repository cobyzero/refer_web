<#
.SYNOPSIS
    Ejecuta las pruebas automatizadas de Selenium del panel Botanical Atelier
.DESCRIPTION
    Verifica dependencias, inicia el servidor Angular si es necesario,
    y ejecuta las pruebas Selenium definidas en e2e/selenium-test.ts
.PARAMETER Headless
    Ejecuta las pruebas en modo sin interfaz grafica
.EXAMPLE
    .\run-selenium-tests.ps1
    .\run-selenium-tests.ps1 -Headless
#>

param(
    [switch]$Headless
)

# ─── CONFIGURACION ───────────────────────────────────────────────────────────
$BASE_URL    = "http://localhost:4200"
$API_URL     = "http://localhost:3000/api/v1"
$SCRIPT_PATH = "e2e/selenium-test.ts"
$ANGULAR_PID = $null

# ─── HEADER ──────────────────────────────────────────────────────────────────
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Botanical Atelier - Selenium Test Runner" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ─── PRE-VERIFICACIONES ─────────────────────────────────────────────────────
Write-Host "[INFO]  Verificando dependencias del sistema..." -ForegroundColor Cyan

# Node.js
$nodeVer = node -v 2>$null
if (-not $nodeVer) {
    Write-Host "[ERROR] Node.js no esta instalado. Instalalo desde https://nodejs.org" -ForegroundColor Red
    exit 1
}
Write-Host "[OK]    Node.js $nodeVer" -ForegroundColor Green

# npx
$npxPath = Get-Command npx -ErrorAction SilentlyContinue
if (-not $npxPath) {
    Write-Host "[ERROR] npx no esta disponible." -ForegroundColor Red
    exit 1
}

# Chrome / Chromium
$chromePaths = @(
    "chrome",
    "google-chrome",
    "chromium",
    "chromium-browser",
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)

$chromeFound = $false
foreach ($cp in $chromePaths) {
    if (Get-Command $cp -ErrorAction SilentlyContinue) {
        $chromeFound = $true
        break
    }
    if (Test-Path $cp) {
        $chromeFound = $true
        break
    }
}

if ($chromeFound) {
    Write-Host "[OK]    Google Chrome/Chromium detectado" -ForegroundColor Green
} else {
    Write-Host "[WARN]  No se detecto Google Chrome. Asegurate de tener Chrome o Chromium instalado." -ForegroundColor Yellow
}

# Dependencias npm (selenium-webdriver)
if (-not (Test-Path "node_modules\selenium-webdriver")) {
    Write-Host "[INFO]  Instalando dependencias (selenium-webdriver)..." -ForegroundColor Cyan
    & npm install --no-save selenium-webdriver @types/selenium-webdriver
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Fallo la instalacion de dependencias." -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK]    Dependencias instaladas." -ForegroundColor Green
} else {
    Write-Host "[OK]    Dependencias de Selenium OK" -ForegroundColor Green
}
Write-Host ""

# ─── VERIFICAR / INICIAR SERVIDOR ANGULAR ───────────────────────────────────
Write-Host "[INFO]  Verificando servidor Angular en $BASE_URL ..." -ForegroundColor Cyan

$httpCode = "failed"
try {
    $response = Invoke-WebRequest -Uri $BASE_URL -TimeoutSec 8 -Method Head -UseBasicParsing -ErrorAction Stop
    $httpCode = [int]$response.StatusCode
} catch {
    $httpCode = "failed"
}

$serverRunning = $false
if ($httpCode -eq 200 -or $httpCode -eq 302) {
    Write-Host "[OK]    Servidor Angular respondiendo (HTTP $httpCode)" -ForegroundColor Green
    $serverRunning = $true
} else {
    Write-Host "[WARN]  Servidor Angular no esta respondiendo (codigo: $httpCode)" -ForegroundColor Yellow
}

if (-not $serverRunning) {
    Write-Host ""

    $bunPath = Get-Command bun -ErrorAction SilentlyContinue
    if (-not $bunPath) {
        Write-Host "[ERROR] bun no esta instalado. Instalalo desde https://bun.sh" -ForegroundColor Red
        exit 1
    }

    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "  El servidor Angular no esta corriendo." -ForegroundColor Cyan
    Write-Host "  Se iniciara automaticamente con: bun start" -ForegroundColor Cyan
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host ""

    $startAngular = Read-Host "Iniciar servidor Angular? [S/n]"
    if ([string]::IsNullOrEmpty($startAngular)) { $startAngular = "s" }

    if ($startAngular -eq "s" -or $startAngular -eq "S") {
        Write-Host "[INFO]  Iniciando servidor Angular..." -ForegroundColor Cyan

        # Iniciar bun start en una ventana separada
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = "cmd"
        $psi.Arguments = "/c bun start"
        $psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Minimized
        $psi.UseShellExecute = $true
        $psi.WorkingDirectory = Get-Location

        $proc = [System.Diagnostics.Process]::Start($psi)
        $ANGULAR_PID = $proc.Id
        Write-Host "[INFO]  Esperando a que Angular este listo (PID: $ANGULAR_PID)..." -ForegroundColor Cyan

        $maxAttempts = 90
        for ($i = 1; $i -le $maxAttempts; $i++) {
            Start-Sleep -Seconds 2

            $code = "failed"
            try {
                $resp = Invoke-WebRequest -Uri $BASE_URL -TimeoutSec 3 -Method Head -UseBasicParsing -ErrorAction Stop
                $code = [int]$resp.StatusCode
            } catch {
                $code = "failed"
            }

            if ($code -eq 200 -or $code -eq 302) {
                Write-Host "[OK]    Servidor Angular listo despues de aproximadamente $($i * 2) segundos" -ForegroundColor Green
                $serverRunning = $true
                break
            }

            if ($i -eq $maxAttempts) {
                Write-Host "[ERROR] El servidor Angular no se inicio en aproximadamente 180 segundos." -ForegroundColor Red
                # Limpiar
                if ($ANGULAR_PID) {
                    Stop-Process -Id $ANGULAR_PID -Force -ErrorAction SilentlyContinue
                }
                exit 1
            }
        }
        Write-Host ""
    } else {
        Write-Host "[WARN]  Continuando sin servidor Angular. Las pruebas fallaran si no esta corriendo." -ForegroundColor Yellow
        Write-Host ""
    }
}

# ─── VERIFICAR BACKEND API (OPCIONAL) ───────────────────────────────────────
Write-Host "[INFO]  Verificando backend API en $API_URL ..." -ForegroundColor Cyan

try {
    $resp = Invoke-WebRequest -Uri $API_URL -TimeoutSec 5 -Method Head -UseBasicParsing -ErrorAction Stop
    $apiCode = [int]$resp.StatusCode
} catch {
    $apiCode = "failed"
}

if ($apiCode -eq 200) {
    Write-Host "[OK]    Backend API respondiendo (HTTP 200)" -ForegroundColor Green
} elseif ($apiCode -eq 302) {
    Write-Host "[OK]    Backend API respondiendo (HTTP 302)" -ForegroundColor Green
} elseif ($apiCode -eq "failed") {
    Write-Host "[WARN]  Backend API no disponible. Las pruebas pueden fallar si requieren datos reales." -ForegroundColor Yellow
    Write-Host "[WARN]  Asegurate de que el backend este corriendo en $API_URL" -ForegroundColor Yellow
} else {
    Write-Host "[WARN]  Backend API respondiendo con codigo inesperado (HTTP $apiCode). Las pruebas pueden fallar." -ForegroundColor Yellow
}

Write-Host ""

# ─── MODO HEADLESS ───────────────────────────────────────────────────────────
if ($Headless) {
    $env:SELENIUM_HEADLESS = "true"
    Write-Host "[INFO]  Modo HEADLESS activado (sin interfaz grafica)" -ForegroundColor Cyan
    Write-Host ""
}

# ─── EJECUTAR PRUEBAS ───────────────────────────────────────────────────────
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Ejecutando pruebas Selenium..." -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

& npx tsx $SCRIPT_PATH
$EXIT_CODE = $LASTEXITCODE

Write-Host ""
if ($EXIT_CODE -eq 0) {
    Write-Host "[OK]    +----------------------------------------------+" -ForegroundColor Green
    Write-Host "[OK]    |   TODAS LAS PRUEBAS COMPLETADAS CON EXITO   |" -ForegroundColor Green
    Write-Host "[OK]    +----------------------------------------------+" -ForegroundColor Green
    Write-Host ""
    Write-Host "[OK]    Reporte HTML: .\selenium-report.html" -ForegroundColor Green
} else {
    Write-Host "[ERROR] +----------------------------------------------+" -ForegroundColor Red
    Write-Host "[ERROR] |   ALGUNAS PRUEBAS FALLARON (codigo $EXIT_CODE)    |" -ForegroundColor Red
    Write-Host "[ERROR] +----------------------------------------------+" -ForegroundColor Red
    Write-Host ""
    Write-Host "[ERROR] Reporte HTML: .\selenium-report.html" -ForegroundColor Red
}

# ─── LIMPIEZA ───────────────────────────────────────────────────────────────
if ($ANGULAR_PID) {
    Write-Host "[INFO]  Deteniendo servidor Angular..." -ForegroundColor Cyan
    try {
        Stop-Process -Id $ANGULAR_PID -Force -ErrorAction Stop
        Write-Host "[OK]    Servidor Angular detenido." -ForegroundColor Green
    } catch {
        # El proceso ya termino
    }
}

exit $EXIT_CODE
