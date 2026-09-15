import { Component, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DashboardService } from '../../../data/services/dashboard';

interface QuickAction {
  label: string;
  hint: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.css',
})
export class DashboardPageComponent implements OnInit {
  private dashboardService = inject(DashboardService);

  summary = this.dashboardService.summary;
  isLoading = this.dashboardService.isLoading;
  error = this.dashboardService.error;

  /** Refresh in progress while previous data stays visible. */
  isRefreshing = computed(() => this.isLoading() && !!this.summary());

  /** Null-safe activity list (API type says required, runtime may differ). */
  activity = computed(() => this.summary()?.recentActivity ?? []);

  today = new Date();

  /** "jueves, 3 de septiembre" — via Intl to avoid touching the global LOCALE_ID. */
  todayLabel = new Intl.DateTimeFormat('es', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(this.today);

  quickActions: QuickAction[] = [
    { label: 'Pedidos', hint: 'Ver y actualizar estados', icon: 'receipt_long', route: '/orders' },
    { label: 'Productos', hint: 'Menú, precios y fotos', icon: 'local_cafe', route: '/products' },
    { label: 'Usuarios', hint: 'Equipo y roles', icon: 'group', route: '/users' },
    { label: 'Puntos', hint: 'Recompensas y canjes', icon: 'stars', route: '/points' },
  ];

  ngOnInit() {
    if (!this.summary()) {
      this.dashboardService.getAdminSummary().subscribe();
    }
  }

  refresh() {
    this.dashboardService.retry();
  }

  /** Trend direction without crashing on empty/missing change strings. */
  isPositive(change: string | null | undefined): boolean {
    return !!change && change.trim().startsWith('+');
  }

  trendLabel(stat: { change: string; label: string }): string {
    if (!stat.change) return stat.label;
    return `${stat.label}: ${stat.change} respecto al periodo anterior`;
  }
}
