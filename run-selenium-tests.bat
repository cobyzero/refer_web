@echo off
setlocal enabledelayedexpansion

:: ======================================================
:: run-selenium-tests.bat
:: ======================
:: Script para ejecutar las pruebas automatizadas de Selenium
:: del panel administrativo Botanical Atelier.
::
:: Requisitos:
::   - Node.js >= 18
::   - Google Chrome / Chromium
::   - Angular dev server corriendo en http://localhost:4200
::     (o se inicia automaticamente)
::
:: Uso:
::   run-selenium-tests.bat
::   run-selenium-tests.bat --headless
:: ======================================================

:: ─── CONFIGURACION ─────────────────────────────────────────────────────────
set "BASE_URL=http://localhost:4200"
set "API_URL=http://localhost:3000/api/v1"
set "SELENIUM_SCRIPT=e2e/selenium-test.ts"
set "ANGULAR_PID="
set "SERVER_RUNNING=false"

:: ─── HEADER ─────────────────────────────────────────────────────────────────
echo ============================================
echo   Botanical Atelier - Selenium Test Runner
echo ============================================
echo.

:: ─── PRE-VERIFICACIONES ────────────────────────────────────────────────────
echo [INFO]  Verificando dependencias del sistema...

:: Node.js
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
  echo [ERROR] Node.js no esta instalado. Instalalo desde https://nodejs.org
  exit /b 1
)
for /f "delims=" %%i in ('node -v') do set "NODE_VER=%%i"
echo [OK]    Node.js %NODE_VER%

:: npx
where npx >nul 2>&1
if %ERRORLEVEL% neq 0 (
  echo [ERROR] npx no esta disponible.
  exit /b 1
)

:: Chrome / Chromium
set "CHROME_FOUND=false"
where chrome >nul 2>&1
if %ERRORLEVEL% equ 0 set "CHROME_FOUND=true"

if "!CHROME_FOUND!"=="false" (
  where chromium >nul 2>&1
  if %ERRORLEVEL% equ 0 set "CHROME_FOUND=true"
)

if "!CHROME_FOUND!"=="false" (
  if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" set "CHROME_FOUND=true"
)

if "!CHROME_FOUND!"=="false" (
  if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" set "CHROME_FOUND=true"
)

if "!CHROME_FOUND!"=="true" (
  echo [OK]    Google Chrome/Chromium detectado
) else (
  echo [WARN]  No se detecto Google Chrome. Asegurate de tener Chrome o Chromium instalado.
)

:: Dependencias npm (selenium-webdriver)
if not exist "node_modules\selenium-webdriver" (
  echo [INFO]  Instalando dependencias (selenium-webdriver)...
  call npm install --no-save selenium-webdriver @types/selenium-webdriver
  if !ERRORLEVEL! neq 0 (
    echo [ERROR] Fallo la instalacion de dependencias.
    exit /b 1
  )
  echo [OK]    Dependencias instaladas.
) else (
  echo [OK]    Dependencias de Selenium OK
)
echo.

:: ─── VERIFICAR / INICIAR SERVIDOR ANGULAR ──────────────────────────────────
echo [INFO]  Verificando servidor Angular en %BASE_URL% ...

set "HTTP_CODE=failed"

:: Intentar con curl primero
where curl >nul 2>&1
if !ERRORLEVEL! equ 0 (
  for /f %%i in ('curl -s -o nul -w "%%{http_code}" --max-time 8 "%BASE_URL%"') do set "HTTP_CODE=%%i"
) else (
  :: Fallback con PowerShell (escapar parentesis con ^)
  for /f %%i in ('powershell -NoProfile -Command "try ^( ^(Invoke-WebRequest -Uri '%BASE_URL%' -TimeoutSec 8 -Method Head^).StatusCode ^) catch { Write-Output 'failed' }"') do set "HTTP_CODE=%%i"
)

if "!HTTP_CODE!"=="200" (
  echo [OK]    Servidor Angular respondiendo (HTTP 200)
  set "SERVER_RUNNING=true"
) else if "!HTTP_CODE!"=="302" (
  echo [OK]    Servidor Angular respondiendo (HTTP 302)
  set "SERVER_RUNNING=true"
) else (
  echo [WARN]  Servidor Angular no esta respondiendo (codigo: !HTTP_CODE!)
  set "SERVER_RUNNING=false"
)

