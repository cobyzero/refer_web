import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs';
import { AuthService } from '../../../data/services/auth';
import { LanguageService } from '../../../core/services/language';
import { SidebarService } from '../../../core/services/sidebar';

interface MenuEntry {
  label: string;
  route: string;
  icon: string;
  children?: MenuEntry[];
}

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
  private router = inject(Router);
  sidebar = inject(SidebarService);

  user = this.authService.user;
  t = this.langService.t;

  /** Expanded/collapsed product group (independent from the mobile rail). */
  productsOpen = signal(false);

  toggleProducts() {
    this.productsOpen.update(v => !v);
  }

  menuItems = computed<MenuEntry[]>(() => [
    { label: this.t().MENU_DASHBOARD, route: '/dashboard', icon: 'grid_view' },
    { label: this.t().MENU_ORDERS, route: '/orders', icon: 'receipt_long' },
    {
      label: this.t().MENU_PRODUCTS,
      route: '/products',
      icon: 'inventory_2',
      children: [
        { label: this.t().MENU_ALL_PRODUCTS, route: '/products', icon: 'grid_view' },
        { label: this.t().MENU_CATEGORIES, route: '/products/categories/new', icon: 'label' },
        { label: this.t().MENU_SIZES, route: '/products/sizes', icon: 'straighten' },
        { label: this.t().MENU_EXTRAS, route: '/products/extras', icon: 'add_circle_outline' },
        { label: this.t().MENU_VARIANTS, route: '/products/variants', icon: 'tune' },
      ],
    },
    { label: this.t().MENU_USERS, route: '/users', icon: 'group' },
    { label: this.t().MENU_POINTS, route: '/points', icon: 'loyalty' },
    { label: this.t().MENU_FEATURED, route: '/products/collections', icon: 'auto_awesome' },
    { label: this.t().MENU_BRANCHES, route: '/branches', icon: 'storefront' },
    { label: this.t().MENU_SETTINGS, route: '/settings', icon: 'settings' },
  ]);

  /** Real role from the session instead of a hardcoded label. */
  roleLabel = computed(() => {
    const roles = this.user()?.roles ?? [];
    const es = this.langService.currentLanguage() === 'es';
    if (roles.includes('ADMIN')) return es ? 'Administración' : 'Administrator';
    if (roles.length) {
      const raw = roles[0].toLowerCase();
      return raw.charAt(0).toUpperCase() + raw.slice(1);
    }
    return es ? 'Personal' : 'Staff';
  });

  initials = computed(() => {
    const name = this.user()?.name?.trim();
    if (!name) return 'AD';
    const parts = name.split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const second = parts[1]?.[0] ?? parts[0]?.[1] ?? '';
    return (first + second).toUpperCase();
  });

  constructor() {
    // On mobile the expanded rail pushes content aside — collapse it
    // after navigating so the new page gets its space back.
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe((event) => {
        if (window.matchMedia('(max-width: 1023px)').matches) {
          this.sidebar.setExpanded(false);
        }
        // Keep the product group open while browsing its children.
        if (event.urlAfterRedirects.startsWith('/products')) {
          this.productsOpen.set(true);
        }
      });
  }

  /** Collapse the expanded mobile rail without stealing focus. */
  @HostListener('document:keydown.escape')
  onEscape() {
    this.sidebar.setExpanded(false);
  }

  logout() {
    this.authService.logout();
  }
}
