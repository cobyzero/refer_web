import { Component, HostListener, computed, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrdersService } from '../../../data/services/orders';
import { SocketService } from '../../../core/services/socket';
import { LanguageService } from '../../../core/services/language';
import { ConfigService } from '../../../core/services/config';
import { Order, OrderItem, OrderStatus } from '../../../data/models/order';

const STATUS_META: { value: OrderStatus; icon: string }[] = [
  { value: 'pending', icon: 'pending' },
  { value: 'preparing', icon: 'local_cafe' },
  { value: 'ready', icon: 'notifications_active' },
  { value: 'completed', icon: 'check_circle' },
  { value: 'cancelled', icon: 'cancel' },
];

/** Minutes before pickupTime when a scheduled order counts as "por llegar". */
const PICKUP_SOON_MINUTES = 15;

/** Minutes after ordering when a "para ahora" order counts as late. */
const ASAP_LATE_MINUTES = 10;

/** Operative urgency of an order for the bar list. */
export type PickupTone = 'now' | 'future' | 'soon' | 'late' | 'done';

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
  private langService = inject(LanguageService);
  private configService = inject(ConfigService);

  t = this.langService.t;
  currencyCode = this.configService.currency;

  selectedStatus = signal<OrderStatus | 'all'>('all');
  selectedId = signal<string | null>(null);
  isUpdating = signal(false);
  cancelArmed = signal(false);
  toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private cancelTimer: ReturnType<typeof setTimeout> | null = null;
  private clockTimer: ReturnType<typeof setInterval> | null = null;
  private lastTrigger: HTMLElement | null = null;

  /** Ticks every 30s so scheduled orders climb in priority as their hour nears. */
  nowMs = signal(Date.now());

  /** Order ids whose avatar image failed to load (show initials instead). */
  avatarFailed = signal<Record<string, boolean>>({});

  orders = this.ordersService.orders;
  isLoading = this.ordersService.isLoading;
  listError = this.ordersService.error;
  liveStatus = this.socketService.status;

  isLive = computed(() => this.liveStatus() === 'connected');

  statusLabels = computed<Record<OrderStatus, string>>(() => ({
    pending: this.t().ORDERS_S_PENDING,
    preparing: this.t().ORDERS_S_PREPARING,
    ready: this.t().ORDERS_S_READY,
    completed: this.t().ORDERS_S_COMPLETED,
    cancelled: this.t().ORDERS_S_CANCELLED,
  }));

  statusFilters = computed(() => [
    { label: this.t().ORDERS_FILTER_ALL, value: 'all' as const },
    ...STATUS_META.map((s) => ({ label: this.statusLabels()[s.value], value: s.value as OrderStatus | 'all' })),
  ]);

  statusActions = computed(() =>
    STATUS_META.map((s) => ({ ...s, label: this.statusLabels()[s.value] }))
  );

  filteredOrders = computed(() => {
    const status = this.selectedStatus();
    const now = this.nowMs(); // reactive tick: re-sorts as pickup hours near
    const allOrders = this.orders();
    const list = status === 'all' ? [...allOrders] : allOrders.filter((o) => o.status === status);
    // Priority: 0 = atrasados (ASAP +10min o programados pasados, lo más vencido primero),
    // 1 = para servir ahora (FIFO by ordered time),
    // 2 = programados por llegar (by pickup hour),
    // 3 = programados futuros (by pickup hour),
    // 4 = terminados/cancelados (newest first).
    const groupOf = (o: Order): number => {
      if (o.status === 'completed' || o.status === 'cancelled') return 4;
      if (this.isLate(o, now)) return 0;
      if (o.isAsap || o.pickupTimeMs == null) return 1;
      return o.pickupTimeMs - now <= PICKUP_SOON_MINUTES * 60 * 1000 ? 2 : 3;
    };
    // When it turned late: ASAP → ordered + grace; scheduled → its pickup hour.
    const lateSince = (o: Order): number =>
      o.pickupTimeMs ?? o.createdAtMs + ASAP_LATE_MINUTES * 60 * 1000;
    return list.sort((a, b) => {
      const ga = groupOf(a);
      const gb = groupOf(b);
      if (ga !== gb) return ga - gb;
      if (ga === 4) return b.createdAtMs - a.createdAtMs;
      if (ga === 0) return lateSince(a) - lateSince(b);
      if (ga === 1) return a.createdAtMs - b.createdAtMs;
      const pa = a.pickupTimeMs ?? Number.MAX_SAFE_INTEGER;
      const pb = b.pickupTimeMs ?? Number.MAX_SAFE_INTEGER;
      if (pa !== pb) return pa - pb;
      return a.createdAtMs - b.createdAtMs;
    });
  });

  /** Live selection: follows socket updates instead of going stale. */
  selectedOrder = computed(() => this.orders().find((o) => o.id === this.selectedId()) ?? null);

  countsText = computed(() => {
    const shown = this.filteredOrders().length;
    const total = this.orders().length;
    const es = this.langService.currentLanguage() === 'es';
    const noun = (n: number) => (es ? (n === 1 ? 'pedido' : 'pedidos') : n === 1 ? 'order' : 'orders');
    if (this.selectedStatus() === 'all') return `${total} ${noun(total)}`;
    return `${shown} ${this.t().ORDERS_OF} ${total}`;
  });

  ngOnInit() {
    this.ordersService.getOrders().subscribe({ error: () => undefined });
    this.ordersService.connect();
    this.clearClockTimer();
    this.clockTimer = setInterval(() => this.nowMs.set(Date.now()), 30_000);
  }

  ngOnDestroy() {
    // NOTE: no disconnect here on purpose — the navbar (persistent layout)
    // owns the socket so the notification bell keeps working outside /orders.
    // Socket is released on logout when the layout itself is destroyed.
    this.clearTimers();
  }

  /** Escape closes the detail panel wherever focus is. */
  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.selectedId()) this.closeDetail();
  }

  retry() {
    this.ordersService.retry();
  }

  selectFilter(value: OrderStatus | 'all') {
    this.selectedStatus.set(value);
  }

  selectOrder(order: Order, event: Event) {
    this.lastTrigger = event.currentTarget as HTMLElement | null;
    this.cancelArmed.set(false);
    this.selectedId.set(order.id);
    requestAnimationFrame(() => {
      document.getElementById('order-detail-title')?.focus({ preventScroll: true });
    });
  }

  closeDetail() {
    this.selectedId.set(null);
    this.cancelArmed.set(false);
    this.clearCancelTimer();
    this.lastTrigger?.focus();
  }

  updateStatus(status: OrderStatus) {
    const order = this.selectedOrder();
    if (!order || this.isUpdating() || order.status === status) return;

    // Destructive action: arm on first tap, execute on second.
    if (status === 'cancelled' && !this.cancelArmed()) {
      this.cancelArmed.set(true);
      this.clearCancelTimer();
      this.cancelTimer = setTimeout(() => this.cancelArmed.set(false), 4000);
      return;
    }

    this.isUpdating.set(true);
    this.ordersService.updateOrderStatus(order.id, status).subscribe({
      next: () => {
        this.isUpdating.set(false);
        this.cancelArmed.set(false);
        this.showToast(this.t().ORDERS_TOAST_OK, 'success');
      },
      error: (err) => {
        this.isUpdating.set(false);
        this.showToast(
          err?.error?.message || err?.message || this.t().ORDERS_UPDATE_ERROR,
          'error'
        );
      },
    });
  }

  dismissToast() {
    this.toast.set(null);
    this.clearToastTimer();
  }

  /** "Ana María" → "AM". Used when the customer has no photo. */
  initialsOf(name: string | null | undefined): string {
    const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    const first = parts[0][0] ?? '';
    const second = parts[1]?.[0] ?? parts[0][1] ?? '';
    return (first + second).toUpperCase();
  }

  /** An avatar image shows only with a real URL that hasn't failed. */
  showAvatar(order: Order): boolean {
    return !!order.customerAvatar && !this.avatarFailed()[order.id];
  }

  onAvatarError(orderId: string) {
    this.avatarFailed.update(prev => ({ ...prev, [orderId]: true }));
  }

  private showToast(message: string, type: 'success' | 'error') {
    this.clearToastTimer();
    this.toast.set({ message, type });
    // Errors persist until dismissed; only successes auto-dismiss.
    if (type === 'success') {
      this.toastTimer = setTimeout(() => this.toast.set(null), 3500);
    }
  }

  /** "2× Latte, 1× Capuchino +2 más" — null-safe for orders with no items. */
  itemsPreview(order: Order): string {
    const items: OrderItem[] = order.items ?? [];
    if (!items.length) return this.t().ORDERS_NO_ITEMS;
    const head = items
      .slice(0, 2)
      .map((i) => `${i.quantity}× ${i.name}`)
      .join(', ');
    const rest = items.length - 2;
    return rest > 0 ? `${head} +${rest}` : head;
  }

  rowLabel(order: Order): string {
    const dict = this.t();
    return `${dict.ORDERS_ROW_ORDER} ${order.orderNumber} ${dict.ORDERS_OF} ${order.customerName}, ${
      this.statusLabels()[order.status] ?? order.status
    }, ${dict.ORDERS_ROW_TOTAL} ${order.totalAmount.toFixed(2)} ${this.currencyCode()}, ${this.pickupRowText(order)}`;
  }

  // ── Pickup priority (ASAP vs. scheduled) ──────────────────────────

  /** Operative urgency: ASAP → now; scheduled → future/soon/late; terminal → done. */
  pickupTone(order: Order): PickupTone {
    if (order.status === 'completed' || order.status === 'cancelled') return 'done';
    if (this.isLate(order, this.nowMs())) return 'late';
    if (order.isAsap || order.pickupTimeMs == null) return 'now';
    const diff = order.pickupTimeMs - this.nowMs();
    if (diff <= PICKUP_SOON_MINUTES * 60 * 1000) return 'soon';
    return 'future';
  }

  /**
   * Late = scheduled past its pickup hour, or "para ahora" still active
   * more than ASAP_LATE_MINUTES after ordering.
   */
  isLate(order: Order, now: number): boolean {
    if (order.status === 'completed' || order.status === 'cancelled') return false;
    if (order.pickupTimeMs != null && !order.isAsap) return order.pickupTimeMs - now < 0;
    return now - order.createdAtMs > ASAP_LATE_MINUTES * 60 * 1000;
  }

  /** Minutes waiting since the order was placed (ASAP late cue). */
  waitingMinutes(order: Order): number {
    return Math.max(0, Math.floor((this.nowMs() - order.createdAtMs) / 60000));
  }

  pickupIcon(order: Order): string {
    const tone = this.pickupTone(order);
    if (tone === 'now') return 'bolt';
    if (tone === 'late') return 'warning';
    return 'schedule';
  }

  /** Minutes until pickup (negative when the hour already passed). */
  pickupMinutesLeft(order: Order): number | null {
    if (order.pickupTimeMs == null) return null;
    return Math.round((order.pickupTimeMs - this.nowMs()) / 60000);
  }

  /** HH:MM of the pickup hour (with day when it's not today). Falls back to ordered time. */
  formatPickupTime(order: Order): string {
    if (order.pickupTimeMs == null) return order.createdAt;
    const locale = this.langService.currentLanguage() === 'es' ? 'es-ES' : 'en-US';
    const d = new Date(order.pickupTimeMs);
    const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === new Date(this.nowMs()).toDateString()) return time;
    const day = d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
    return `${day} ${time}`;
  }

  /** One-line operative cue for the list row. */
  pickupRowText(order: Order): string {
    const dict = this.t();
    const tone = this.pickupTone(order);
    if (tone === 'now') return `${dict.ORDERS_ASAP} · ${order.createdAt}`;
    const at = this.formatPickupTime(order);
    if (tone === 'late') {
      if (order.isAsap || order.pickupTimeMs == null) {
        const ago = dict.ORDERS_AGO.replace('{m}', String(this.waitingMinutes(order)));
        return `${dict.ORDERS_RUNNING_LATE} · ${ago}`;
      }
      return `${dict.ORDERS_PAST_DUE} · ${at}`;
    }
    const mins = this.pickupMinutesLeft(order);
    if ((tone === 'soon' || tone === 'future') && mins != null && mins >= 0 && mins < 120) {
      return `${at} · ${dict.ORDERS_DUE_IN.replace('{m}', String(mins))}`;
    }
    return dict.ORDERS_PICKUP_AT.replace('{time}', at);
  }

  /** Detail header: "Ahora" / "Por llegar" / "Pasó su hora" / "Va tarde" / "Recogida 14:30". */
  pickupTitle(order: Order): string {
    const dict = this.t();
    const tone = this.pickupTone(order);
    if (tone === 'now') return dict.ORDERS_ASAP;
    if (tone === 'soon') return dict.ORDERS_DUE_SOON;
    if (tone === 'late') {
      return order.isAsap || order.pickupTimeMs == null
        ? dict.ORDERS_RUNNING_LATE
        : dict.ORDERS_PAST_DUE;
    }
    return dict.ORDERS_PICKUP_AT.replace('{time}', this.formatPickupTime(order));
  }

  /** Detail sub-line with the complementary time info. */
  pickupSub(order: Order): string {
    const dict = this.t();
    const tone = this.pickupTone(order);
    const at = this.formatPickupTime(order);
    if (tone === 'now' || tone === 'done') {
      return order.isAsap || order.pickupTimeMs == null
        ? dict.ORDERS_ORDERED_AT.replace('{time}', order.createdAt)
        : dict.ORDERS_PICKUP_AT.replace('{time}', at);
    }
    if (tone === 'late') {
      if (order.isAsap || order.pickupTimeMs == null) {
        const ago = dict.ORDERS_AGO.replace('{m}', String(this.waitingMinutes(order)));
        return `${dict.ORDERS_ORDERED_AT.replace('{time}', order.createdAt)} · ${ago}`;
      }
      return dict.ORDERS_PICKUP_AT.replace('{time}', at);
    }
    const mins = this.pickupMinutesLeft(order);
    if (mins == null || mins < 0 || mins >= 180) {
      return tone === 'soon' ? dict.ORDERS_PICKUP_AT.replace('{time}', at) : '';
    }
    const due = dict.ORDERS_DUE_IN.replace('{m}', String(mins));
    return tone === 'soon'
      ? `${dict.ORDERS_PICKUP_AT.replace('{time}', at)} · ${due}`
      : due;
  }

  /** Timeline steps carry translation keys so the detail follows lang switches. Falls back to the legacy string. */
  timelineStatus(step: Order['timeline'][number]): string {
    const dict = this.t() as Record<string, string>;
    return (step.statusKey && dict[step.statusKey]) || step.status;
  }

  timelineTime(step: Order['timeline'][number]): string {
    const dict = this.t() as Record<string, string>;
    return (step.timeKey && dict[step.timeKey]) || step.timestamp;
  }

  timelineDetails(step: Order['timeline'][number]): string {
    const dict = this.t() as Record<string, string>;
    return (step.detailsKey && dict[step.detailsKey]) || step.details || '';
  }

  private clearToastTimer() {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = null;
  }

  private clearCancelTimer() {
    if (this.cancelTimer) clearTimeout(this.cancelTimer);
    this.cancelTimer = null;
  }

  private clearClockTimer() {
    if (this.clockTimer) clearInterval(this.clockTimer);
    this.clockTimer = null;
  }

  private clearTimers() {
    this.clearToastTimer();
    this.clearCancelTimer();
    this.clearClockTimer();
  }
}
