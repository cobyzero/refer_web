import { Routes } from '@angular/router';
import { MainLayout } from './core/layout/main-layout/main-layout';
import { DashboardPageComponent } from './features/dashboard/dashboard-page/dashboard-page';
import { LoginPageComponent } from './features/auth/login-page/login-page';
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
      { path: 'users', component: DashboardPageComponent }, // Placeholder
      { path: 'points', component: DashboardPageComponent }, // Placeholder
      { path: 'settings', component: DashboardPageComponent }, // Placeholder
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ]
  },
  { path: '**', redirectTo: '' }
];
