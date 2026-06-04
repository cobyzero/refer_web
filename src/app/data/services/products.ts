import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_URL } from '../../core/constants/api';
import { tap, map } from 'rxjs';

export interface ProductCategory {
  id: string;
  name: string;
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
  category: ProductCategory;
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
  isLoading = signal(false);
  isLoadingCategories = signal(false);

  getProducts() {
    this.isLoading.set(true);
    return this.http.get<Product[]>(`${API_URL}/products`).pipe(
      tap(products => {
        this.products.set(products);
        this.isLoading.set(false);
      })
    );
  }

  getCategories() {
    this.isLoadingCategories.set(true);
    return this.http.get<ProductCategory[]>(`${API_URL}/products/categories`).pipe(
      tap(categories => {
        this.categories.set(categories);
        this.isLoadingCategories.set(false);
      })
    );
  }

  updateProduct(id: string, productData: Partial<Product>) {
    return this.http.patch<Product>(`${API_URL}/products/${id}`, productData).pipe(
      tap(updatedProduct => {
        this.products.update(prev =>
          prev.map(p => p.id === id ? { ...p, ...updatedProduct } : p)
        );
      })
    );
  }

  createProduct(productData: Partial<Product>) {
    return this.http.post<Product>(`${API_URL}/products`, productData).pipe(
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
    return this.http.post<Product>(`${API_URL}/products/${productId}/enhancements`, data).pipe(
      tap(updatedProduct => {
        this.products.update(prev =>
          prev.map(p => p.id === productId ? { ...p, ...updatedProduct } : p)
        );
      })
    );
  }

  deleteEnhancement(productId: string, enhancementId: string) {
    return this.http.delete<Product>(`${API_URL}/products/${productId}/enhancements/${enhancementId}`).pipe(
      tap(updatedProduct => {
        this.products.update(prev =>
          prev.map(p => p.id === productId ? { ...p, ...updatedProduct } : p)
        );
      })
    );
  }
}
