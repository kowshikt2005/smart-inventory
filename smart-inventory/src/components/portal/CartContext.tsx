"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

export interface CartItem {
  itemId: string;
  name: string;
  itemCode: string;
  sellingPrice: number;
  mrp: number;
  unit: string;
  imageUrl: string | null;
  quantity: number;
  gstRate: number;
  discountPercent: number;
}

interface CartContextValue {
  items: CartItem[];
  totalItems: number;
  totalAmount: number;
  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const CART_KEY_PREFIX = "portal-cart-";
const ANONYMOUS_CART_KEY = "portal-cart";

function getCartKey(customerId: string | null): string {
  return customerId ? `${CART_KEY_PREFIX}${customerId}` : ANONYMOUS_CART_KEY;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Resolve the current customer ID from /api/portal/me.
  // If the token is missing or invalid the request returns 401 — we leave
  // customerId null (anonymous cart that gets cleared on next login).
  useEffect(() => {
    fetch("/api/portal/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.customer?.id) {
          setCustomerId(data.customer.id);
        } else {
          setCustomerId(null);
        }
      })
      .catch(() => setCustomerId(null));
  }, []);

  // Load cart from localStorage once we know the customerId
  useEffect(() => {
    if (!hydrated || customerId === undefined) return;
    try {
      const key = getCartKey(customerId);
      const stored = localStorage.getItem(key);
      if (stored) setItems(JSON.parse(stored));
      else setItems([]);
    } catch {
      setItems([]);
    }
    setHydrated(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  // Initial hydration — wait for customerId to settle
  useEffect(() => {
    setHydrated(true);
  }, []);

  // Persist to localStorage whenever items change
  useEffect(() => {
    if (!hydrated || customerId === undefined) return;
    try {
      localStorage.setItem(getCartKey(customerId), JSON.stringify(items));
    } catch {
      // ignore
    }
  }, [items, hydrated, customerId]);

  const addItem = useCallback((newItem: Omit<CartItem, "quantity">) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.itemId === newItem.itemId);
      if (existing) {
        return prev.map((i) =>
          i.itemId === newItem.itemId ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { ...newItem, quantity: 1 }];
    });
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setItems((prev) => prev.filter((i) => i.itemId !== itemId));
  }, []);

  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((i) => i.itemId !== itemId));
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.itemId === itemId ? { ...i, quantity } : i))
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalAmount = items.reduce((sum, i) => sum + i.sellingPrice * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, totalItems, totalAmount, addItem, removeItem, updateQuantity, clearCart }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
