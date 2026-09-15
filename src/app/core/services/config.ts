import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, finalize, of, tap } from 'rxjs';
import { API_URL } from '../constants/api';

export interface CurrencyOption {
  code: string;
  symbol: string;
  nameEs: string;
  nameEn: string;
}

/** Must stay in sync with SupportedCurrencies in refer_api (config_service.go). */
export const SUPPORTED_CURRENCIES: CurrencyOption[] = [
  { code: 'USD', symbol: '$', nameEs: 'Dólar estadounidense', nameEn: 'US Dollar' },
  { code: 'MXN', symbol: '$', nameEs: 'Peso mexicano', nameEn: 'Mexican Peso' },
  { code: 'COP', symbol: '$', nameEs: 'Peso colombiano', nameEn: 'Colombian Peso' },
  { code: 'PEN', symbol: 'S/', nameEs: 'Sol peruano', nameEn: 'Peruvian Sol' },
  { code: 'CLP', symbol: '$', nameEs: 'Peso chileno', nameEn: 'Chilean Peso' },
  { code: 'ARS', symbol: '$', nameEs: 'Peso argentino', nameEn: 'Argentine Peso' },
  { code: 'BRL', symbol: 'R$', nameEs: 'Real brasileño', nameEn: 'Brazilian Real' },
  { code: 'EUR', symbol: '€', nameEs: 'Euro', nameEn: 'Euro' },
  { code: 'GBP', symbol: '£', nameEs: 'Libra esterlina', nameEn: 'British Pound' },
  { code: 'CAD', symbol: '$', nameEs: 'Dólar canadiense', nameEn: 'Canadian Dollar' },
];

export const DEFAULT_CURRENCY = 'USD';
export const DEFAULT_TAX_RATE = 0.08;
export const DEFAULT_TAX_ENABLED = true;
export const DEFAULT_SERVICE_FEE_RATE = 0;
export const DEFAULT_APP_VERSION = '1.0.0';
/** Testing only: allow order confirmation without Stripe. Never true in prod. */
export const DEFAULT_DIRECT_CONFIRM_ENABLED = false;

/** Versión numérica: "1", "1.0" o "1.0.0". */
export const VERSION_PATTERN = /^\d+(\.\d+){0,2}$/;

interface ConfigResponse {
  /** Última versión publicada (forzar/sugerir update en la app). */
  version?: string;
  /** Versión mínima soportada (bloqueo en la app). */
  minVersion?: string;
  settings?: {
    currency?: string;
    tax_enabled?: string;
    tax_rate?: string;
    service_fee_rate?: string;
    app_version?: string;
    app_min_version?: string;
    direct_confirm_enabled?: string;
  };
}

type SaveResponse = {
  settings?: {
    currency?: string;
    tax_enabled?: string;
    tax_rate?: string;
    service_fee_rate?: string;
    app_version?: string;
    app_min_version?: string;
    direct_confirm_enabled?: string;
  };
} | null;

export interface SettingsPayload {
  currency?: string;
  taxEnabled?: boolean;
  /** Fracción 0..1 (0.08 = 8%). */
  taxRate?: number;
  /** Fracción 0..1 (0.05 = 5%). */
  serviceFeeRate?: number;
  /** Última versión publicada (p. ej. "1.2.0"). */
  version?: string;
  /** Versión mínima soportada (p. ej. "1.0.0"). */
  minVersion?: string;
  /** Testing: permitir confirmar pedidos sin Stripe. Jamás en prod. */
  directConfirmEnabled?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private http = inject(HttpClient);

  /** Display currency for the whole admin panel. Preloaded at boot. */
  currency = signal<string>(DEFAULT_CURRENCY);
  /** Whether the app charges estimated tax. Preloaded at boot. */
  taxEnabled = signal<boolean>(DEFAULT_TAX_ENABLED);
  /** Tax fraction 0..1 (0.08 = 8%). Preloaded at boot. */
  taxRate = signal<number>(DEFAULT_TAX_RATE);
  /** Service fee fraction 0..1 (0.05 = 5%). Preloaded at boot. */
  serviceFeeRate = signal<number>(DEFAULT_SERVICE_FEE_RATE);
  /** Latest published app version. Preloaded at boot. */
  appVersion = signal<string>(DEFAULT_APP_VERSION);
  /** Minimum supported app version. Preloaded at boot. */
  appMinVersion = signal<string>(DEFAULT_APP_VERSION);
  /** Testing only: the mobile app may confirm orders without Stripe. */
  directConfirmEnabled = signal<boolean>(DEFAULT_DIRECT_CONFIRM_ENABLED);
  loaded = signal(false);
  isSaving = signal(false);

  readonly currencyList = SUPPORTED_CURRENCIES;

