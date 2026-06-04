import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardService } from '../../../data/services/dashboard';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.css',
})
export class DashboardPageComponent implements OnInit {
  private dashboardService = inject(DashboardService);

  summary = this.dashboardService.summary;
  isLoading = this.dashboardService.isLoading;

  ngOnInit() {
    this.dashboardService.getAdminSummary().subscribe();
  }
}
