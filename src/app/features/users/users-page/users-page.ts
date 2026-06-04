import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UsersService, User } from '../../../data/services/users';

@Component({
  selector: 'app-users-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users-page.html',
  styleUrl: './users-page.css',
})
export class UsersPageComponent implements OnInit {
  private usersService = inject(UsersService);

  users = this.usersService.users;
  isLoading = this.usersService.isLoading;

  // Search filter
  searchTerm = signal('');

  // Modals & detail view states
  selectedUser = signal<User | null>(null);
  isEditing = signal(false);
  isAdding = signal(false);

  // Toast notification
  toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);

  // Form Fields
  formName = signal('');
  formEmail = signal('');
  formPassword = signal('');
  formRole = signal<'USER' | 'ADMIN'>('USER');
  formPhotoUrl = signal('');

  filteredUsers = computed(() => {
    const list = this.users();
    const query = this.searchTerm().toLowerCase().trim();
    if (!query) return list;
    return list.filter(u => 
      u.name.toLowerCase().includes(query) || 
      u.email.toLowerCase().includes(query) ||
      u.id.toLowerCase().includes(query)
    );
  });

  ngOnInit() {
    this.usersService.getUsers().subscribe();
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }

  isAdmin(user: any): boolean {
    return user.roles?.some((r: any) => r.name === 'ADMIN');
  }

  openDetail(user: User) {
    this.selectedUser.set(user);
    this.isEditing.set(false);
    this.isAdding.set(false);
  }

  closeDetail() {
    this.selectedUser.set(null);
    this.isEditing.set(false);
  }

  openAddModal() {
    this.formName.set('');
    this.formEmail.set('');
    this.formPassword.set('');
    this.formRole.set('USER');
    this.formPhotoUrl.set('');
    this.isAdding.set(true);
    this.isEditing.set(false);
    this.selectedUser.set(null);
  }

  closeAddModal() {
    this.isAdding.set(false);
  }

  startEdit(user: User) {
    this.selectedUser.set(user);
    this.formName.set(user.name);
    this.formEmail.set(user.email);
    this.formPassword.set(''); // Empty by default
    this.formRole.set(this.isAdmin(user) ? 'ADMIN' : 'USER');
    this.formPhotoUrl.set(user.photoUrl || '');
    this.isEditing.set(true);
    this.isAdding.set(false);
  }

  saveNewUser() {
    if (!this.formName().trim() || !this.formEmail().trim()) {
      this.showToast('El nombre y el email son requeridos', 'error');
      return;
    }

    const payload = {
      name: this.formName().trim(),
      email: this.formEmail().trim(),
      password: this.formPassword() ? this.formPassword() : undefined,
      photoUrl: this.formPhotoUrl().trim() || null,
      roleNames: [this.formRole()]
    };

    this.usersService.createUser(payload).subscribe({
      next: () => {
        this.isAdding.set(false);
        this.showToast('Usuario creado correctamente', 'success');
      },
      error: (err) => {
        console.error(err);
        this.showToast(err?.error?.message || 'Error al crear el usuario', 'error');
      }
    });
  }

  saveEdit() {
    const user = this.selectedUser();
    if (!user) return;

    if (!this.formName().trim() || !this.formEmail().trim()) {
      this.showToast('El nombre y el email son requeridos', 'error');
      return;
    }

    const payload = {
      name: this.formName().trim(),
      email: this.formEmail().trim(),
      password: this.formPassword() ? this.formPassword() : undefined,
      photoUrl: this.formPhotoUrl().trim() || null,
      roleNames: [this.formRole()]
    };

    this.usersService.updateUser(user.id, payload).subscribe({
      next: (updatedUser) => {
        this.selectedUser.set(updatedUser);
        this.isEditing.set(false);
        this.showToast('Usuario actualizado correctamente', 'success');
      },
      error: (err) => {
        console.error(err);
        this.showToast(err?.error?.message || 'Error al actualizar el usuario', 'error');
      }
    });
  }

  deleteUser(id: string) {
    if (confirm('¿Estás seguro de que deseas eliminar este usuario?')) {
      this.usersService.deleteUser(id).subscribe({
        next: () => {
          if (this.selectedUser()?.id === id) {
            this.selectedUser.set(null);
          }
          this.showToast('Usuario eliminado correctamente', 'success');
        },
        error: (err) => {
          console.error(err);
          this.showToast(err?.error?.message || 'Error al eliminar el usuario', 'error');
        }
      });
    }
  }

  private showToast(message: string, type: 'success' | 'error') {
    this.toast.set({ message, type });
    setTimeout(() => this.toast.set(null), 3500);
  }
}
