"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import type { Product } from "@/lib/api";

export type CartItem = {
  product: Product;
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotalNetCents: number;
  isHydrated: boolean;
  addItem: (product: Product, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
  quantityOf: (productId: string) => number;
};

const STORAGE_KEY = "reisolari_cart";

const CartContext = createContext<CartContextValue | null>(null);

const clampToStock = (quantity: number, stock: number) =>
  Math.max(1, Math.min(quantity, Math.max(1, stock)));

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from localStorage on mount (client only) to avoid SSR mismatch.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setItems(
            parsed.filter(
              (entry: any) =>
                entry &&
                entry.product &&
                typeof entry.product.id === "string" &&
                typeof entry.quantity === "number" &&
                entry.quantity > 0
            )
          );
        }
      }
    } catch {
      // Corrupt cart payload — start clean.
    }
    setIsHydrated(true);
  }, []);

  // Persist whenever the cart changes (after hydration).
  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Storage unavailable (private mode / quota) — keep in-memory only.
    }
  }, [items, isHydrated]);

  const addItem = useCallback((product: Product, quantity = 1) => {
    setItems(prev => {
      const existing = prev.find(entry => entry.product.id === product.id);
      if (existing) {
        return prev.map(entry =>
          entry.product.id === product.id
            ? {
                product,
                quantity: clampToStock(entry.quantity + quantity, product.stock)
              }
            : entry
        );
      }
      if (product.stock <= 0) return prev;
      return [...prev, { product, quantity: clampToStock(quantity, product.stock) }];
    });
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    setItems(prev => {
      if (quantity <= 0) {
        return prev.filter(entry => entry.product.id !== productId);
      }
      return prev.map(entry =>
        entry.product.id === productId
          ? { ...entry, quantity: clampToStock(quantity, entry.product.stock) }
          : entry
      );
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems(prev => prev.filter(entry => entry.product.id !== productId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const quantityOf = useCallback(
    (productId: string) =>
      items.find(entry => entry.product.id === productId)?.quantity ?? 0,
    [items]
  );

  const count = useMemo(
    () => items.reduce((sum, entry) => sum + entry.quantity, 0),
    [items]
  );

  const subtotalNetCents = useMemo(
    () =>
      items.reduce(
        (sum, entry) => sum + entry.product.price_cents * entry.quantity,
        0
      ),
    [items]
  );

  const value: CartContextValue = {
    items,
    count,
    subtotalNetCents,
    isHydrated,
    addItem,
    setQuantity,
    removeItem,
    clear,
    quantityOf
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return ctx;
}
