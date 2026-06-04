import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_URL } from '../../core/constants/api';
import { tap } from 'rxjs';

export interface Role {
  id: string;
  name: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  photoUrl: string | null;
  roles: Role[];
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class UsersService {
  private http = inject(HttpClient);
  
  users = signal<User[]>([]);
  isLoading = signal(false);

  getUsers() {
    this.isLoading.set(true);
    return this.http.get<User[]>(`${API_URL}/users`).pipe(
      tap(users => {
        this.users.set(users);
        this.isLoading.set(false);
      })
    );
  }

  createUser(userData: Partial<User> & { roleNames: string[]; password?: string }) {
    return this.http.post<User>(`${API_URL}/users`, userData).pipe(
      tap(newUser => {
        this.users.update(prev => [...prev, newUser]);
      })
    );
  }

  updateUser(id: string, userData: Partial<User> & { roleNames: string[]; password?: string }) {
    return this.http.patch<User>(`${API_URL}/users/${id}`, userData).pipe(
      tap(updatedUser => {
        this.users.update(prev => prev.map(u => u.id === id ? updatedUser : u));
      })
    );
  }

  deleteUser(id: string) {
    return this.http.delete(`${API_URL}/users/${id}`).pipe(
      tap(() => {
        this.users.update(prev => prev.filter(u => u.id !== id));
      })
    );
  }
}
