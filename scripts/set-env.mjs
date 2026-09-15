#!/usr/bin/env node
/**
 * Genera src/environments/environment.ts y environment.production.ts
 * a partir de las variables del archivo .env (raíz del proyecto).
 *
 * Sin dependencias: parsea KEY=VALUE manualmente.
 * Si no existe .env, usa los valores por defecto de desarrollo.
 *
 * Uso: node scripts/set-env.mjs  (también vía hooks pre-start/pre-build)
 */
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(rootDir, '.env');
const outDir = join(rootDir, 'src', 'environments');

/** Defaults = desarrollo local (mismos que había hardcodeados en api.ts) */
const DEFAULTS = {
  APP_BACKEND_URL: 'http://localhost:3000',
  APP_API_PATH: '/api/v1',
  APP_API_URL: '',
  APP_BASE_URL: 'http://localhost:4200',
  APP_ENV: 'development',
};

function parseDotEnv(path) {
  const vars = {};
  if (!existsSync(path)) return vars;
  for (const rawLine of readFileSync(path, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // Quita comillas envolventes y comentarios finales no citados
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else {
      const hash = value.indexOf(' #');
      if (hash !== -1) value = value.slice(0, hash).trim();
    }
    vars[key] = value;
  }
  return vars;
}

function noTrailingSlash(url) {
  return url.length > 1 ? url.replace(/\/+$/, '') : url;
}

const env = { ...DEFAULTS, ...parseDotEnv(envPath) };
const backendUrl = noTrailingSlash(env.APP_BACKEND_URL);
const apiUrl = env.APP_API_URL
  ? noTrailingSlash(env.APP_API_URL)
  : `${backendUrl}${env.APP_API_PATH.startsWith('/') ? env.APP_API_PATH : `/${env.APP_API_PATH}`}`;
const baseUrl = noTrailingSlash(env.APP_BASE_URL);

function render(production) {
  return `// AUTO-GENERADO por scripts/set-env.mjs — no editar a mano.
// Fuente de verdad: .env (ver .env.example).
// Regenerar: npm run env:sync
export const environment = {
  production: ${production},
  backendUrl: '${backendUrl}',
  apiUrl: '${apiUrl}',
  baseUrl: '${baseUrl}',
} as const;
`;
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'environment.ts'), render(false));
writeFileSync(join(outDir, 'environment.production.ts'), render(true));

console.log(`[env] backendUrl=${backendUrl} apiUrl=${apiUrl} baseUrl=${baseUrl} (production build → production file)`);
