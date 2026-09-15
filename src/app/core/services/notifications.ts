import { Injectable, signal, computed, effect } from '@angular/core';

export type NotificationType = 'new' | 'priority' | 'overdue';

export interface AppNotification {
  id: string;
  type: NotificationType;
  orderId: string;
  orderNumber: string;
  customerName: string;
  createdAt: number;
  read: boolean;
}

const STORAGE_KEY = 'notifications';
const MAX_STORED = 50;

/**
 * Centro de notificaciones del top bar (campanita).
 *
 * Es un store puro: no conoce OrdersService (evita DI circular).
 * El Navbar lo alimenta observando la señal de pedidos y llamando
 * a pushNewOrder / pushPriority / pushOverdue.
 *
 * - Dedupe: una notificación por par (tipo, pedido) — un pedido
 *   avisa una sola vez de "prioridad" y una sola vez de "vencido".
 * - Persiste en localStorage para sobrevivir recargas.
 */
@Injectable({
  providedIn: 'root'
})
export class NotificationsService {
  private _items = signal<AppNotification[]>(this.load());

  /** Todas, ordenadas de más reciente a más antigua. */
  notifications = computed(() => [...this._items()].sort((a, b) => b.createdAt - a.createdAt));

  unreadCount = computed(() => this._items().filter(n => !n.read).length);

  constructor() {
    // Persiste cada cambio (capado a las más recientes).
    effect(() => {
      const items = this.notifications();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_STORED)));
      } catch {
        /* almacenamiento lleno o bloqueado: no rompe la app */
      }
    });
  }

  pushNewOrder(order: { id: string; orderNumber: string; customerName: string }): AppNotification | null {
    return this.push('new', order);
  }

  pushPriority(order: { id: string; orderNumber: string; customerName: string }): AppNotification | null {
    return this.push('priority', order);
  }

  pushOverdue(order: { id: string; orderNumber: string; customerName: string }): AppNotification | null {
    return this.push('overdue', order);
  }

  markAsRead(id: string) {
    this._items.update(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
  }

  markAllAsRead() {
    this._items.update(prev => (prev.every(n => n.read) ? prev : prev.map(n => ({ ...n, read: true }))));
  }

  clearAll() {
    this._items.set([]);
  }

  private push(
    type: NotificationType,
    order: { id: string; orderNumber: string; customerName: string }
  ): AppNotification | null {
    const id = `${type}:${order.id}`;
    const prev = this._items();
    if (prev.some(n => n.id === id)) return null; // ya avisado

    const notif: AppNotification = {
      id,
      type,
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      createdAt: Date.now(),
      read: false,
    };
    this._items.set([notif, ...prev].slice(0, MAX_STORED));
    return notif;
  }

  private load(): AppNotification[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as AppNotification[];
      return Array.isArray(parsed) ? parsed.filter(n => n?.id && n?.orderId) : [];
    } catch {
      return [];
    }
  }
}
