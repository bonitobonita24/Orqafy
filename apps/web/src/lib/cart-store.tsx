"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from "react";

import {
  EMPTY_CART,
  cartReducer,
  selectItemCount,
  selectSubtotal,
  type CartItem,
  type CartState,
} from "@/lib/cart-reducer";

interface CartContextValue {
  state: CartState;
  itemCount: number;
  subtotal: number;
  hydrated: boolean;
  tenantSlug: string;
  addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
  removeItem: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function storageKey(tenantSlug: string): string {
  return `orqafy-cart-${tenantSlug}`;
}

function readFromStorage(key: string): CartState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      "items" in parsed &&
      Array.isArray(parsed.items)
    ) {
      return parsed as CartState;
    }
    return null;
  } catch {
    return null;
  }
}

function writeToStorage(key: string, state: CartState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // Quota exceeded or storage disabled — fail silently; UI still works.
  }
}

interface CartProviderProps {
  tenantSlug: string;
  children: ReactNode;
}

export function CartProvider({
  tenantSlug,
  children,
}: CartProviderProps): ReactNode {
  const [state, dispatch] = useReducer(cartReducer, EMPTY_CART);
  const [hydrated, setHydrated] = useState(false);
  const key = storageKey(tenantSlug);

  useEffect(() => {
    const stored = readFromStorage(key);
    if (stored !== null) {
      dispatch({ type: "HYDRATE", state: stored });
    }
    setHydrated(true);
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    writeToStorage(key, state);
  }, [key, state, hydrated]);

  const addItem = useCallback<CartContextValue["addItem"]>((item) => {
    dispatch({ type: "ADD_ITEM", item });
  }, []);

  const removeItem = useCallback<CartContextValue["removeItem"]>(
    (productId) => {
      dispatch({ type: "REMOVE_ITEM", productId });
    },
    [],
  );

  const setQuantity = useCallback<CartContextValue["setQuantity"]>(
    (productId, quantity) => {
      dispatch({ type: "SET_QUANTITY", productId, quantity });
    },
    [],
  );

  const clear = useCallback<CartContextValue["clear"]>(() => {
    dispatch({ type: "CLEAR" });
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      state,
      itemCount: selectItemCount(state),
      subtotal: selectSubtotal(state),
      hydrated,
      tenantSlug,
      addItem,
      removeItem,
      setQuantity,
      clear,
    }),
    [state, hydrated, tenantSlug, addItem, removeItem, setQuantity, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (ctx === null) {
    throw new Error("useCart must be used inside <CartProvider>");
  }
  return ctx;
}
