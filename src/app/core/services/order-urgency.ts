import { Order } from '../../data/models/order';

/** Minutos antes de la hora de recogida en que un pedido cuenta como "por llegar" (prioridad). */
export const PICKUP_SOON_MINUTES = 15;

/** Minutos después de ordenar en que un pedido "para ahora" cuenta como tarde. */
export const ASAP_LATE_MINUTES = 10;

export type OrderTone = 'now' | 'future' | 'soon' | 'late' | 'done';

/**
 * Lógica de urgencia operativa compartida entre la página de pedidos
 * (ordenamiento y estilos) y el centro de notificaciones del navbar.
 *
 * Late = programado pasada su hora, o "para ahora" aún activo más de
 * ASAP_LATE_MINUTES después de ordenar.
 */
export function isLateOrder(order: Pick<Order, 'status' | 'createdAtMs' | 'pickupTimeMs' | 'isAsap'>, now: number): boolean {
  if (order.status === 'completed' || order.status === 'cancelled') return false;
  if (order.pickupTimeMs != null && !order.isAsap) return order.pickupTimeMs - now < 0;
  return now - order.createdAtMs > ASAP_LATE_MINUTES * 60 * 1000;
}

/** Urgencia operativa: ASAP → now; programado → future/soon/late; terminal → done. */
export function pickupToneOf(order: Pick<Order, 'status' | 'createdAtMs' | 'pickupTimeMs' | 'isAsap'>, now: number): OrderTone {
  if (order.status === 'completed' || order.status === 'cancelled') return 'done';
  if (isLateOrder(order, now)) return 'late';
  if (order.isAsap || order.pickupTimeMs == null) return 'now';
  return order.pickupTimeMs - now <= PICKUP_SOON_MINUTES * 60 * 1000 ? 'soon' : 'future';
}

export interface OrderChanges {
  /** Pedidos que no estaban en el snapshot (potencial "nuevo pedido"). */
  added: Order[];
  /** Entraron en tono 'soon' (potencial "entró en prioridad"). */
  toPriority: Order[];
  /** Entraron en tono 'late' (potencial "pasó su hora"). */
  toOverdue: Order[];
  /** Nuevo snapshot a conservar para el siguiente diff. */
  snapshot: Map<string, OrderTone>;
}

/**
 * Diff puro pedido-lista vs. snapshot previo. El centro de notificaciones
 * lo usa para decidir qué avisar; al ser puro se prueba sin Angular.
 */
export function diffOrderChanges(
  prev: ReadonlyMap<string, OrderTone>,
  orders: Order[],
  now: number
): OrderChanges {
  const added: Order[] = [];
  const toPriority: Order[] = [];
  const toOverdue: Order[] = [];
  const snapshot = new Map<string, OrderTone>();

  for (const o of orders) {
    const tone = pickupToneOf(o, now);
    snapshot.set(o.id, tone);
    if (!prev.has(o.id)) {
      added.push(o);
      continue;
    }
    if (prev.get(o.id) !== tone) {
      if (tone === 'soon') toPriority.push(o);
      else if (tone === 'late') toOverdue.push(o);
    }
  }

  return { added, toPriority, toOverdue, snapshot };
}
