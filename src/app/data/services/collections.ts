import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, finalize, map, of, tap } from 'rxjs';
import { API_URL } from '../../core/constants/api';
import { Product, ProductsService } from './products';

export interface FeaturedCollection {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  products: Product[];
}

@Injectable({
  providedIn: 'root'
})
export class CollectionsService {
  private http = inject(HttpClient);
  private productsService = inject(ProductsService);
  private apiUrl = `${API_URL}/collections`;

  collections = signal<FeaturedCollection[]>([]);
  isLoading = signal(false);
  error = signal<string | null>(null);

  load() {
    this.isLoading.set(true);
    this.error.set(null);
    return this.http.get<any[] | null>(this.apiUrl).pipe(
      map(apiCollections => (apiCollections ?? []).map(c => this.mapApiCollection(c))),
      tap({
        next: (collections) => this.collections.set(collections),
        error: () => this.error.set('No pudimos cargar los destacados.'),
      }),
      finalize(() => this.isLoading.set(false))
    );
  }

  retry() {
    this.load().subscribe({ error: () => undefined });
  }

  create(name: string, description: string) {
    return this.http.post<any>(this.apiUrl, { name, description }).pipe(
      map(apiCollection => this.mapApiCollection(apiCollection)),
      tap(collection => {
        this.collections.update(prev => [collection, ...prev]);
      })
    );
  }

  rename(id: string, name: string, description: string) {
    return this.http.patch<any>(`${this.apiUrl}/${id}`, { name, description }).pipe(
      map(apiCollection => this.mapApiCollection(apiCollection)),
      tap(updated => {
        this.collections.update(prev => prev.map(c => (c.id === id ? updated : c)));
      })
    );
  }

  setActive(id: string, isActive: boolean) {
    return this.http.patch<any>(`${this.apiUrl}/${id}`, { isActive }).pipe(
      map(apiCollection => this.mapApiCollection(apiCollection)),
      tap(updated => {
        this.collections.update(prev => prev.map(c => (c.id === id ? updated : c)));
      })
    );
  }

  remove(id: string) {
    return this.http.delete(`${this.apiUrl}/${id}`, { observe: 'response' }).pipe(
      tap(() => {
        this.collections.update(prev => prev.filter(c => c.id !== id));
      }),
      catchError(() => of(null))
    );
  }

  addProduct(collectionId: string, productId: string) {
    return this.http.post<any>(`${this.apiUrl}/${collectionId}/items`, { productId }).pipe(
      map(apiCollection => this.mapApiCollection(apiCollection)),
      tap(updated => {
        this.collections.update(prev => prev.map(c => (c.id === collectionId ? updated : c)));
      })
    );
  }

  removeProduct(collectionId: string, productId: string) {
    return this.http.delete<any>(`${this.apiUrl}/${collectionId}/items/${productId}`).pipe(
      map(apiCollection => this.mapApiCollection(apiCollection)),
      tap(updated => {
        this.collections.update(prev => prev.map(c => (c.id === collectionId ? updated : c)));
      })
    );
  }

  private mapApiCollection(api: any): FeaturedCollection {
    return {
      id: api?.id ?? '',
      name: api?.name ?? '',
      description: api?.description ?? '',
      isActive: api?.isActive ?? true,
      createdAt: api?.createdAt ?? '',
      products: (api?.products ?? []).map((p: any) => this.productsService.mapApiProduct(p)),
    };
  }
}
