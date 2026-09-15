import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SocketService } from '../../core/services/socket';
import { TRANSLATIONS } from '../../core/services/language';
import { Order, OrderStatus } from '../models/order';
import { tap, map, finalize } from 'rxjs';
import { API_URL } from '../../core/constants/api';

@Injectable({
  providedIn: 'root'
})
export class OrdersService {
  private http = inject(HttpClient);
  private socketService = inject(SocketService);
  private apiUrl = `${API_URL}/orders`;
  orders = signal<Order[]>([]);
  isLoading = signal(false);
  error = signal<string | null>(null);

  connect() {
    // Use the actual socket connected state, not a local flag.
    // This handles the case where the previous socket was killed (JWT expired).
    if (this.socketService.status() === 'connected' || this.socketService.status() === 'connecting') {
      console.log('OrdersService: socket already connected, skipping.');
      return;
    }

    console.log('OrdersService: connecting to /orders namespace...');
    this.socketService.connect('/orders');

    // Listen for new orders
    this.socketService.fromEvent<any>('newOrder').subscribe({
      next: (apiOrder) => {
        console.log('📦 Socket: New order received', apiOrder);
        const newOrder = this.mapApiOrderToModel(apiOrder);

        // Prevent duplicates in case HTTP and Socket overlap
        this.orders.update(prev => {
          if (prev.some(o => o.id === newOrder.id)) return prev;
          return [newOrder, ...prev];
        });
      },
      error: (err) => console.error('❌ Socket newOrder error:', err)
    });

    // Listen for status updates
    this.socketService.fromEvent<any>('orderStatusUpdated').subscribe({
      next: (apiOrder) => {
        console.log('🔄 Socket: Order status updated', apiOrder);
        const updatedOrder = this.mapApiOrderToModel(apiOrder);
        this.orders.update(prev =>
          prev.map(o => o.id === updatedOrder.id ? updatedOrder : o)
        );
      },
      error: (err) => console.error('❌ Socket orderStatusUpdated error:', err)
    });
  }

  getOrders() {
    this.isLoading.set(true);
    this.error.set(null);
    return this.http.get<any[] | null>(this.apiUrl).pipe(
      map(apiOrders => (apiOrders ?? []).map(o => this.mapApiOrderToModel(o))),
      tap({
        next: (orders) => this.orders.set(orders),
        error: (err) => {
          const lang = (localStorage.getItem('lang') === 'en' ? 'en' : 'es') as 'es' | 'en';
          const dict = TRANSLATIONS[lang];
          this.error.set(
            err?.error?.message || `${dict.ORDERS_ERROR} ${dict.ORDERS_LOAD_HINT}`
          );
        },
      }),
      finalize(() => this.isLoading.set(false))
    );
  }

  retry() {
    this.getOrders().subscribe({ error: () => undefined });
  }

  updateOrderStatus(orderId: string, newStatus: OrderStatus) {
    // Backend expects enum values in uppercase (ORDERED, PREPARING, etc.)
    const statusToApi: { [key in OrderStatus]: string } = {
      'pending': 'ORDERED',
      'preparing': 'PREPARING',
      'ready': 'READY',
      'completed': 'COMPLETED',
      'cancelled': 'CANCELLED'
    };
    const apiStatus = statusToApi[newStatus];
    console.log(`🔄 Updating order ${orderId} status to: ${apiStatus}`);

    return this.http.patch<any>(`${this.apiUrl}/${orderId}/status`, { status: apiStatus }).pipe(
      map(updatedApiOrder => this.mapApiOrderToModel(updatedApiOrder)),
      tap(updatedOrder => {
        this.orders.update(prev =>
          prev.map(o => o.id === orderId ? updatedOrder : o)
        );
      })
    );
  }

