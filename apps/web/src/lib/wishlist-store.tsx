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
  EMPTY_WISHLIST,
  isWishlisted as selectIsWishlisted,
  selectItemCount,
  wishlistReducer,
  type WishlistItem,
  type WishlistState,
} from "@/lib/wishlist-reducer";

interface WishlistContextValue {
  state: WishlistState;
  itemCount: number;
  hydrated: boolean;
  tenantSlug: string;
  isWishlisted: (productId: string) => boolean;
  toggleItem: (item: WishlistItem) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

// Exported (unlike cart-store.tsx's private equivalents) so the tenant-keying
// + persistence behavior is directly unit-testable without React/DOM.
export function storageKey(tenantSlug: string): string {
  return `orqafy-wishlist-${tenantSlug}`;
}

export function readFromStorage(key: string): WishlistState | null {
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
      return parsed as WishlistState;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeToStorage(key: string, state: WishlistState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // Quota exceeded or storage disabled — fail silently; UI still works.
  }
}

interface WishlistProviderProps {
  tenantSlug: string;
  children: ReactNode;
}

export function WishlistProvider({
  tenantSlug,
  children,
}: WishlistProviderProps): ReactNode {
  const [state, dispatch] = useReducer(wishlistReducer, EMPTY_WISHLIST);
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

  const toggleItem = useCallback<WishlistContextValue["toggleItem"]>((item) => {
    dispatch({ type: "TOGGLE_ITEM", item });
  }, []);

  const removeItem = useCallback<WishlistContextValue["removeItem"]>(
    (productId) => {
      dispatch({ type: "REMOVE_ITEM", productId });
    },
    [],
  );

  const clear = useCallback<WishlistContextValue["clear"]>(() => {
    dispatch({ type: "CLEAR" });
  }, []);

  const isWishlisted = useCallback<WishlistContextValue["isWishlisted"]>(
    (productId) => selectIsWishlisted(state, productId),
    [state],
  );

  const value = useMemo<WishlistContextValue>(
    () => ({
      state,
      itemCount: selectItemCount(state),
      hydrated,
      tenantSlug,
      isWishlisted,
      toggleItem,
      removeItem,
      clear,
    }),
    [state, hydrated, tenantSlug, isWishlisted, toggleItem, removeItem, clear],
  );

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext);
  if (ctx === null) {
    throw new Error("useWishlist must be used inside <WishlistProvider>");
  }
  return ctx;
}
