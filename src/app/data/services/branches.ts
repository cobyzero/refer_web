import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { finalize, map, tap } from 'rxjs';
import { API_URL } from '../../core/constants/api';

export interface Branch {
  id: string;
  name: string;
  address: string;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isActive: boolean;
}

export interface BranchInput {
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  isActive?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class BranchesService {
  private http = inject(HttpClient);
  private apiUrl = `${API_URL}/locations`;

  branches = signal<Branch[]>([]);
  isLoading = signal(false);
  error = signal<string | null>(null);

  load() {
    this.isLoading.set(true);
    this.error.set(null);
    return this.http.get<Branch[] | null>(`${this.apiUrl}/admin/all`).pipe(
      map(list => (list ?? []).map(b => this.normalize(b))),
      tap({
        next: (branches) => this.branches.set(branches),
        error: () => this.error.set('No pudimos cargar las sedes.'),
      }),
      finalize(() => this.isLoading.set(false))
    );
  }

  retry() {
    this.load().subscribe({ error: () => undefined });
  }

  create(input: Required<Pick<BranchInput, 'name' | 'address'>> & BranchInput) {
    return this.http.post<Branch>(this.apiUrl, input).pipe(
      map(branch => this.normalize(branch)),
      tap(branch => {
        this.branches.update(prev => [branch, ...prev]);
      })
    );
  }

  update(id: string, patch: BranchInput) {
    return this.http.patch<Branch>(`${this.apiUrl}/${id}`, patch).pipe(
      map(branch => this.normalize(branch)),
      tap(updated => {
        this.branches.update(prev => prev.map(b => (b.id === id ? updated : b)));
      })
    );
  }

  setActive(id: string, isActive: boolean) {
    return this.update(id, { isActive });
  }

  remove(id: string) {
    return this.http.delete(`${this.apiUrl}/${id}`, { observe: 'response' }).pipe(
      tap(() => {
        this.branches.update(prev => prev.filter(b => b.id !== id));
      })
    );
  }

  private normalize(api: any): Branch {
    return {
      id: api?.id ?? '',
      name: api?.name ?? '',
      address: api?.address ?? '',
      city: api?.city ?? null,
      state: api?.state ?? null,
      zipCode: api?.zipCode ?? null,
      latitude: api?.latitude ?? null,
      longitude: api?.longitude ?? null,
      isActive: api?.isActive ?? true,
    };
  }
}