if "!SERVER_RUNNING!"=="false" (
  echo.
  
  :: Verificar si bun esta instalado
  where bun >nul 2>&1
  if !ERRORLEVEL! neq 0 (
    echo [ERROR] bun no esta instalado. Instalalo desde https://bun.sh
    exit /b 1
  )

  echo ============================================
  echo   El servidor Angular no esta corriendo.
  echo   Se iniciara automaticamente con: bun start
  echo ============================================
  echo.
  set /p "START_ANGULAR=Iniciar servidor Angular? [S/n]: "
  if /i "!START_ANGULAR!"=="" set "START_ANGULAR=s"
  if /i "!START_ANGULAR!"=="s" (
    echo [INFO]  Iniciando servidor Angular...
    start "Angular Dev Server" cmd /c "bun start"
    set "ANGULAR_PID=started"
    echo [INFO]  Esperando a que Angular este listo...

    for /L %%i in (1,1,90) do (
      rem Esperar 2 segundos
      timeout /t 2 /nobreak >nul 2>&1

      set "HTTP_CODE=failed"
      where curl >nul 2>&1
      if !ERRORLEVEL! equ 0 (
        for /f %%c in ('curl -s -o nul -w "%%{http_code}" --max-time 3 "%BASE_URL%"') do set "HTTP_CODE=%%c"
      ) else (
        for /f %%c in ('powershell -NoProfile -Command "try ^( ^(Invoke-WebRequest -Uri '%BASE_URL%' -TimeoutSec 3 -Method Head^).StatusCode ^) catch { Write-Output 'failed' }"') do set "HTTP_CODE=%%c"
      )

      if "!HTTP_CODE!"=="200" (
        echo [OK]    Servidor Angular listo despues de aproximadamente %%i iteraciones
        set "SERVER_RUNNING=true"
        goto :server_ready
      ) else if "!HTTP_CODE!"=="302" (
        echo [OK]    Servidor Angular listo despues de aproximadamente %%i iteraciones
        set "SERVER_RUNNING=true"
        goto :server_ready
      )
    )

    echo [ERROR] El servidor Angular no se inicio en aproximadamente 180 segundos.
    taskkill /f /fi "WINDOWTITLE eq Angular Dev Server" >nul 2>&1
    exit /b 1

    :server_ready
    echo.
  ) else (
    echo [WARN]  Continuando sin servidor Angular. Las pruebas fallaran si no esta corriendo.
    echo.
  )
)

:: ─── VERIFICAR BACKEND API (OPCIONAL) ──────────────────────────────────────
echo [INFO]  Verificando backend API en %API_URL% ...

set "API_CODE=failed"
where curl >nul 2>&1
if !ERRORLEVEL! equ 0 (
  for /f %%i in ('curl -s -o nul -w "%%{http_code}" --max-time 5 "%API_URL%"') do set "API_CODE=%%i"
) else (
  for /f %%i in ('powershell -NoProfile -Command "try ^( ^(Invoke-WebRequest -Uri '%API_URL%' -TimeoutSec 5 -Method Head^).StatusCode ^) catch { Write-Output 'failed' }"') do set "API_CODE=%%i"
)

if "!API_CODE!"=="200" (
  echo [OK]    Backend API respondiendo (HTTP 200)
) else if "!API_CODE!"=="302" (
  echo [OK]    Backend API respondiendo (HTTP 302)
) else if "!API_CODE!"=="failed" (
  echo [WARN]  Backend API no disponible. Las pruebas pueden fallar si requieren datos reales.
  echo [WARN]  Asegurate de que el backend este corriendo en %API_URL%
) else (
  echo [WARN]  Backend API respondiendo con codigo inesperado (HTTP !API_CODE!). Las pruebas pueden fallar.
)

echo.

:: ─── MODO HEADLESS ──────────────────────────────────────────────────────────
if /i "%1"=="--headless" (
  set "SELENIUM_HEADLESS=true"
  echo [INFO]  Modo HEADLESS activado (sin interfaz grafica)
  echo.
)

:: ─── EJECUTAR PRUEBAS ──────────────────────────────────────────────────────
echo ============================================
echo   Ejecutando pruebas Selenium...
echo ============================================
echo.

call npx tsx "%SELENIUM_SCRIPT%"
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if %EXIT_CODE% equ 0 (
  echo [OK]    +----------------------------------------------+
  echo [OK]    ^|   TODAS LAS PRUEBAS COMPLETADAS CON EXITO   ^|
  echo [OK]    +----------------------------------------------+
  echo.
  echo [OK]    Reporte HTML: .\selenium-report.html
) else (
  echo [ERROR] +----------------------------------------------+
  echo [ERROR] ^|   ALGUNAS PRUEBAS FALLARON (codigo %EXIT_CODE%)    ^|
  echo [ERROR] +----------------------------------------------+
  echo.
  echo [ERROR] Reporte HTML: .\selenium-report.html
)

:: ─── LIMPIEZA ──────────────────────────────────────────────────────────────
if defined ANGULAR_PID (
  echo [INFO]  Deteniendo servidor Angular...
  taskkill /f /fi "WINDOWTITLE eq Angular Dev Server" >nul 2>&1
)

exit /b %EXIT_CODE%
