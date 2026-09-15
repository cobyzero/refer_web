import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_URL } from '../../core/constants/api';
import { map, tap, finalize } from 'rxjs';

export interface Reward {
  id: string;
  title: string;
  description: string;
  starsRequired: number;
  imageUrl?: string;
  icon?: string;
  isActive: boolean;
  productId?: string;
}

export interface StarTransaction {
  id: string;
  userId: string;
  type: 'earn' | 'redeem';
  title: string;
  stars: number;
  date: string;
  user?: {
    id: string;
    name: string;
    email: string;
    photoUrl?: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class PointsService {
  private http = inject(HttpClient);
  private apiUrl = `${API_URL}/stars`;

  rewards = signal<Reward[]>([]);
  transactions = signal<StarTransaction[]>([]);
  isLoading = signal(false);
  /** Last load error (null when ok). The page shows its empty states on error. */
  error = signal<string | null>(null);

  getRewards() {
    this.isLoading.set(true);
    return this.http.get<Reward[] | null>(`${this.apiUrl}/rewards`).pipe(
      map(rewards => rewards ?? []),
      tap({
        next: (rewards) => {
          this.rewards.set(rewards);
          this.error.set(null);
        },
        error: (err) => this.error.set(err?.error?.message || 'No se pudieron cargar las recompensas'),
      }),
      finalize(() => this.isLoading.set(false))
    );
  }

  getTransactions() {
    // NOTE: backend route is /stars/transactions (admin-only) — no /admin segment.
    this.isLoading.set(true);
    return this.http.get<StarTransaction[] | null>(`${this.apiUrl}/transactions`).pipe(
      map(txs => txs ?? []),
      tap({
        next: (txs) => {
          this.transactions.set(txs);
          this.error.set(null);
        },
        error: (err) => this.error.set(err?.error?.message || 'No se pudieron cargar las transacciones'),
      }),
      finalize(() => this.isLoading.set(false))
    );
  }

  /** Emits false when the backend is unreachable so callers can show a hint. */
  createReward(rewardData: Partial<Reward>) {
    // NOTE: backend route is POST /stars/rewards (admin-only).
    return this.http.post<Reward>(`${this.apiUrl}/rewards`, rewardData).pipe(
      tap(newReward => {
        this.rewards.update(prev => [...prev, newReward]);
      })
    );
  }

  updateReward(id: string, rewardData: Partial<Reward>) {
    return this.http.patch<Reward>(`${this.apiUrl}/rewards/${id}`, rewardData).pipe(
      tap(updatedReward => {
        this.rewards.update(prev => prev.map(r => r.id === id ? updatedReward : r));
      })
    );
  }

  deleteReward(id: string) {
    return this.http.delete(`${this.apiUrl}/rewards/${id}`).pipe(
      tap(() => {
        this.rewards.update(prev => prev.filter(r => r.id !== id));
      })
    );
  }
}
