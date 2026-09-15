import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ProductsService, Product, ProductCategory } from '../../../data/services/products';
import { LanguageService } from '../../../core/services/language';
import { ConfigService } from '../../../core/services/config';

@Component({
  selector: 'app-products-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './products-page.html',
  styleUrl: './products-page.css',
})
export class ProductsPageComponent implements OnInit {
  private productsService = inject(ProductsService);
  private langService = inject(LanguageService);
  private configService = inject(ConfigService);

  products = this.productsService.products;
  categories = this.productsService.categories;
  isLoading = this.productsService.isLoading;
  t = this.langService.t;
  currencyCode = this.configService.currency;

  // Filter states
  searchTerm = signal('');
  selectedCategoryId = signal<string>('all');
  availabilityFilter = signal<'all' | 'available' | 'unavailable'>('all');

  // Detail Modal state
  selectedProduct = signal<Product | null>(null);

  // Computed filtered list
  filteredProducts = computed(() => {
    const list = this.products() ?? [];
    const search = this.searchTerm().toLowerCase().trim();
    const catId = this.selectedCategoryId();
    const avail = this.availabilityFilter();

    return list.filter(product => {
      // 1. Text Search Filter (null-safe: the API may omit fields)
      const name = product.name ?? '';
      const description = product.description ?? '';
      const matchesSearch = !search ||
        name.toLowerCase().includes(search) ||
        description.toLowerCase().includes(search);

      // 2. Category Filter
      const matchesCategory = catId === 'all' || product.categoryId === catId;

      // 3. Availability Filter
      const matchesAvailability = avail === 'all' || 
        (avail === 'available' && product.isAvailable) || 
        (avail === 'unavailable' && !product.isAvailable);

      return matchesSearch && matchesCategory && matchesAvailability;
    });
  });

  ngOnInit() {
    this.productsService.getProducts().subscribe();
    this.productsService.getCategories().subscribe();
  }

  selectCategory(categoryId: string) {
    this.selectedCategoryId.set(categoryId);
  }

  setAvailabilityFilter(filter: 'all' | 'available' | 'unavailable') {
    this.availabilityFilter.set(filter);
  }

  openProductDetail(product: Product) {
    this.selectedProduct.set(product);
  }

  closeProductDetail() {
    this.selectedProduct.set(null);
  }

  getFallbackImage(product: Product): string {
    return 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=500&auto=format&fit=crop&q=60';
  }
}
