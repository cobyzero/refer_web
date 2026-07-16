#!/bin/bash
#
# run-selenium-tests.sh
# =====================
# Script para ejecutar las pruebas automatizadas de Selenium
# del panel administrativo Botanical Atelier.
#
# Requisitos:
#   - Node.js >= 18
#   - Google Chrome / Chromium
#   - Angular dev server corriendo en http://localhost:4200 (o se inicia automáticamente)
#   - Backend API en http://localhost:3000 (opcional, se puede omitir)
#
# Uso:
#   chmod +x run-selenium-tests.sh
#   ./run-selenium-tests.sh
#   ./run-selenium-tests.sh --headless   (ejecuta en modo sin interfaz gráfica)
#

set -euo pipefail

# ─── CONFIGURACIÓN ──────────────────────────────────────────────────────────
BASE_URL="http://localhost:4200"
API_URL="http://localhost:3000/api/v1"
SELENIUM_SCRIPT="e2e/selenium-test.ts"
ANGULAR_PID=""

# ─── COLORES ────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ─── FUNCIONES AUXILIARES ──────────────────────────────────────────────────
info()    { echo -e "${CYAN}[INFO]${NC}  $1"; }
success() { echo -e "${GREEN}[OK]${NC}    $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; }
bold()    { echo -e "${BOLD}$1${NC}"; }

cleanup() {
  if [ -n "$ANGULAR_PID" ] && kill -0 "$ANGULAR_PID" 2>/dev/null; then
    info "Deteniendo servidor Angular (PID $ANGULAR_PID)..."
    kill "$ANGULAR_PID" 2>/dev/null || true
    wait "$ANGULAR_PID" 2>/dev/null || true
    success "Servidor Angular detenido."
  fi
}

# ─── HEADER ─────────────────────────────────────────────────────────────────
bold "============================================"
bold "  Botanical Atelier - Selenium Test Runner  "
bold "============================================"
echo ""

# ─── PRE-VERIFICACIONES ────────────────────────────────────────────────────
info "Verificando dependencias del sistema..."

# Node.js
if ! command -v node &>/dev/null; then
  error "Node.js no está instalado. Instálalo desde https://nodejs.org"
  exit 1
fi
success "Node.js $(node -v)"

# npm
if ! command -v npx &>/dev/null; then
  error "npm/npx no está disponible."
  exit 1
fi

# Chrome
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
if command -v google-chrome &>/dev/null; then
  CHROME_CMD="google-chrome"
elif command -v chromium-browser &>/dev/null; then
  CHROME_CMD="chromium-browser"
elif command -v chromium &>/dev/null; then
  CHROME_CMD="chromium"
elif [ -f "$CHROME_PATH" ]; then
  CHROME_CMD="$CHROME_PATH"
else
  warn "No se detectó Google Chrome. Asegúrate de tener Chrome o Chromium instalado."
fi

if [ -n "${CHROME_CMD:-}" ]; then
  success "Google Chrome detectado"
fi

# Dependencias npm (selenium-webdriver)
if [ ! -d "node_modules/selenium-webdriver" ]; then
  info "Instalando dependencias (selenium-webdriver)..."
  npm install --no-save selenium-webdriver @types/selenium-webdriver
  success "Dependencias instaladas."
else
  success "Dependencias de Selenium OK"
fi

echo ""

# Cleanup trap for Angular server (set early so it covers auto-start)
trap cleanup EXIT INT TERM

# ─── VERIFICAR / INICIAR SERVIDOR ANGULAR ──────────────────────────────────
info "Verificando servidor Angular en $BASE_URL ..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 "$BASE_URL" 2>/dev/null || echo "failed")

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "302" ]; then
  success "Servidor Angular respondiendo (HTTP $HTTP_CODE)"
  SERVER_RUNNING=true
else
  warn "Servidor Angular no está respondiendo (código: $HTTP_CODE)"
  SERVER_RUNNING=false
fi

if [ "$SERVER_RUNNING" = false ]; then
  echo ""
  if ! command -v bun &>/dev/null; then
    error "bun no está instalado. Instálalo desde https://bun.sh"
    exit 1
  fi

  bold "¿Deseas iniciar el servidor Angular automáticamente?"
  bold "Se ejecutará: bun start"
  read -r -t 30 -p "¿Iniciar? [S/n]: " START_ANGULAR || START_ANGULAR="n"
  if [ -z "${START_ANGULAR:-}" ] || [[ "$START_ANGULAR" =~ ^[Ss]$ ]]; then
    info "Iniciando servidor Angular..."
    bun start &
    ANGULAR_PID=$!
    info "Esperando a que Angular esté listo (PID $ANGULAR_PID)..."

    for i in $(seq 1 90); do
      HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "$BASE_URL" 2>/dev/null || echo "failed")
      if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "302" ]; then
        success "Servidor Angular listo después de ~$((i * 2)) segundos"
        SERVER_RUNNING=true
        break
      fi
      if [ $i -eq 90 ]; then
        error "El servidor Angular no se inició en aproximadamente 180 segundos."
        cleanup
        exit 1
      fi
      sleep 2
    done
  else
    warn "Continuando sin servidor Angular. Las pruebas fallarán si no está corriendo."
  fi
fi

echo ""

# ─── VERIFICAR BACKEND API (OPCIONAL) ──────────────────────────────────────
info "Verificando backend API en $API_URL ..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$API_URL" 2>/dev/null || echo "failed")
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "302" ]; then
  success "Backend API respondiendo (HTTP $HTTP_CODE)"
elif [ "$HTTP_CODE" = "000failed" ] || [ "$HTTP_CODE" = "failed" ]; then
  warn "Backend API no disponible (código: $HTTP_CODE). Las pruebas pueden fallar si requieren datos reales."
  warn "Asegúrate de que el backend esté corriendo en $API_URL"
else
  warn "Backend API respondiendo con código inesperado (HTTP $HTTP_CODE). Las pruebas pueden fallar."
fi

echo ""

# ─── MODO HEADLESS ──────────────────────────────────────────────────────────
if [ "${1:-}" = "--headless" ]; then
  export SELENIUM_HEADLESS="true"
  info "Modo HEADLESS activado (sin interfaz gráfica)"
  echo ""
fi

# ─── EJECUTAR PRUEBAS ──────────────────────────────────────────────────────
bold "============================================"
bold "  Ejecutando pruebas Selenium..."
bold "============================================"
echo ""

if npx tsx "$SELENIUM_SCRIPT"; then
  echo ""
  success "╔══════════════════════════════════════════════╗"
  success "║   TODAS LAS PRUEBAS COMPLETADAS CON ÉXITO   ║"
  success "╚══════════════════════════════════════════════╝"
  echo ""
  success "Reporte HTML: ./selenium-report.html"
  exit 0
else
  EXIT_CODE=$?
  echo ""
  error "╔══════════════════════════════════════════════╗"
  error "║   ALGUNAS PRUEBAS FALLARON (código $EXIT_CODE)    ║"
  error "╚══════════════════════════════════════════════╝"
  echo ""
  error "Reporte HTML: ./selenium-report.html"
  exit $EXIT_CODE
fi
