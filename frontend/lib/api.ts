import axios from "axios";

export const backendUrl =
  process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") ?? "";

export type Product = {
  id: string;
  slug: string;
  name: string;
  brand: string;
  model: string;
  description: string;
  category: string;
  panel_type: string;
  power_w: number;
  efficiency: number;
  cell_count: number;
  width_mm: number;
  height_mm: number;
  depth_mm: number;
  weight_kg: number;
  warranty_product_years: number;
  warranty_power_years: number;
  price_cents: number;
  currency: string;
  stock: number;
  active: boolean;
};

export type OrderRegion = "continent" | "madeira" | "azores";
export type OrderStatus = "pending" | "paid" | "cancelled" | "failed";

export type Customer = {
  full_name: string;
  email: string;
  phone: string;
  address_line: string;
  city: string;
  postal_code: string;
  region: OrderRegion;
};

export type OrderItem = {
  product_id: string;
  slug: string;
  name: string;
  brand: string;
  unit_price_net_cents: number;
  quantity: number;
  line_net_cents: number;
};

export type Order = {
  order_number: string;
  status: OrderStatus;
  items: OrderItem[];
  customer: Customer;
  subtotal_net_cents: number;
  vat_rate: number;
  vat_cents: number;
  shipping_cents: number;
  total_cents: number;
  currency: string;
  created_at: string;
  paid_at: string | null;
};

export type CreateOrderPayload = {
  items: { product_id: string; quantity: number }[];
  customer: Customer;
  success_url: string;
  cancel_url: string;
};

export type CreateOrderResponse = {
  order_number: string;
  checkout_url: string;
};

export type ProductQuery = {
  category?: string;
  search?: string;
  in_stock?: boolean;
  sort?: string;
};

export async function fetchProducts(query: ProductQuery = {}): Promise<Product[]> {
  const response = await axios.get<Product[]>(`${backendUrl}/api/v1/products/`, {
    params: query
  });
  return response.data;
}

export async function fetchOrder(orderNumber: string): Promise<Order> {
  const response = await axios.get<Order>(
    `${backendUrl}/api/v1/orders/${encodeURIComponent(orderNumber)}`
  );
  return response.data;
}

export async function createOrder(
  payload: CreateOrderPayload,
  idToken?: string | null
): Promise<CreateOrderResponse> {
  const response = await axios.post<CreateOrderResponse>(
    `${backendUrl}/api/v1/orders/`,
    payload,
    idToken ? { headers: { Authorization: `Bearer ${idToken}` } } : undefined
  );
  return response.data;
}

export async function fetchMyOrders(idToken: string): Promise<Order[]> {
  const response = await axios.get<Order[]>(`${backendUrl}/api/v1/orders/mine`, {
    headers: { Authorization: `Bearer ${idToken}` }
  });
  return response.data;
}

export const formatPrice = (cents: number, currency = "eur") =>
  new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: currency.toUpperCase()
  }).format(cents / 100);

export type CategoryNode = {
  id: string;
  slug: string;
  name: string;
  parent_id: string | null;
  path: string[];
  level: number;
  leaf: boolean;
  order: number;
  has_children: boolean;
  attribute_schema_key: string | null;
  children: CategoryNode[];
};

export async function fetchCategoryTree(): Promise<CategoryNode[]> {
  const res = await axios.get<CategoryNode[]>(`${backendUrl}/api/v1/categories/`);
  return res.data;
}

export type CategorySuggestion = {
  category_id: string;
  name: string;
  path: string[];
  path_labels: string[];
  score: number;
};

/** NLP/keyword category suggestions from a free-text title (Etapa 1). */
export async function fetchCategorySuggestions(
  title: string
): Promise<CategorySuggestion[]> {
  const trimmed = title.trim();
  if (trimmed.length < 2) return [];
  const res = await axios.get<CategorySuggestion[]>(
    `${backendUrl}/api/v1/categories/suggest`,
    { params: { title: trimmed } }
  );
  return res.data;
}

export type AttributeFieldType = "text" | "number" | "select";

export type AttributeField = {
  key: string;
  label: string;
  type: AttributeFieldType;
  required: boolean;
  options?: string[] | null;
  unit?: string | null;
  placeholder?: string | null;
};

export type AttributeSchema = {
  schema_key: string;
  fields: AttributeField[];
  version: number;
};

/**
 * Dynamic technical-sheet schema for a leaf category (Etapa 2).
 * Returns null for non-leaf categories (409) or unknown ids (404).
 */
export async function fetchCategoryAttributes(
  categoryId: string
): Promise<AttributeSchema | null> {
  if (!categoryId) return null;
  try {
    const res = await axios.get<AttributeSchema>(
      `${backendUrl}/api/v1/categories/${encodeURIComponent(categoryId)}/attributes`
    );
    return res.data;
  } catch {
    return null;
  }
}
