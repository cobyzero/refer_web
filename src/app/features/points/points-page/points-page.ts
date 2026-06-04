import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PointsService, Reward, StarTransaction } from '../../../data/services/points';
import { ProductsService } from '../../../data/services/products';

@Component({
  selector: 'app-points-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './points-page.html',
  styleUrl: './points-page.css'
})
export class PointsPageComponent implements OnInit {
  private pointsService = inject(PointsService);
  private productsService = inject(ProductsService);

  rewards = this.pointsService.rewards;
  transactions = this.pointsService.transactions;
  isLoading = this.pointsService.isLoading;
  productsList = this.productsService.products;

  // Active tab: 'rewards' or 'history'
  activeTab = signal<'rewards' | 'history'>('rewards');

  // Search filter
  searchTerm = signal('');

  // Modals & detail view states
  selectedReward = signal<Reward | null>(null);
  isEditing = signal(false);
  isAdding = signal(false);

  // Toast notification
  toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);

  // Form Fields for Reward
  formTitle = signal('');
  formDescription = signal('');
  formStarsRequired = signal(0);
  formImageUrl = signal('');
  formIcon = signal('stars');
  formIsActive = signal(true);
  formProductId = signal('');

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
    this.productsService.getProducts().subscribe();
  }

  loadData() {
    this.pointsService.getRewards().subscribe();
    this.pointsService.getTransactions().subscribe();
  }

  switchTab(tab: 'rewards' | 'history') {
    this.activeTab.set(tab);
    this.searchTerm.set('');
    this.selectedReward.set(null);
    this.isEditing.set(false);
    this.isAdding.set(false);
  }

  openAddModal() {
    this.formTitle.set('');
    this.formDescription.set('');
    this.formStarsRequired.set(50);
    this.formImageUrl.set('');
    this.formIcon.set('stars');
    this.formIsActive.set(true);
    this.formProductId.set('');
    this.isAdding.set(true);
    this.isEditing.set(false);
    this.selectedReward.set(null);
  }

  closeAddModal() {
    this.isAdding.set(false);
  }

  openDetail(reward: Reward) {
    this.selectedReward.set(reward);
    this.isEditing.set(false);
    this.isAdding.set(false);
  }

  closeDetail() {
    this.selectedReward.set(null);
    this.isEditing.set(false);
  }

  startEdit(reward: Reward) {
    this.selectedReward.set(reward);
    this.formTitle.set(reward.title);
    this.formDescription.set(reward.description);
    this.formStarsRequired.set(reward.starsRequired);
    this.formImageUrl.set(reward.imageUrl || '');
    this.formIcon.set(reward.icon || 'stars');
    this.formIsActive.set(reward.isActive);
    this.formProductId.set(reward.productId || '');
    this.isEditing.set(true);
    this.isAdding.set(false);
  }

  onProductChange(productId: string) {
    this.formProductId.set(productId);
    if (productId) {
      const prod = this.productsList().find(p => p.id === productId);
      if (prod) {
        this.formTitle.set(prod.name);
        this.formDescription.set(prod.description || '');
        this.formImageUrl.set(prod.imageUrl || '');
      }
    }
  }

  saveNewReward() {
    if (!this.formProductId()) {
      this.showToast('Debe seleccionar un producto asignado', 'error');
      return;
    }
    if (!this.formTitle().trim() || !this.formDescription().trim()) {
      this.showToast('El título y la descripción son requeridos', 'error');
      return;
    }
    if (this.formStarsRequired() <= 0) {
      this.showToast('Los puntos requeridos deben ser mayor a 0', 'error');
      return;
    }

    const payload = {
      title: this.formTitle().trim(),
      description: this.formDescription().trim(),
      starsRequired: Number(this.formStarsRequired()),
      imageUrl: this.formImageUrl().trim() || undefined,
      icon: this.formIcon().trim() || 'stars',
      isActive: this.formIsActive(),
      productId: this.formProductId() || undefined
    };

    this.pointsService.createReward(payload).subscribe({
      next: () => {
        this.isAdding.set(false);
        this.showToast('Recompensa creada correctamente', 'success');
      },
      error: (err) => {
        console.error(err);
        this.showToast(err?.error?.message || 'Error al crear la recompensa', 'error');
      }
    });
  }

  saveEdit() {
    const reward = this.selectedReward();
    if (!reward) return;

    if (!this.formProductId()) {
      this.showToast('Debe seleccionar un producto asignado', 'error');
      return;
    }
    if (!this.formTitle().trim() || !this.formDescription().trim()) {
      this.showToast('El título y la descripción son requeridos', 'error');
      return;
    }
    if (this.formStarsRequired() <= 0) {
      this.showToast('Los puntos requeridos deben ser mayor a 0', 'error');
      return;
    }

    const payload = {
      title: this.formTitle().trim(),
      description: this.formDescription().trim(),
      starsRequired: Number(this.formStarsRequired()),
      imageUrl: this.formImageUrl().trim() || undefined,
      icon: this.formIcon().trim() || 'stars',
      isActive: this.formIsActive(),
      productId: this.formProductId() || undefined
    };

    this.pointsService.updateReward(reward.id, payload).subscribe({
      next: (updatedReward) => {
        this.selectedReward.set(updatedReward);
        this.isEditing.set(false);
        this.showToast('Recompensa actualizada correctamente', 'success');
      },
      error: (err) => {
        console.error(err);
        this.showToast(err?.error?.message || 'Error al actualizar la recompensa', 'error');
      }
    });
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
