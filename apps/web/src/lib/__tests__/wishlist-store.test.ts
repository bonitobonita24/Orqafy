import { describe, it, expect, afterEach } from "vitest";
import {
  EMPTY_WISHLIST,
  isWishlisted,
  selectItemCount,
  wishlistReducer,
  type WishlistItem,
  type WishlistState,
} from "../wishlist-reducer";
import {
  readFromStorage,
  storageKey,
  writeToStorage,
} from "../wishlist-store";

function item(overrides: Partial<WishlistItem> = {}): WishlistItem {
  return {
    productId: "ck1234567890123456789012a",
    name: "Mouse",
    price: 500,
    imageUrl: null,
    ...overrides,
  };
}

describe("wishlistReducer", () => {
  it("ADD_ITEM appends a new product", () => {
    const state = wishlistReducer(EMPTY_WISHLIST, {
      type: "ADD_ITEM",
      item: item(),
    });
    expect(state.items).toHaveLength(1);
    expect(state.items[0]?.productId).toBe("ck1234567890123456789012a");
  });

  it("ADD_ITEM is idempotent for an already-wishlisted product", () => {
    const once = wishlistReducer(EMPTY_WISHLIST, {
      type: "ADD_ITEM",
      item: item(),
    });
    const twice = wishlistReducer(once, { type: "ADD_ITEM", item: item() });
    expect(twice.items).toHaveLength(1);
  });

  it("REMOVE_ITEM drops the matching productId", () => {
    const state: WishlistState = {
      items: [item(), item({ productId: "ck1234567890123456789012b" })],
    };
    const next = wishlistReducer(state, {
      type: "REMOVE_ITEM",
      productId: "ck1234567890123456789012a",
    });
    expect(next.items).toHaveLength(1);
    expect(next.items[0]?.productId).toBe("ck1234567890123456789012b");
  });

  it("TOGGLE_ITEM adds when absent", () => {
    const state = wishlistReducer(EMPTY_WISHLIST, {
      type: "TOGGLE_ITEM",
      item: item(),
    });
    expect(state.items).toHaveLength(1);
  });

  it("TOGGLE_ITEM removes when present", () => {
    const added = wishlistReducer(EMPTY_WISHLIST, {
      type: "TOGGLE_ITEM",
      item: item(),
    });
    const removed = wishlistReducer(added, {
      type: "TOGGLE_ITEM",
      item: item(),
    });
    expect(removed.items).toHaveLength(0);
  });

  it("CLEAR empties the wishlist", () => {
    const state: WishlistState = { items: [item()] };
    expect(wishlistReducer(state, { type: "CLEAR" }).items).toHaveLength(0);
  });

  it("HYDRATE replaces state wholesale", () => {
    const incoming: WishlistState = { items: [item({ name: "Keyboard" })] };
    const next = wishlistReducer(EMPTY_WISHLIST, {
      type: "HYDRATE",
      state: incoming,
    });
    expect(next).toEqual(incoming);
  });

  it("does not mutate the input state (immutability)", () => {
    const original: WishlistState = { items: [item()] };
    const frozen: WishlistState = {
      items: Object.freeze([...original.items]) as WishlistItem[],
    };
    wishlistReducer(frozen, {
      type: "TOGGLE_ITEM",
      item: item({ productId: "ck1234567890123456789012b" }),
    });
    expect(frozen.items).toHaveLength(1);
  });
});

describe("selectors", () => {
  it("selectItemCount counts wishlisted products", () => {
    const state: WishlistState = {
      items: [item(), item({ productId: "ck1234567890123456789012b" })],
    };
    expect(selectItemCount(state)).toBe(2);
  });

  it("isWishlisted reflects membership", () => {
    const state: WishlistState = { items: [item()] };
    expect(isWishlisted(state, "ck1234567890123456789012a")).toBe(true);
    expect(isWishlisted(state, "ck1234567890123456789012b")).toBe(false);
  });
});

describe("storageKey (tenant-keying)", () => {
  it("scopes the storage key per tenant slug", () => {
    expect(storageKey("acme")).toBe("orqafy-wishlist-acme");
    expect(storageKey("other-tenant")).toBe("orqafy-wishlist-other-tenant");
    expect(storageKey("acme")).not.toBe(storageKey("other-tenant"));
  });
});

describe("persistence (readFromStorage / writeToStorage)", () => {
  interface FakeLocalStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    store: Map<string, string>;
  }

  function makeFakeLocalStorage(): FakeLocalStorage {
    const store = new Map<string, string>();
    return {
      store,
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => {
        store.set(key, value);
      },
    };
  }

  const originalWindow = (globalThis as { window?: unknown }).window;

  afterEach(() => {
    (globalThis as { window?: unknown }).window = originalWindow;
  });

  it("returns null when no window is available (SSR guard)", () => {
    expect(readFromStorage(storageKey("acme"))).toBeNull();
  });

  it("write then read round-trips through localStorage", () => {
    const fakeLocalStorage = makeFakeLocalStorage();
    (globalThis as { window?: unknown }).window = { localStorage: fakeLocalStorage };

    const key = storageKey("acme");
    const state: WishlistState = { items: [item()] };
    writeToStorage(key, state);
    expect(fakeLocalStorage.store.get(key)).toBe(JSON.stringify(state));
    expect(readFromStorage(key)).toEqual(state);
  });

  it("returns null for malformed/foreign JSON in storage", () => {
    const fakeLocalStorage = makeFakeLocalStorage();
    fakeLocalStorage.store.set(storageKey("acme"), JSON.stringify({ notItems: true }));
    (globalThis as { window?: unknown }).window = { localStorage: fakeLocalStorage };

    expect(readFromStorage(storageKey("acme"))).toBeNull();
  });

  it("keeps tenant A and tenant B wishlists isolated under the same fake storage", () => {
    const fakeLocalStorage = makeFakeLocalStorage();
    (globalThis as { window?: unknown }).window = { localStorage: fakeLocalStorage };

    writeToStorage(storageKey("tenant-a"), { items: [item()] });
    writeToStorage(storageKey("tenant-b"), { items: [] });

    expect(readFromStorage(storageKey("tenant-a"))?.items).toHaveLength(1);
    expect(readFromStorage(storageKey("tenant-b"))?.items).toHaveLength(0);
  });
});
