import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_URL } from '../../core/constants/api';
import { tap } from 'rxjs';

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

  getAdminSummary() {
    this.isLoading.set(true);
    return this.http.get<AdminSummary>(`${API_URL}/dashboard/admin/summary`).pipe(
      tap(data => {
        this.summary.set(data);
        this.isLoading.set(false);
      })
    );
  }
}
