import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SocketService } from '../../core/services/socket';
import { Order, OrderStatus } from '../models/order';
import { tap, map } from 'rxjs';
import { API_URL } from '../../core/constants/api';

@Injectable({
  providedIn: 'root'
})
export class OrdersService {
  private http = inject(HttpClient);
  private socketService = inject(SocketService);
  private apiUrl = `${API_URL}/orders`;
  orders = signal<Order[]>([]);

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
    return this.http.get<any[]>(this.apiUrl).pipe(
      map(apiOrders => apiOrders.map(o => this.mapApiOrderToModel(o))),
      tap(orders => this.orders.set(orders))
    );
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

    return {
      id: apiOrder.id,
      orderNumber: apiOrder.orderNumber || apiOrder.id,
      customerName: apiOrder.user?.name || 'Unknown',
      customerEmail: apiOrder.user?.email || '',
      customerAvatar: apiOrder.user?.photoUrl || `https://i.pravatar.cc/150?u=${apiOrder.userId}`,
      status: statusMap[apiOrder.status] || apiOrder.status,
      totalAmount: Number(apiOrder.total) || 0,
      createdAt: new Date(apiOrder.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      items: (apiOrder.items || []).map((item: any) => ({
        id: item.id,
        name: item.name || item.product?.name || 'Unknown Item',
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

  private generateTimeline(apiOrder: any) {
    const status = apiOrder.status;
    const isOrdered = ['ORDERED', 'PREPARING', 'READY', 'COMPLETED'].includes(status);
    const isPreparing = ['PREPARING', 'READY', 'COMPLETED'].includes(status);
    const isReady = ['READY', 'COMPLETED'].includes(status);

    return [
      { status: 'Order Received', timestamp: 'Just now', details: 'Web Portal', completed: isOrdered, icon: 'check_circle' },
      { status: 'Preparing Brew', timestamp: isPreparing ? 'Updated' : 'Pending', details: 'Barista Assigned', completed: isPreparing, icon: 'local_cafe' },
      { status: 'Ready for Pickup', timestamp: isReady ? 'Done' : 'Waiting', details: 'Counter', completed: isReady, icon: 'notifications_active' }
    ];
  }
}
