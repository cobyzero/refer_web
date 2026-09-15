import { environment } from '../../../environments/environment';

/**
 * URLs del backend. Fuente de verdad: `.env` (ver `.env.example`).
 * Se materializan en `src/environments/environment*.ts` vía `npm run env:sync`.
 * Los nombres se conservan para no tocar los consumers (services, socket).
 */
export const BASE_URL = environment.backendUrl;
export const API_URL = environment.apiUrl;
export const APP_BASE_URL = environment.baseUrl;
