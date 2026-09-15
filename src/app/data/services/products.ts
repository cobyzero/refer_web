import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_URL } from '../../core/constants/api';
import { tap, map } from 'rxjs';

export interface ProductCategory {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
}

export interface ProductSize {
  id: string;
  name: string;
}

/** Flat cross-product child (variant or extra) with its owning product. */
export interface CatalogChildItem {
  id: string;
  name: string;
  price: number;
  productId: string;
  productName: string;
}

export interface SizeOption {
  id: string;
  size: {
    id: string;
    name: string;
  };
  priceAdjustment: number;
}

export interface ProductTypeOption {
  id: string;
  name: string;
  priceAdjustment: number;
}

export interface ProductEnhancementOption {
  id: string;
  name: string;
  price: number;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  /** Resolved display name ('' when the product has no category). */
  categoryName: string;
  category?: ProductCategory;
  price: number;
  imageUrl: string;
  isAvailable: boolean;
  starsReward: number;
  rating: number;
  numReviews: number;
  createdAt: string;
  sizeOptions?: SizeOption[];
  options?: ProductTypeOption[];
  enhancements?: ProductEnhancementOption[];
}

@Injectable({
  providedIn: 'root'
})
export class ProductsService {
  private http = inject(HttpClient);
  
  products = signal<Product[]>([]);
  categories = signal<ProductCategory[]>([]);
  sizes = signal<ProductSize[]>([]);
  isLoading = signal(false);
  isLoadingCategories = signal(false);

  getProducts() {
    this.isLoading.set(true);
    return this.http.get<any[] | null>(`${API_URL}/products`).pipe(
      // The API answers MappedProductResponse (never the Product shape).
      map(apiProducts => (apiProducts ?? []).map(p => this.mapApiProduct(p))),
      tap(products => {
        this.products.set(products);
        this.isLoading.set(false);
      })
    );
  }

  getProduct(id: string) {
    return this.http.get<Product>(`${API_URL}/products/${id}`);
  }

  getCategories() {
    this.isLoadingCategories.set(true);
    return this.http.get<ProductCategory[] | null>(`${API_URL}/products/categories`).pipe(
      tap(categories => {
        this.categories.set(categories ?? []);
        this.isLoadingCategories.set(false);
        // Categories may arrive after products — backfill the resolution.
        this.backfillCategories();
      })
    );
  }

  createCategory(name: string, imageUrl = '', description = '') {
    const body: { name: string; imageUrl?: string; description?: string } = { name };
    if (imageUrl.trim()) body.imageUrl = imageUrl.trim();
    if (description.trim()) body.description = description.trim();
    return this.http.post<ProductCategory>(`${API_URL}/products/categories`, body).pipe(
      tap(newCategory => {
        this.categories.update(prev =>
          prev.some(c => c.id === newCategory.id) ? prev : [...prev, newCategory]
        );
      })
    );
  }

  updateCategory(id: string, patch: { name?: string; imageUrl?: string; description?: string }) {
    return this.http.patch<ProductCategory>(`${API_URL}/products/categories/${id}`, patch).pipe(
      tap(updated => {
        this.categories.update(prev => prev.map(c => (c.id === id ? updated : c)));
        // Keep product badges in sync when their category is renamed.
        if (patch.name !== undefined || patch.description !== undefined) {
          this.products.update(prev =>
            prev.map(p =>
              p.categoryId === id
                ? {
                    ...p,
                    categoryName: patch.name !== undefined ? patch.name : p.categoryName,
                    category: { ...(p.category ?? { id, name: p.categoryName }), name: patch.name ?? p.categoryName },
                  }
                : p
            )
          );
        }
      })
    );
  }

  deleteCategory(id: string) {
    return this.http.delete(`${API_URL}/products/categories/${id}`, { observe: 'response' }).pipe(
      tap(() => {
        this.categories.update(prev => prev.filter(c => c.id !== id));
        // The API unassigns products — mirror it locally.
        this.products.update(prev =>
          prev.map(p =>
            p.categoryId === id
              ? { ...p, categoryId: '', categoryName: '', category: undefined }
              : p
          )
        );
      })
    );
  }

  getSizes() {
    return this.http.get<ProductSize[] | null>(`${API_URL}/products/sizes`).pipe(
      tap(sizes => this.sizes.set(sizes ?? []))
    );
  }

  createSize(name: string) {
    return this.http.post<ProductSize>(`${API_URL}/products/sizes`, { name }).pipe(
      tap(newSize => {
        this.sizes.update(prev =>
          prev.some(s => s.id === newSize.id) ? prev : [...prev, newSize].sort((a, b) => a.name.localeCompare(b.name))
        );
      })
    );
  }

  assignSize(productId: string, sizeId: string, price: number) {
    return this.http.post<any>(`${API_URL}/products/${productId}/sizes`, { sizeId, price }).pipe(
      map(apiProduct => this.mapApiProduct(apiProduct)),
      tap(updatedProduct => {
        this.products.update(prev =>
          prev.map(p => p.id === productId ? updatedProduct : p)
        );
      })
    );
  }

  unassignSize(productId: string, sizeId: string) {
    return this.http.delete<any>(`${API_URL}/products/${productId}/sizes/${sizeId}`).pipe(
      map(apiProduct => this.mapApiProduct(apiProduct)),
      tap(updatedProduct => {
        this.products.update(prev =>
          prev.map(p => p.id === productId ? updatedProduct : p)
        );
      })
    );
  }

