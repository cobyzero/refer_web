import { Component, computed, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductsService } from '../../../data/services/products';
import { LanguageService } from '../../../core/services/language';

@Component({
  selector: 'app-sizes-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sizes-page.html',
  styleUrl: '../shared/manage-list.css',
})
export class SizesPageComponent implements OnInit, OnDestroy {
  private productsService = inject(ProductsService);
  private langService = inject(LanguageService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  t = this.langService.t;
  sizes = this.productsService.sizes;

  /** Back button only shows when we came from another view (e.g. new product). */
  returnTo = signal('');
  showBack = computed(() => this.returnTo() !== '');

  isLoading = signal(false);
  loadError = signal<string | null>(null);
  actionError = signal<string | null>(null);

  name = signal('');
  touched = signal(false);
  isCreating = signal(false);
  formError = signal<string | null>(null);

  deleteArmedId = signal<string | null>(null);
  private deleteTimer: ReturnType<typeof setTimeout> | null = null;

  nameError = computed(() => {
    if (!this.touched()) return '';
    if (this.name().trim().length < 2) return this.t().SIZES_ERR;
    if (this.sizes().some(s => s.name.trim().toLowerCase() === this.name().trim().toLowerCase())) {
      return this.t().SIZES_ERR;
    }
    return '';
  });

  ngOnInit() {
    const requested = this.route.snapshot.queryParamMap.get('returnTo') ?? '';
    if (requested.startsWith('/') && !requested.startsWith('//')) {
      this.returnTo.set(requested);
    }
    this.load();
  }

  back() {
    if (this.returnTo()) this.router.navigateByUrl(this.returnTo());
  }

  ngOnDestroy() {
    if (this.deleteTimer) clearTimeout(this.deleteTimer);
  }

  load() {
    this.isLoading.set(true);
    this.loadError.set(null);
    this.productsService.getSizes().subscribe({
      next: () => this.isLoading.set(false),
      error: () => {
        this.isLoading.set(false);
        this.loadError.set(this.t().MGR_ERROR);
      },
    });
  }

  create() {
    this.touched.set(true);
    this.formError.set(null);
    if (this.nameError() || this.isCreating()) return;
    this.isCreating.set(true);
    this.productsService.createSize(this.name().trim()).subscribe({
      next: () => {
        this.isCreating.set(false);
        this.name.set('');
        this.touched.set(false);
      },
      error: (err) => {
        this.isCreating.set(false);
        this.formError.set(err?.error?.message || this.t().MGR_SAVE_ERROR);
      },
    });
  }

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
    this.productsService.deleteSize(id).subscribe({
      error: () => this.actionError.set(this.t().MGR_SAVE_ERROR),
    });
  }
}
