import { Routes } from '@angular/router';
import { MainLayout } from './core/layout/main-layout/main-layout';
import { DashboardPageComponent } from './features/dashboard/dashboard-page/dashboard-page';
import { OrdersPageComponent } from './features/orders/orders-page/orders-page';
import { UsersPageComponent } from './features/users/users-page/users-page';
import { ProductsPageComponent } from './features/products/products-page/products-page';
import { ProductCreatePageComponent } from './features/products/product-create-page/product-create-page';
import { CategoryCreatePageComponent } from './features/products/category-create-page/category-create-page';
import { CollectionsPageComponent } from './features/collections/collections-page/collections-page';
import { SizesPageComponent } from './features/products/sizes-page/sizes-page';
import { ExtrasPageComponent } from './features/products/extras-page/extras-page';
import { VariantsPageComponent } from './features/products/variants-page/variants-page';
import { BranchesPageComponent } from './features/branches/branches-page/branches-page';
import { SettingsPageComponent } from './features/settings/settings-page/settings-page';
import { LoginPageComponent } from './features/auth/login-page/login-page';
import { PointsPageComponent } from './features/points/points-page/points-page';
import { RewardCreatePageComponent } from './features/points/reward-create-page/reward-create-page';
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
      { path: 'products/collections', component: CollectionsPageComponent },
      { path: 'products/sizes', component: SizesPageComponent },
      { path: 'products/extras', component: ExtrasPageComponent },
      { path: 'products/variants', component: VariantsPageComponent },
      { path: 'branches', component: BranchesPageComponent },
      { path: 'products/categories/new', component: CategoryCreatePageComponent },
      { path: 'products/new', component: ProductCreatePageComponent },
      { path: 'products/:id/edit', component: ProductCreatePageComponent },
      { path: 'products', component: ProductsPageComponent },
      { path: 'users', component: UsersPageComponent },
      { path: 'points', component: PointsPageComponent },
      { path: 'points/rewards/new', component: RewardCreatePageComponent },
      { path: 'points/rewards/:id/edit', component: RewardCreatePageComponent },
      { path: 'settings', component: SettingsPageComponent },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ]
  },
  { path: '**', redirectTo: '' }
];