  deleteSize(id: string) {
    return this.http.delete(`${API_URL}/products/sizes/${id}`, { observe: 'response' }).pipe(
      tap(() => {
        this.sizes.update(prev => prev.filter(s => s.id !== id));
      })
    );
  }

  getAllTypes() {
    return this.http.get<CatalogChildItem[] | null>(`${API_URL}/products/types`);
  }

  getAllEnhancements() {
    return this.http.get<CatalogChildItem[] | null>(`${API_URL}/products/enhancements`);
  }

  addType(productId: string, data: { name: string; price: number }) {
    return this.http.post<any>(`${API_URL}/products/${productId}/types`, data).pipe(
      map(apiProduct => this.mapApiProduct(apiProduct)),
      tap(updatedProduct => {
        this.products.update(prev =>
          prev.map(p => p.id === productId ? updatedProduct : p)
        );
      })
    );
  }

  deleteType(productId: string, typeId: string) {
    return this.http.delete<any>(`${API_URL}/products/${productId}/types/${typeId}`).pipe(
      map(apiProduct => this.mapApiProduct(apiProduct)),
      tap(updatedProduct => {
        this.products.update(prev =>
          prev.map(p => p.id === productId ? updatedProduct : p)
        );
      })
    );
  }

  updateProduct(id: string, productData: Partial<Product>) {
    return this.http.patch<any>(`${API_URL}/products/${id}`, productData).pipe(
      map(apiProduct => this.mapApiProduct(apiProduct)),
      tap(updatedProduct => {
        this.products.update(prev =>
          prev.map(p => p.id === id ? updatedProduct : p)
        );
      })
    );
  }

  createProduct(productData: Partial<Product>) {
    return this.http.post<any>(`${API_URL}/products`, productData).pipe(
      map(apiProduct => this.mapApiProduct(apiProduct)),
      tap(newProduct => {
        this.products.update(prev => [newProduct, ...prev]);
      })
    );
  }

  uploadImage(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ imageUrl: string }>(`${API_URL}/products/upload`, formData);
  }

  addEnhancement(productId: string, data: { name: string; price: number }) {
    return this.http.post<any>(`${API_URL}/products/${productId}/enhancements`, data).pipe(
      map(apiProduct => this.mapApiProduct(apiProduct)),
      tap(updatedProduct => {
        this.products.update(prev =>
          prev.map(p => p.id === productId ? updatedProduct : p)
        );
      })
    );
  }

  deleteEnhancement(productId: string, enhancementId: string) {
    return this.http.delete<any>(`${API_URL}/products/${productId}/enhancements/${enhancementId}`).pipe(
      map(apiProduct => this.mapApiProduct(apiProduct)),
      tap(updatedProduct => {
        this.products.update(prev =>
          prev.map(p => p.id === productId ? updatedProduct : p)
        );
      })
    );
  }

  /**
   * Maps MappedProductResponse (or partial shapes) to the frontend Product.
   * The API answers `category` as a plain name string (or "All" when
   * uncategorized), sizes as `availableSizes` and types as `types`.
   * Public for reuse (e.g. collections).
   */
  mapApiProduct(api: any): Product {
    const rawName = typeof api?.category === 'string' ? api.category : api?.category?.name ?? '';
    // Backend default for uncategorized products — not a real category.
    const categoryName = rawName === 'All' ? '' : rawName;
    const match = this.categories().find(
      c => c.name.trim().toLowerCase() === categoryName.trim().toLowerCase()
    );

    return {
      id: api?.id ?? '',
      name: api?.name ?? '',
      description: api?.description ?? '',
      price: Number(api?.price) || 0,
      categoryId: api?.categoryId ?? match?.id ?? '',
      categoryName,
      category: match,
      imageUrl: api?.imageUrl ?? '',
      isAvailable: api?.isAvailable ?? true,
      starsReward: Number(api?.starsReward) || 0,
      rating: Number(api?.rating) || 0,
      numReviews: Number(api?.numReviews) || 0,
      createdAt: api?.createdAt ?? '',
      sizeOptions: (api?.availableSizes ?? api?.sizeOptions ?? []).map((o: any) => ({
        id: o?.id ?? '',
        size: { id: o?.size?.id ?? o?.id ?? '', name: o?.size?.name ?? o?.name ?? '' },
        priceAdjustment: Number(o?.priceAdjustment ?? o?.price ?? 0) || 0,
      })),
      options: (api?.types ?? api?.options ?? []).map((o: any) => ({
        id: o?.id ?? '',
        name: o?.name ?? '',
        priceAdjustment: Number(o?.priceAdjustment ?? o?.price ?? 0) || 0,
      })),
      enhancements: (api?.enhancements ?? []).map((e: any) => ({
        id: e?.id ?? '',
        name: e?.name ?? '',
        price: Number(e?.price) || 0,
      })),
    };
  }

  /** Re-resolve categoryId once categories arrive after the products. */
  private backfillCategories() {
    const cats = this.categories();
    if (!cats.length) return;
    this.products.update(prev =>
      prev.map(p => {
        if (p.categoryId || !p.categoryName) return p;
        const match = cats.find(
          c => c.name.trim().toLowerCase() === p.categoryName.trim().toLowerCase()
        );
        return match ? { ...p, categoryId: match.id, category: match } : p;
      })
    );
  }
}