  load() {
    return this.http.get<ConfigResponse | null>(`${API_URL}/config`).pipe(
      tap(res => {
        const code = (res?.settings?.currency ?? '').toUpperCase();
        this.currency.set(this.isSupported(code) ? code : DEFAULT_CURRENCY);
        this.taxEnabled.set(this.parseTaxEnabled(res?.settings?.tax_enabled));
        this.taxRate.set(this.parseFraction(res?.settings?.tax_rate, DEFAULT_TAX_RATE));
        this.serviceFeeRate.set(
          this.parseFraction(res?.settings?.service_fee_rate, DEFAULT_SERVICE_FEE_RATE)
        );
        // Top-level first (mobile contract), settings keys as fallback.
        const version = (res?.version ?? res?.settings?.app_version ?? '').trim();
        const minVersion = (res?.minVersion ?? res?.settings?.app_min_version ?? '').trim();
        this.appVersion.set(this.isValidVersion(version) ? version : DEFAULT_APP_VERSION);
        this.appMinVersion.set(
          this.isValidVersion(minVersion) ? minVersion : this.appVersion()
        );
        this.directConfirmEnabled.set(
          this.parseBool(res?.settings?.direct_confirm_enabled, DEFAULT_DIRECT_CONFIRM_ENABLED)
        );
        this.loaded.set(true);
      }),
      // Never block boot on config: fall back to defaults.
      catchError(() => {
        this.currency.set(DEFAULT_CURRENCY);
        this.taxEnabled.set(DEFAULT_TAX_ENABLED);
        this.taxRate.set(DEFAULT_TAX_RATE);
        this.serviceFeeRate.set(DEFAULT_SERVICE_FEE_RATE);
        this.appVersion.set(DEFAULT_APP_VERSION);
        this.appMinVersion.set(DEFAULT_APP_VERSION);
        this.directConfirmEnabled.set(DEFAULT_DIRECT_CONFIRM_ENABLED);
        this.loaded.set(true);
        return of(null);
      })
    );
  }

  saveCurrency(code: string): Observable<SaveResponse> {
    const normalized = code.toUpperCase();
    if (!this.isSupported(normalized)) return of(null);
    this.isSaving.set(true);
    return this.http.put<SaveResponse>(`${API_URL}/config`, { currency: normalized }).pipe(
      tap(res => {
        const saved = (res?.settings?.currency ?? normalized).toUpperCase();
        this.currency.set(this.isSupported(saved) ? saved : DEFAULT_CURRENCY);
      }),
      finalize(() => this.isSaving.set(false))
    );
  }

  saveSettings(payload: SettingsPayload): Observable<SaveResponse> {
    const body: Record<string, unknown> = {};
    if (payload.currency !== undefined) {
      const normalized = payload.currency.toUpperCase();
      if (!this.isSupported(normalized)) return of(null);
      body['currency'] = normalized;
    }
    if (payload.taxEnabled !== undefined) body['taxEnabled'] = payload.taxEnabled;
    if (payload.taxRate !== undefined) {
      if (!this.isValidRate(payload.taxRate)) return of(null);
      body['taxRate'] = payload.taxRate;
    }
    if (payload.serviceFeeRate !== undefined) {
      if (!this.isValidRate(payload.serviceFeeRate)) return of(null);
      body['serviceFeeRate'] = payload.serviceFeeRate;
    }
    if (payload.version !== undefined) {
      if (!this.isValidVersion(payload.version)) return of(null);
      body['version'] = payload.version.trim();
    }
    if (payload.minVersion !== undefined) {
      if (!this.isValidVersion(payload.minVersion)) return of(null);
      body['minVersion'] = payload.minVersion.trim();
    }
    if (payload.directConfirmEnabled !== undefined) {
      body['directConfirmEnabled'] = payload.directConfirmEnabled;
    }
    this.isSaving.set(true);
    return this.http.put<SaveResponse>(`${API_URL}/config`, body).pipe(
      tap(res => {
        const s = res?.settings;
        if (s?.currency !== undefined) {
          const saved = (s.currency ?? '').toUpperCase();
          this.currency.set(this.isSupported(saved) ? saved : DEFAULT_CURRENCY);
        }
        if (s?.tax_enabled !== undefined) {
          this.taxEnabled.set(this.parseTaxEnabled(s.tax_enabled));
        }
        if (s?.tax_rate !== undefined) {
          this.taxRate.set(this.parseFraction(s.tax_rate, DEFAULT_TAX_RATE));
        }
        if (s?.service_fee_rate !== undefined) {
          this.serviceFeeRate.set(
            this.parseFraction(s.service_fee_rate, DEFAULT_SERVICE_FEE_RATE)
          );
        }
        if (s?.app_version !== undefined && this.isValidVersion(s.app_version)) {
          this.appVersion.set(s.app_version.trim());
        }
        if (s?.app_min_version !== undefined && this.isValidVersion(s.app_min_version)) {
          this.appMinVersion.set(s.app_min_version.trim());
        }
        if (s?.direct_confirm_enabled !== undefined) {
          this.directConfirmEnabled.set(
            this.parseBool(s.direct_confirm_enabled, DEFAULT_DIRECT_CONFIRM_ENABLED)
          );
        }
      }),
      finalize(() => this.isSaving.set(false))
    );
  }

  isValidVersion(v: string | undefined): boolean {
    return typeof v === 'string' && VERSION_PATTERN.test(v.trim());
  }

  private isSupported(code: string): boolean {
    return SUPPORTED_CURRENCIES.some(c => c.code === code);
  }

  private isValidRate(rate: number): boolean {
    return Number.isFinite(rate) && rate >= 0 && rate <= 1;
  }

  private parseFraction(raw: string | undefined, fallback: number): number {
    const rate = Number(raw);
    return this.isValidRate(rate) ? rate : fallback;
  }

  private parseTaxEnabled(raw: string | undefined): boolean {
    if (raw === undefined) return DEFAULT_TAX_ENABLED;
    const v = raw.trim().toLowerCase();
    if (v === 'true' || v === '1') return true;
    if (v === 'false' || v === '0') return false;
    return DEFAULT_TAX_ENABLED;
  }

  private parseBool(raw: string | undefined, fallback: boolean): boolean {
    if (raw === undefined) return fallback;
    const v = raw.trim().toLowerCase();
    if (v === 'true' || v === '1') return true;
    if (v === 'false' || v === '0') return false;
    return fallback;
  }
}
