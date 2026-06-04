import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_URL } from '../../core/constants/api';
import { tap } from 'rxjs';

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

  getRewards() {
    this.isLoading.set(true);
    return this.http.get<Reward[]>(`${this.apiUrl}/rewards`).pipe(
      tap(rewards => {
        this.rewards.set(rewards);
        this.isLoading.set(false);
      })
    );
  }

  getTransactions() {
    this.isLoading.set(true);
    return this.http.get<StarTransaction[]>(`${this.apiUrl}/admin/transactions`).pipe(
      tap(txs => {
        this.transactions.set(txs);
        this.isLoading.set(false);
      })
    );
  }

  createReward(rewardData: Partial<Reward>) {
    return this.http.post<Reward>(`${this.apiUrl}/admin/rewards`, rewardData).pipe(
      tap(newReward => {
        this.rewards.update(prev => [...prev, newReward]);
      })
    );
  }

  updateReward(id: string, rewardData: Partial<Reward>) {
    return this.http.patch<Reward>(`${this.apiUrl}/admin/rewards/${id}`, rewardData).pipe(
      tap(updatedReward => {
        this.rewards.update(prev => prev.map(r => r.id === id ? updatedReward : r));
      })
    );
  }

  deleteReward(id: string) {
    return this.http.delete(`${this.apiUrl}/admin/rewards/${id}`).pipe(
      tap(() => {
        this.rewards.update(prev => prev.filter(r => r.id !== id));
      })
    );
  }
}
