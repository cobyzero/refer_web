import { Component, computed, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CatalogChildItem, ProductsService } from '../../../data/services/products';
import { ConfigService } from '../../../core/services/config';
import { LanguageService } from '../../../core/services/language';

@Component({
  selector: 'app-variants-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './variants-page.html',
  styleUrl: '../shared/manage-list.css',
})
export class VariantsPageComponent implements OnInit, OnDestroy {
  private productsService = inject(ProductsService);
  private langService = inject(LanguageService);
  private configService = inject(ConfigService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  t = this.langService.t;
  currencyCode = this.configService.currency;
  products = this.productsService.products;

  /** Back button only shows when we came from another view (e.g. new product). */
  returnTo = signal('');
  showBack = computed(() => this.returnTo() !== '');

  items = signal<CatalogChildItem[]>([]);
  isLoading = signal(false);
  loadError = signal<string | null>(null);
  actionError = signal<string | null>(null);

  productPick = signal('');
  name = signal('');
  price = signal<number | null>(null);
  touched = signal(false);
  isCreating = signal(false);
  formError = signal<string | null>(null);

  deleteArmedId = signal<string | null>(null);
  private deleteTimer: ReturnType<typeof setTimeout> | null = null;

  formErrorText = computed(() => {
    if (!this.touched()) return '';
    if (!this.productPick()) return this.t().VARIANTS_ERR_PRODUCT;
    if (this.name().trim().length < 2) return this.t().VARIANTS_ERR_NAME;
    return '';
  });

  ngOnInit() {
    const requested = this.route.snapshot.queryParamMap.get('returnTo') ?? '';
    if (requested.startsWith('/') && !requested.startsWith('//')) {
      this.returnTo.set(requested);
    }
    this.load();
    if (!this.products().length) {
      this.productsService.getProducts().subscribe({ error: () => undefined });
    }
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
    this.productsService.getAllTypes().subscribe({
      next: (items) => {
        this.isLoading.set(false);
        this.items.set(items ?? []);
      },
      error: () => {
        this.isLoading.set(false);
        this.loadError.set(this.t().MGR_ERROR);
      },
    });
  }

  create() {
    this.touched.set(true);
    this.formError.set(null);
    if (this.formErrorText() || this.isCreating()) return;
    this.isCreating.set(true);
    this.productsService
      .addType(this.productPick(), {
        name: this.name().trim(),
        price: Number(this.price()) || 0,
      })
      .subscribe({
        next: () => {
          this.isCreating.set(false);
          this.productPick.set('');
          this.name.set('');
          this.price.set(null);
          this.touched.set(false);
          this.load();
        },
        error: (err) => {
          this.isCreating.set(false);
          this.formError.set(err?.error?.message || this.t().MGR_SAVE_ERROR);
        },
      });
  }

  askDelete(item: CatalogChildItem) {
    if (this.deleteArmedId() === item.id) {
      this.confirmDelete(item);
      return;
    }
    this.deleteArmedId.set(item.id);
    if (this.deleteTimer) clearTimeout(this.deleteTimer);
    this.deleteTimer = setTimeout(() => this.deleteArmedId.set(null), 4000);
  }

  private confirmDelete(item: CatalogChildItem) {
    this.deleteArmedId.set(null);
    this.actionError.set(null);
    this.productsService.deleteType(item.productId, item.id).subscribe({
      next: () => this.load(),
      error: () => this.actionError.set(this.t().MGR_SAVE_ERROR),
    });
  }
}
