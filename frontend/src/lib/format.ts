import type { OrderStatus } from "../types";

/** Parse an API timestamp; ones without a zone are UTC (e.g. from SQLite). */
export function toDate(iso: string): Date {
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
}

export function naira(value: number | string): string {
  const amount = Number(value);
  return `₦${amount.toLocaleString("en-NG", {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function quantity(value: number | string): string {
  const amount = Number(value);
  return Number.isInteger(amount) ? String(amount) : String(Number(amount.toFixed(2)));
}

export function shortDate(iso: string): string {
  return toDate(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

export function dateTime(iso: string): string {
  return toDate(iso).toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function timeAgo(iso: string, now: number = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - toDate(iso).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return shortDate(iso);
}

export function orderRef(id: string): string {
  return `#FB-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Waiting for the farmer",
  accepted: "Accepted",
  ready_for_fulfillment: "Ready for delivery",
  completed: "Completed",
  rejected: "Declined by the farmer",
  cancelled: "Cancelled",
};

export const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "accepted",
  "ready_for_fulfillment",
];

// Earthy colour blocks stand in for products without a photo yet.
const TONES = ["#b5523b", "#b99367", "#c99a2e", "#c4632a", "#4f7a3a", "#7d6a4f", "#8f3f2f", "#5d7d4c"];

export function productTone(seed: string): string {
  let hash = 0;
  for (const char of seed.toLowerCase()) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TONES[hash % TONES.length];
}

export const CATEGORIES = ["Vegetables", "Tubers", "Fruits", "Grains", "Spices", "Livestock & eggs"];

export const UNITS = ["kg", "tuber", "bunch", "basket", "bag", "crate", "piece", "litre"];
