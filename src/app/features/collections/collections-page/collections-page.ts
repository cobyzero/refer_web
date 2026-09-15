import { Component, HostListener, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CollectionsService } from '../../../data/services/collections';
import { ProductsService } from '../../../data/services/products';
import { ConfigService } from '../../../core/services/config';
import { LanguageService } from '../../../core/services/language';

@Component({
  selector: 'app-collections-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './collections-page.html',
  styleUrl: './collections-page.css',
})
export class CollectionsPageComponent implements OnInit {
  private collectionsService = inject(CollectionsService);
  private productsService = inject(ProductsService);
  private langService = inject(LanguageService);
  private configService = inject(ConfigService);

  t = this.langService.t;
  currencyCode = this.configService.currency;

  collections = this.collectionsService.collections;
  isLoading = this.collectionsService.isLoading;
  listError = this.collectionsService.error;
  products = this.productsService.products;

  selectedId = signal<string | null>(null);
  selected = computed(() => this.collections().find(c => c.id === this.selectedId()) ?? null);
  private lastTrigger: HTMLElement | null = null;

  // Create form
  showCreate = signal(false);
  createName = signal('');
  createDesc = signal('');
  createSubmitted = signal(false);
  isCreating = signal(false);
  createError = signal<string | null>(null);

  // Rename form
  editingId = signal<string | null>(null);
  editName = signal('');
  editDesc = signal('');
  isSavingRename = signal(false);

  // Delete two-tap
  deleteArmedId = signal<string | null>(null);
  private deleteTimer: ReturnType<typeof setTimeout> | null = null;

  // Add product picker
  addSelect = signal('');
  isAddingItem = signal(false);
  actionError = signal<string | null>(null);

  createNameError = computed(() => {
    if (!this.createSubmitted()) return '';
    if (this.createName().trim().length < 2) return this.t().FEAT_ERR_NAME;
    if (this.isDuplicateName(this.createName())) return this.t().FEAT_ERR_DUP;
    return '';
  });

  availableProducts = computed(() => {
    const selected = this.selected();
    if (!selected) return [];
    const inside = new Set(selected.products.map(p => p.id));
    return this.products().filter(p => !inside.has(p.id));
  });

  countLabel = (n: number): string => {
    const es = this.langService.currentLanguage() === 'es';
    if (n === 1) return es ? '1 producto' : '1 product';
    return es ? `${n} productos` : `${n} products`;
  };

  ngOnInit() {
    this.collectionsService.load().subscribe({ error: () => undefined });
    if (!this.products().length) {
      this.productsService.getProducts().subscribe({ error: () => undefined });
    }
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.selectedId()) this.closeDetail();
  }

  retry() {
    this.collectionsService.retry();
  }

  // ── Selection ──
  selectCollection(id: string, event: Event) {
    this.lastTrigger = event.currentTarget as HTMLElement | null;
    this.editingId.set(null);
    this.deleteArmedId.set(null);
    this.actionError.set(null);
    this.addSelect.set('');
    this.selectedId.set(id);
    requestAnimationFrame(() => {
      document.getElementById('collection-detail-title')?.focus({ preventScroll: true });
    });
  }

  closeDetail() {
    this.selectedId.set(null);
    this.editingId.set(null);
    this.deleteArmedId.set(null);
    this.lastTrigger?.focus();
  }

  // ── Create ──
  toggleCreate() {
    this.showCreate.update(v => !v);
    this.createSubmitted.set(false);
    this.createError.set(null);
  }

  saveCollection() {
    this.createSubmitted.set(true);
    this.createError.set(null);
    if (this.createNameError()) {
      document.getElementById('col-name')?.focus();
      return;
    }
    this.isCreating.set(true);
    this.collectionsService.create(this.createName().trim(), this.createDesc().trim()).subscribe({
      next: (collection) => {
        this.isCreating.set(false);
        this.createName.set('');
        this.createDesc.set('');
        this.createSubmitted.set(false);
        this.showCreate.set(false);
        if (collection) this.selectedId.set(collection.id);
      },
      error: (err) => {
        this.isCreating.set(false);
        this.createError.set(err?.error?.message || this.t().FEAT_SAVE_ERROR);
      },
    });
  }

  // ── Rename ──
  startRename() {
    const selected = this.selected();
    if (!selected) return;
    this.editName.set(selected.name);
    this.editDesc.set(selected.description);
    this.editingId.set(selected.id);
  }

  cancelRename() {
    this.editingId.set(null);
  }

  saveRename() {
    const selected = this.selected();
    const name = this.editName().trim();
    if (!selected || name.length < 2 || this.isSavingRename()) return;
    if (this.isDuplicateName(name, selected.id)) {
      this.actionError.set(this.t().FEAT_ERR_DUP);
      return;
    }
    this.isSavingRename.set(true);
    this.actionError.set(null);
    this.collectionsService.rename(selected.id, name, this.editDesc().trim()).subscribe({
      next: () => {
        this.isSavingRename.set(false);
        this.editingId.set(null);
      },
      error: (err) => {
        this.isSavingRename.set(false);
        this.actionError.set(err?.error?.message || this.t().FEAT_SAVE_ERROR);
      },
    });
  }

  // ── Active toggle ──
  toggleActive() {
    const selected = this.selected();
    if (!selected) return;
    this.actionError.set(null);
    this.collectionsService.setActive(selected.id, !selected.isActive).subscribe({
      error: (err) => this.actionError.set(err?.error?.message || this.t().FEAT_SAVE_ERROR),
    });
  }

  // ── Delete (two-tap) ──
  askDelete(id: string) {
    if (this.deleteArmedId() === id) {
      this.confirmDelete(id);
      return;
    }
    this.deleteArmedId.set(id);
    if (this.deleteTimer) clearTimeout(this.deleteTimer);
    this.deleteTimer = setTimeout(() => this.deleteArmedId.set(null), 4000);
  }

  private confirmDelete(id: string) {
    this.deleteArmedId.set(null);
    this.actionError.set(null);
    this.collectionsService.remove(id).subscribe({
      next: () => {
        if (this.selectedId() === id) this.selectedId.set(null);
      },
      error: (err) => this.actionError.set(err?.error?.message || this.t().FEAT_SAVE_ERROR),
    });
  }

  // ── Items ──
  addSelectedProduct() {
    const selected = this.selected();
    const productId = this.addSelect();
    if (!selected || !productId || this.isAddingItem()) return;
    this.isAddingItem.set(true);
    this.actionError.set(null);
    this.collectionsService.addProduct(selected.id, productId).subscribe({
      next: () => {
        this.isAddingItem.set(false);
        this.addSelect.set('');
      },
      error: (err) => {
        this.isAddingItem.set(false);
        this.actionError.set(err?.error?.message || this.t().FEAT_SAVE_ERROR);
      },
    });
  }

  removeProduct(productId: string) {
    const selected = this.selected();
    if (!selected) return;
    this.actionError.set(null);
    this.collectionsService.removeProduct(selected.id, productId).subscribe({
      error: (err) => this.actionError.set(err?.error?.message || this.t().FEAT_SAVE_ERROR),
    });
  }

  hideImg(event: Event) {
    const img = event.target as HTMLImageElement | null;
    if (img) img.style.display = 'none';
  }

  private isDuplicateName(name: string, exceptId?: string): boolean {
    const value = name.trim().toLowerCase();
    return !!value && this.collections().some(
      c => c.id !== exceptId && c.name.trim().toLowerCase() === value
    );
  }
}
