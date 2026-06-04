import { Component, inject, computed } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../data/services/auth';
import { LanguageService } from '../../../core/services/language';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class SidebarComponent {
  private authService = inject(AuthService);
  private langService = inject(LanguageService);
  
  user = this.authService.user;
  t = this.langService.t;

  menuItems = computed(() => [
    { label: this.t().MENU_DASHBOARD, route: '/dashboard', icon: 'grid_view' },
    { label: this.t().MENU_ORDERS, route: '/orders', icon: 'local_cafe' },
    { label: this.t().MENU_PRODUCTS, route: '/products', icon: 'inventory_2' },
    { label: this.t().MENU_USERS, route: '/users', icon: 'group' },
    { label: this.t().MENU_POINTS, route: '/points', icon: 'loyalty' },
    { label: this.t().MENU_SETTINGS, route: '/settings', icon: 'settings' },
  ]);

  logout() {
    this.authService.logout();
  }
}
