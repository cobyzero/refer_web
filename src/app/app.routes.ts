import { Routes } from '@angular/router';
import { MainLayout } from './core/layout/main-layout/main-layout';
import { DashboardPageComponent } from './features/dashboard/dashboard-page/dashboard-page';
import { OrdersPageComponent } from './features/orders/orders-page/orders-page';
import { UsersPageComponent } from './features/users/users-page/users-page';
import { ProductsPageComponent } from './features/products/products-page/products-page';
import { LoginPageComponent } from './features/auth/login-page/login-page';
import { PointsPageComponent } from './features/points/points-page/points-page';
import { authGuard, guestGuard } from './core/guards/auth';

export const routes: Routes = [
  {
    path: 'auth',
    canActivate: [guestGuard],
    children: [
      { path: 'login', component: LoginPageComponent },
      { path: '', redirectTo: 'login', pathMatch: 'full' }
    ]
  },
  {
    path: '',
    component: MainLayout,
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', component: DashboardPageComponent },
      { path: 'orders', component: OrdersPageComponent },
      { path: 'products', component: ProductsPageComponent },
      { path: 'users', component: UsersPageComponent },
      { path: 'points', component: PointsPageComponent },
      { path: 'settings', component: DashboardPageComponent }, // Placeholder
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ]
  },
  { path: '**', redirectTo: '' }
];
