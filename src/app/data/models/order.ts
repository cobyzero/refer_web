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
}