  private mapApiOrderToModel(apiOrder: any): Order {
    const statusMap: { [key: string]: OrderStatus } = {
      'ORDERED': 'pending',
      'PREPARING': 'preparing',
      'READY': 'ready',
      'COMPLETED': 'completed',
      'CANCELLED': 'cancelled'
    };
    const lang = (localStorage.getItem('lang') === 'en' ? 'en' : 'es') as 'es' | 'en';
    const dict = TRANSLATIONS[lang];
    const locale = lang === 'es' ? 'es-ES' : 'en-US';

    const createdMs = new Date(apiOrder.createdAt).getTime();
    const createdAtMs = Number.isFinite(createdMs) ? createdMs : Date.now();
    const pickupRaw = apiOrder.pickupTime != null ? new Date(apiOrder.pickupTime).getTime() : NaN;
    const pickupTimeMs = Number.isFinite(pickupRaw) ? pickupRaw : null;
    // The app sends pickupTime ≈ now for "lo antes posible". A gap larger than
    // this means the customer chose a specific pickup hour.
    const ASAP_WINDOW_MS = 10 * 60 * 1000;
    const isAsap =
      pickupTimeMs == null || Math.abs(pickupTimeMs - createdAtMs) <= ASAP_WINDOW_MS;

    return {
      id: apiOrder.id,
      orderNumber: apiOrder.orderNumber || apiOrder.id,
      customerName: apiOrder.user?.name || dict.ORDERS_UNKNOWN,
      customerEmail: apiOrder.user?.email || '',
      // No photo → undefined. The UI renders name initials instead
      // (never stock faces from external providers).
      customerAvatar: apiOrder.user?.photoUrl || undefined,
      status: statusMap[apiOrder.status] || apiOrder.status,
      totalAmount: Number(apiOrder.total) || 0,
      createdAt: new Date(createdAtMs).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
      createdAtMs,
      pickupTimeMs,
      isAsap,
      items: (apiOrder.items || []).map((item: any) => ({
        id: item.id,
        name: item.name || item.product?.name || dict.ORDERS_UNKNOWN_ITEM,
        quantity: item.quantity,
        price: Number(item.price),
        notes: item.notes,
        size: item.size,
        type: item.type,
        enhancements: item.enhancements
      })),
      timeline: this.generateTimeline(apiOrder)
    };
  }

  /**
   * Timeline carries translation keys (statusKey/timeKey/detailsKey) plus an
   * English fallback in the legacy string fields. The detail template resolves
   * the keys with t() so switching language re-renders without refetching.
   */
  private generateTimeline(apiOrder: any) {
    const status = apiOrder.status;
    const isOrdered = ['ORDERED', 'PREPARING', 'READY', 'COMPLETED'].includes(status);
    const isPreparing = ['PREPARING', 'READY', 'COMPLETED'].includes(status);
    const isReady = ['READY', 'COMPLETED'].includes(status);

    return [
      { status: 'Order Received', timestamp: 'Just now', details: 'Web Portal', completed: isOrdered, icon: 'check_circle', statusKey: 'ORDERS_TL_RECEIVED', timeKey: 'ORDERS_TL_JUST_NOW', detailsKey: 'ORDERS_TL_WEB' },
      { status: 'Preparing Brew', timestamp: isPreparing ? 'Updated' : 'Pending', details: 'Barista Assigned', completed: isPreparing, icon: 'local_cafe', statusKey: 'ORDERS_TL_PREPARING', timeKey: isPreparing ? 'ORDERS_TL_UPDATED' : 'ORDERS_TL_PENDING_STATE', detailsKey: 'ORDERS_TL_BARISTA' },
      { status: 'Ready for Pickup', timestamp: isReady ? 'Done' : 'Waiting', details: 'Counter', completed: isReady, icon: 'notifications_active', statusKey: 'ORDERS_TL_READY', timeKey: isReady ? 'ORDERS_TL_DONE' : 'ORDERS_TL_WAITING', detailsKey: 'ORDERS_TL_COUNTER' }
    ];
  }
}
