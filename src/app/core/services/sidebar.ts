import { Injectable, signal } from '@angular/core';

/**
 * Estado del sidebar push (siempre visible, en flujo flex).
 * - Desktop: el CSS ignora `expanded` — el panel va siempre completo.
 * - Móvil (<=1023px): riel de iconos salvo `expanded == true`, que lo
 *   ensancha empujando el contenido (nunca overlay).
 */
@Injectable({
  providedIn: 'root'
})
export class SidebarService {
  expanded = signal(false);

  toggle() {
    this.expanded.update((v) => !v);
  }

  setExpanded(value: boolean) {
    this.expanded.set(value);
  }
}
