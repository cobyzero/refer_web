import { Component, HostListener, OnDestroy, OnInit, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { LanguageService, Language } from '../../services/language';
import { SidebarService } from '../../services/sidebar';
import { SocketService } from '../../services/socket';
import { NotificationsService, AppNotification, NotificationType } from '../../services/notifications';
import { diffOrderChanges, OrderTone } from '../../services/order-urgency';
import { OrdersService } from '../../../data/services/orders';
import { Order } from '../../../data/models/order';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class NavbarComponent implements OnInit, OnDestroy {
  langService = inject(LanguageService);
  sidebar = inject(SidebarService);
  private ordersService = inject(OrdersService);
  private socketService = inject(SocketService);
  private router = inject(Router);
  notifs = inject(NotificationsService);

  t = this.langService.t;
  currentLang = this.langService.currentLanguage;
  notifications = this.notifs.notifications;
  unreadCount = this.notifs.unreadCount;

  pageTitle = 'Dashboard';
  currentDate = new Date();

  showLangMenu = false;
  showNotifMenu = false;

  /** Ticks every 30s: re-evaluates tones + refreshes "hace X min". */
  nowMs = signal(Date.now());
  private clockTimer: ReturnType<typeof setInterval> | null = null;
  private baselineTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Baseline flood-proof: the snapshot starts EMPTY only until real data
   * arrives. The first non-empty list seeds silently (those orders already
   * existed — none is "new"). The fallback timer covers boot with zero
   * orders / failed load so future orders still notify.
   */
  private baselineDone = false;
  private snapshot = new Map<string, OrderTone>();
  private notifPermissionRequested = false;

  constructor() {
    // Instant reaction to socket-driven order changes (newOrder / status).
    effect(() => {
      const orders = this.ordersService.orders();
      this.evaluate(orders);
    });
  }

  ngOnInit() {
    // The bell lives in the persistent layout, so it owns the feed:
    // orders load + socket connect even outside /orders.
    // Seeding in `next` wins over the pending effect run (sync emission),
    // so the initial HTTP list never notifies as "new".
    this.ordersService.getOrders().subscribe({
      next: (orders) => this.seedBaseline(orders),
      error: () => undefined,
    });
    this.ordersService.connect();
    this.clearClockTimer();
    this.clockTimer = setInterval(() => {
      this.nowMs.set(Date.now());
      // Time-driven transitions (an order quietly entering "soon"/"late").
      this.evaluate(this.ordersService.orders());
    }, 30_000);
    this.clearBaselineTimer();
    this.baselineTimer = setTimeout(() => {
      this.baselineDone = true;
    }, 10_000);
  }

  ngOnDestroy() {
    this.clearClockTimer();
    this.clearBaselineTimer();
    // Layout is destroyed on logout — release the socket there.
    this.socketService.disconnect();
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.showNotifMenu = false;
    this.showLangMenu = false;
  }

  setLang(lang: Language) {
    this.langService.setLanguage(lang);
    this.showLangMenu = false;
  }

  // ── Notification center ──────────────────────────────────────

  toggleNotif() {
    this.showNotifMenu = !this.showNotifMenu;
    this.showLangMenu = false;
  }

  closeNotif() {
    this.showNotifMenu = false;
  }

  openNotification(n: AppNotification) {
    this.notifs.markAsRead(n.id);
    this.closeNotif();
    this.router.navigate(['/orders']);
  }

  markAllRead() {
    this.notifs.markAllAsRead();
  }

  clearAll() {
    this.notifs.clearAll();
  }

  badgeText(): string {
    const n = this.unreadCount();
    return n > 9 ? '9+' : String(n);
  }

  notifIcon(type: NotificationType): string {
    if (type === 'priority') return 'bolt';
    if (type === 'overdue') return 'warning';
    return 'receipt_long';
  }

  notifTitle(n: AppNotification): string {
    const dict = this.t();
    if (n.type === 'priority') return dict.NOTIF_PRIORITY;
    if (n.type === 'overdue') return dict.NOTIF_OVERDUE;
    return dict.NOTIF_NEW;
  }

  notifBody(n: AppNotification): string {
    const dict = this.t();
    if (n.type === 'priority') {
      const order = this.findOrder(n.orderId);
      // Sin hora conocida no se deja el "· recoge" colgando: se muestra el cliente.
      if (order?.pickupTimeMs == null) {
        return dict.NOTIF_NEW_BODY.replace('{order}', n.orderNumber).replace('{name}', n.customerName);
      }
      return dict.NOTIF_PRIORITY_BODY.replace('{order}', n.orderNumber).replace(
        '{time}',
        this.formatTime(order.pickupTimeMs)
      );
    }
    if (n.type === 'overdue') {
      return dict.NOTIF_OVERDUE_BODY.replace('{order}', n.orderNumber).replace('{name}', n.customerName);
    }
    return dict.NOTIF_NEW_BODY.replace('{order}', n.orderNumber).replace('{name}', n.customerName);
  }

  timeAgo(ts: number): string {
    const mins = Math.max(0, Math.floor((this.nowMs() - ts) / 60000));
    if (mins < 1) return this.t().NOTIF_JUST_NOW;
    return this.t().NOTIF_MIN_AGO.replace('{m}', String(mins));
  }

  // ── Detection ────────────────────────────────────────────────

  /**
   * Diffs the order list against the last known snapshot:
   * unknown id → "nuevo pedido"; tone entering 'soon' → "prioridad";
   * tone entering 'late' → "pasó su hora". Idempotent (dedupe in service).
   */
  private evaluate(orders: Order[]) {
    if (!this.baselineDone) {
      // Still booting: an empty list means "no data yet", not "zero orders".
      // Wait for the HTTP seed / fallback timer instead of crying "new".
      if (!orders.length) return;
      this.seedBaseline(orders);
      return;
    }

    const changes = diffOrderChanges(this.snapshot, orders, Date.now());
    this.snapshot = changes.snapshot;

    for (const o of changes.added) {
      const pushed = this.notifs.pushNewOrder(o);
      if (pushed) this.alert(pushed);
    }
    for (const o of changes.toPriority) {
      const pushed = this.notifs.pushPriority(o);
      if (pushed) this.alert(pushed);
    }
    for (const o of changes.toOverdue) {
      const pushed = this.notifs.pushOverdue(o);
      if (pushed) this.alert(pushed);
    }
  }

  private seedBaseline(orders: Order[]) {
    this.snapshot = diffOrderChanges(new Map(), orders, Date.now()).snapshot;
    this.baselineDone = true;
  }

  private findOrder(id: string): Order | undefined {
    return this.ordersService.orders().find(o => o.id === id);
  }

  private formatTime(ms: number): string {
    const locale = this.langService.currentLanguage() === 'es' ? 'es-ES' : 'en-US';
    return new Date(ms).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  }

  /** Sound + native browser notification for a fresh alert. Best-effort. */
  private alert(n: AppNotification) {
    this.beep(n.type);
    try {
      if (!('Notification' in window)) return;
      if (Notification.permission === 'granted') {
        new Notification(this.notifTitle(n), { body: this.notifBody(n) });
      } else if (Notification.permission === 'default' && !this.notifPermissionRequested) {
        this.notifPermissionRequested = true;
        Notification.requestPermission().catch(() => undefined);
      }
    } catch {
      /* notificaciones del navegador no disponibles: se ignora */
    }
  }

  /** Short oscillator beep — overdue sounds lower/urgent. No assets needed. */
  private beep(type: NotificationType) {
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = type === 'overdue' ? 440 : type === 'priority' ? 660 : 880;
      gain.gain.value = 0.08;
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
      osc.stop(ctx.currentTime + 0.4);
      osc.onended = () => void ctx.close().catch(() => undefined);
    } catch {
      /* audio bloqueado por el navegador: se ignora */
    }
  }

  private clearClockTimer() {
    if (this.clockTimer) clearInterval(this.clockTimer);
    this.clockTimer = null;
  }

  private clearBaselineTimer() {
    if (this.baselineTimer) clearTimeout(this.baselineTimer);
    this.baselineTimer = null;
  }
}
