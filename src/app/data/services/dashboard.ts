import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_URL } from '../../core/constants/api';
import { finalize, tap } from 'rxjs';

export interface DashboardStat {
  label: string;
  value: string;
  change: string;
  icon: string;
  color: string;
}

export interface ActivityItem {
  user: string;
  action: string;
  time: string;
  avatar: string;
}

export interface AdminSummary {
  stats: DashboardStat[];
  recentActivity: ActivityItem[];
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private http = inject(HttpClient);

  summary = signal<AdminSummary | null>(null);
  isLoading = signal(false);
  error = signal<string | null>(null);

  getAdminSummary() {
    this.isLoading.set(true);
    this.error.set(null);
    return this.http.get<AdminSummary>(`${API_URL}/dashboard/admin/summary`).pipe(
      tap({
        next: (data) => this.summary.set(data),
        error: (err) =>
          this.error.set(
            err?.error?.message ||
              'No pudimos cargar el resumen. Revisa tu conexión e inténtalo de nuevo.'
          ),
      }),
      // Always release the loading state — success or failure.
      finalize(() => this.isLoading.set(false))
    );
  }

  retry() {
    this.getAdminSummary().subscribe();
  }
}
