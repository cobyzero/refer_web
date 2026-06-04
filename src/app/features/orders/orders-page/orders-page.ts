import { Component, inject, computed, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrdersService } from '../../../data/services/orders';
import { SocketService } from '../../../core/services/socket';
import { Order, OrderStatus } from '../../../data/models/order';

@Component({
  selector: 'app-orders-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './orders-page.html',
  styleUrl: './orders-page.css'
})
export class OrdersPageComponent implements OnInit, OnDestroy {
  private ordersService = inject(OrdersService);
  private socketService = inject(SocketService);
  
  selectedStatus = signal<OrderStatus | 'all'>('all');
  selectedOrder = signal<Order | null>(null);
  isUpdating = signal(false);
  toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);
  
  orders = this.ordersService.orders;

  ngOnInit() {
    this.ordersService.getOrders().subscribe();
    this.ordersService.connect();
  }

  ngOnDestroy() {
    this.socketService.disconnect();
  }
  
  filteredOrders = computed(() => {
    const status = this.selectedStatus();
    const allOrders = this.orders();
    if (status === 'all') return allOrders;
    return allOrders.filter(o => o.status === status);
  });

  statusFilters: { label: string; value: OrderStatus | 'all' }[] = [
    { label: 'All Orders', value: 'all' },
    { label: 'Pending', value: 'pending' },
    { label: 'Preparing', value: 'preparing' },
    { label: 'Ready', value: 'ready' },
    { label: 'Completed', value: 'completed' },
    { label: 'Cancelled', value: 'cancelled' },
  ];

  statusActions: { label: string; value: OrderStatus; icon: string }[] = [
    { label: 'Pending',   value: 'pending',   icon: 'pending' },
    { label: 'Preparing', value: 'preparing', icon: 'local_cafe' },
    { label: 'Ready',     value: 'ready',     icon: 'notifications_active' },
    { label: 'Completed', value: 'completed', icon: 'check_circle' },
    { label: 'Cancelled', value: 'cancelled', icon: 'cancel' },
  ];

  selectOrder(order: Order) {
    this.selectedOrder.set(order);
  }

  closeDetail() {
    this.selectedOrder.set(null);
  }

  updateStatus(status: OrderStatus) {
    const order = this.selectedOrder();
    console.log('🔃 updateStatus called:', { orderId: order?.id, status, isUpdating: this.isUpdating() });

    if (!order) { console.warn('No order selected'); return; }
    if (this.isUpdating()) { console.warn('Already updating'); return; }
    if (order.status === status) { console.warn('Same status, skipping'); return; }

    this.isUpdating.set(true);
    console.log(`📡 Making PATCH request for order ${order.id} → ${status}`);

    this.ordersService.updateOrderStatus(order.id, status).subscribe({
      next: (updatedOrder) => {
        console.log('✅ Status updated successfully', updatedOrder);
        const fresh = this.orders().find(o => o.id === order.id);
        if (fresh) this.selectedOrder.set(fresh);
        this.isUpdating.set(false);
        this.showToast('Estado actualizado correctamente', 'success');
      },
      error: (err) => {
        console.error('❌ Failed to update order status:', err);
        this.isUpdating.set(false);
        this.showToast(`Error: ${err?.error?.message || err?.message || 'No se pudo actualizar'}`, 'error');
      }
    });
  }

  private showToast(message: string, type: 'success' | 'error') {
    this.toast.set({ message, type });
    setTimeout(() => this.toast.set(null), 3500);
  }

  getStatusClass(status: OrderStatus): string {
    return `status-badge ${status}`;
  }
}
