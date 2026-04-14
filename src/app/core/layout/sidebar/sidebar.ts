import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../data/services/auth';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class SidebarComponent {
  private authService = inject(AuthService);
  user = this.authService.user;

  menuItems = [
    { label: 'Dashboard', route: '/dashboard', icon: 'grid_view' },
    { label: 'Usuarios', route: '/users', icon: 'group' },
    { label: 'Puntos', route: '/points', icon: 'monetization_on' },
    { label: 'Configuración', route: '/settings', icon: 'settings' },
  ];

  logout() {
    this.authService.logout();
  }
}
