import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.css',
})
export class DashboardPageComponent {
  stats = [
    { label: 'Usuarios Totales', value: '1,284', change: '+12%', icon: 'group', color: 'primary' },
    { label: 'Puntos Otorgados', value: '45.2K', change: '+5.4%', icon: 'stars', color: 'secondary' },
    { label: 'Canjes Realizados', value: '842', change: '+18%', icon: 'shopping_bag', color: 'accent' },
    { label: 'Tasa de Referencia', value: '64%', change: '+2.1%', icon: 'trending_up', color: 'success' },
  ];

  recentActivity = [
    { user: 'Juan Perez', action: 'Ganó 50 puntos', time: 'hace 2 min', avatar: 'JP' },
    { user: 'Maria Garcia', action: 'Canjeó Cupón Café', time: 'hace 15 min', avatar: 'MG' },
    { user: 'Carlos Ruiz', action: 'Se unió a la app', time: 'hace 1 hora', avatar: 'CR' },
    { user: 'Ana Lopez', action: 'Invitó a 3 amigos', time: 'hace 3 horas', avatar: 'AL' },
  ];
}
