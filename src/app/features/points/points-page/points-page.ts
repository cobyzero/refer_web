import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PointsService, Reward, StarTransaction } from '../../../data/services/points';

@Component({
  selector: 'app-points-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './points-page.html',
  styleUrl: './points-page.css'
})
export class PointsPageComponent implements OnInit {
  private pointsService = inject(PointsService);
  private router = inject(Router);

  rewards = this.pointsService.rewards;
  transactions = this.pointsService.transactions;
  isLoading = this.pointsService.isLoading;
  loadError = this.pointsService.error;

  // Active tab: 'rewards' or 'history'
  activeTab = signal<'rewards' | 'history'>('rewards');

  // Search filter
  searchTerm = signal('');

  // Detail view state (read-only). Creation & edition live in their own view.
  selectedReward = signal<Reward | null>(null);

  // Toast notification
  toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);

  // Search filtering
  filteredRewards = computed(() => {
    const list = this.rewards();
    const query = this.searchTerm().toLowerCase().trim();
    if (!query) return list;
    return list.filter(r => 
      r.title.toLowerCase().includes(query) || 
      r.description.toLowerCase().includes(query)
    );
  });

  filteredTransactions = computed(() => {
    const list = this.transactions();
    const query = this.searchTerm().toLowerCase().trim();
    if (!query) return list;
    return list.filter(tx => 
      tx.title.toLowerCase().includes(query) || 
      tx.user?.name.toLowerCase().includes(query) ||
      tx.user?.email.toLowerCase().includes(query)
    );
  });

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.pointsService.getRewards().subscribe();
    this.pointsService.getTransactions().subscribe();
  }

  switchTab(tab: 'rewards' | 'history') {
    this.activeTab.set(tab);
    this.searchTerm.set('');
    this.selectedReward.set(null);
  }

  openAddReward() {
    this.router.navigate(['/points/rewards/new']);
  }

  openDetail(reward: Reward) {
    this.selectedReward.set(reward);
  }

  closeDetail() {
    this.selectedReward.set(null);
  }

  startEdit(reward: Reward) {
    this.router.navigate(['/points/rewards', reward.id, 'edit']);
  }

  deleteReward(id: string) {
    if (confirm('¿Estás seguro de que deseas eliminar esta recompensa del catálogo?')) {
      this.pointsService.deleteReward(id).subscribe({
        next: () => {
          if (this.selectedReward()?.id === id) {
            this.selectedReward.set(null);
          }
          this.showToast('Recompensa eliminada correctamente', 'success');
        },
        error: (err) => {
          console.error(err);
          this.showToast(err?.error?.message || 'Error al eliminar la recompensa', 'error');
        }
      });
    }
  }

  private showToast(message: string, type: 'success' | 'error') {
    this.toast.set({ message, type });
    setTimeout(() => this.toast.set(null), 3500);
  }
}
