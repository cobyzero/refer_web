import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfigService, VERSION_PATTERN } from '../../../core/services/config';
import { LanguageService } from '../../../core/services/language';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.css',
})
export class SettingsPageComponent implements OnInit {
  private configService = inject(ConfigService);
  private langService = inject(LanguageService);

  t = this.langService.t;
  options = this.configService.currencyList;
  currency = this.configService.currency;
  isSaving = this.configService.isSaving;
  currentLang = this.langService.currentLanguage;

  selected = signal('');
  taxEnabledSel = signal(true);
  /** Tasa en porcentaje 0..100 para el input. */
  taxRatePct = signal(0);
  /** Tarifa de servicio en porcentaje 0..100 para el input. */
  feePct = signal(0);
  /** Última versión publicada (p. ej. "1.2.0"). */
  versionSel = signal('');
  /** Versión mínima soportada (p. ej. "1.0.0"). */
  minVersionSel = signal('');
  /** Testing: la app puede confirmar pedidos sin pasar por Stripe. */
  directConfirmSel = signal(false);
  saved = signal(false);
  saveError = signal<string | null>(null);

  dirty = computed(
    () =>
      (!!this.selected() && this.selected() !== this.currency()) ||
      this.taxEnabledSel() !== this.configService.taxEnabled() ||
      this.rateFraction() !== this.configService.taxRate() ||
      this.feeFraction() !== this.configService.serviceFeeRate() ||
      (this.isValidVersion(this.versionSel()) &&
        this.versionSel().trim() !== this.configService.appVersion()) ||
      (this.isValidVersion(this.minVersionSel()) &&
        this.minVersionSel().trim() !== this.configService.appMinVersion()) ||
      this.directConfirmSel() !== this.configService.directConfirmEnabled()
  );

  /** Tasa como fracción 0..1, sanea el input. */
  rateFraction = computed(() => this.toFraction(this.taxRatePct()));

  /** Tarifa como fracción 0..1, sanea el input. */
  feeFraction = computed(() => this.toFraction(this.feePct()));

  rateError = computed(() => this.pctError(this.taxRatePct(), this.t().SETTINGS_TAX_RATE_ERROR));

  feeError = computed(() => this.pctError(this.feePct(), this.t().SETTINGS_FEE_RATE_ERROR));

  /** Error de formato en versión/minVersion, o min > version. */
  versionError = computed(() => {
    const v = this.versionSel().trim();
    if (!this.isValidVersion(v)) return this.t().SETTINGS_VERSION_ERROR;
    const m = this.minVersionSel().trim();
    if (!this.isValidVersion(m)) return '';
    return this.compareVersions(m, v) > 0 ? this.t().SETTINGS_MIN_VERSION_ERROR : '';
  });

  minVersionError = computed(() => {
    const m = this.minVersionSel().trim();
    if (!this.isValidVersion(m)) return this.t().SETTINGS_VERSION_ERROR;
    const v = this.versionSel().trim();
    if (!this.isValidVersion(v)) return '';
    return this.compareVersions(m, v) > 0 ? this.t().SETTINGS_MIN_VERSION_ERROR : '';
  });

  hasErrors = computed(
    () => !!this.rateError() || !!this.feeError() || !!this.versionError() || !!this.minVersionError()
  );

  optionName = (code: string): string => {
    const opt = this.options.find(o => o.code === code);
    if (!opt) return code;
    return this.currentLang() === 'es' ? opt.nameEs : opt.nameEn;
  };

  ngOnInit() {
    this.selected.set(this.currency());
    this.taxEnabledSel.set(this.configService.taxEnabled());
    this.taxRatePct.set(this.toPct(this.configService.taxRate()));
    this.feePct.set(this.toPct(this.configService.serviceFeeRate()));
    this.versionSel.set(this.configService.appVersion());
    this.minVersionSel.set(this.configService.appMinVersion());
    this.directConfirmSel.set(this.configService.directConfirmEnabled());
  }

  save() {
    if (!this.dirty() || this.hasErrors()) return;
    this.saved.set(false);
    this.saveError.set(null);
    this.configService
      .saveSettings({
        currency: this.selected() || undefined,
        taxEnabled: this.taxEnabledSel(),
        taxRate: this.rateFraction(),
        serviceFeeRate: this.feeFraction(),
        version: this.versionSel().trim() || undefined,
        minVersion: this.minVersionSel().trim() || undefined,
        directConfirmEnabled: this.directConfirmSel(),
      })
      .subscribe({
        next: (res) => {
          if (!res) {
            this.saveError.set(this.t().SETTINGS_SAVE_ERROR);
            return;
          }
          this.selected.set(this.currency());
          this.taxEnabledSel.set(this.configService.taxEnabled());
          this.taxRatePct.set(this.toPct(this.configService.taxRate()));
          this.feePct.set(this.toPct(this.configService.serviceFeeRate()));
          this.versionSel.set(this.configService.appVersion());
          this.minVersionSel.set(this.configService.appMinVersion());
          this.directConfirmSel.set(this.configService.directConfirmEnabled());
          this.saved.set(true);
        },
        error: () => this.saveError.set(this.t().SETTINGS_SAVE_ERROR),
      });
  }

  private isValidVersion(v: string): boolean {
    return VERSION_PATTERN.test(v.trim());
  }

  /** -1 si a < b, 0 si iguales, 1 si a > b. Partes faltantes = 0. */
  private compareVersions(a: string, b: string): number {
    const pa = a.trim().split('.').map(Number);
    const pb = b.trim().split('.').map(Number);
    const n = Math.max(pa.length, pb.length);
    for (let i = 0; i < n; i++) {
      const va = pa[i] ?? 0;
      const vb = pb[i] ?? 0;
      if (va < vb) return -1;
      if (va > vb) return 1;
    }
    return 0;
  }

  private toPct(fraction: number): number {
    return Math.round(fraction * 10000) / 100;
  }

  private toFraction(pctSignal: number): number {
    const pct = Number(pctSignal);
    if (!Number.isFinite(pct)) return 0;
    return Math.min(100, Math.max(0, pct)) / 100;
  }

  private pctError(pctSignal: number, message: string): string {
    const pct = Number(pctSignal);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      return message;
    }
    return '';
  }
}
