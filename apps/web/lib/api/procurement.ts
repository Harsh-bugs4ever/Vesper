import { api } from "@/lib/api";

/** Exact fields returned by the current inventory and purchase-order schemas. */
export interface StockItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  quantity: string | number;
  minimum_quantity: string | number;
  reorder_quantity: string | number;
  unit_cost: string | number;
  expires_on: string | null;
  supplier: string | null;
  lead_time_days: number;
  is_low: boolean;
  days_to_expiry: number | null;
}

export interface InventorySummary {
  total_items: number;
  low_stock_items: number;
  expiring_items: number;
  stock_value: number;
  pending_suggestions: number;
}

export interface PurchaseOrder {
  id: string;
  item_id: string;
  quantity: string | number;
  unit_cost: string | number;
  total_cost: string | number;
  supplier: string | null;
  status: string;
  expected_on: string | null;
  approved_at: string | null;
  received_at: string | null;
  rationale: Record<string, unknown>;
  created_at: string;
}

export interface DepartmentOption {
  id: string;
  key: string;
  name: string;
}

export const procurement = {
  items: () => api.get<StockItem[]>("/inventory/items"),
  summary: () => api.get<InventorySummary>("/inventory/summary"),
  orders: () => api.get<PurchaseOrder[]>("/purchase-orders"),
  departments: () => api.get<DepartmentOption[]>("/property/departments"),
  approve: (id: string) => api.post<PurchaseOrder>(`/purchase-orders/${id}/approve`, {}),
  receive: (id: string) => api.post<PurchaseOrder>(`/purchase-orders/${id}/receive`),
};
