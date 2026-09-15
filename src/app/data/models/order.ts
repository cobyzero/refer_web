export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  notes?: string;
  image?: string;
  size?: string;
  type?: string;
  enhancements?: string[];
}

export interface OrderTimeline {
  status: string;
  timestamp: string;
  details?: string;
  icon?: string;
  completed: boolean;
  /** Translation keys — the template resolves them with t() so the detail reacts to lang switches. */
  statusKey?: string;
  timeKey?: string;
  detailsKey?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerAvatar?: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  createdAt: string;
  timeline: OrderTimeline[];
  /** Raw timestamps (ms) for priority sorting. createdAtMs always set; pickupTimeMs null when unknown/legacy. */
  createdAtMs: number;
  pickupTimeMs: number | null;
  /** True when ordered "para servir ahora" (app sends pickupTime ≈ createdAt) vs. scheduled for a chosen hour. */
  isAsap: boolean;
}
