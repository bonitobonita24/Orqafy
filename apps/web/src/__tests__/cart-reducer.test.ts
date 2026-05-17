import { describe, expect, it } from "vitest";

import {
  cartReducer,
  selectItemCount,
  selectSubtotal,
  type CartState,
} from "@/lib/cart-reducer";

const EMPTY: CartState = { items: [] };

const sampleItem = {
  productId: "prod_abc",
  name: "Widget",
  price: 100,
  imageUrl: null,
};

describe("cart-reducer / ADD_ITEM", () => {
  it("appends a new item with default quantity 1", () => {
    const next = cartReducer(EMPTY, { type: "ADD_ITEM", item: sampleItem });
    expect(next.items).toHaveLength(1);
    expect(next.items[0]).toMatchObject({ productId: "prod_abc", quantity: 1 });
  });

  it("appends a new item with explicit quantity", () => {
    const next = cartReducer(EMPTY, {
      type: "ADD_ITEM",
      item: { ...sampleItem, quantity: 3 },
    });
    expect(next.items[0]?.quantity).toBe(3);
  });

  it("increments quantity when the same productId is added again", () => {
    const once = cartReducer(EMPTY, { type: "ADD_ITEM", item: sampleItem });
    const twice = cartReducer(once, {
      type: "ADD_ITEM",
      item: { ...sampleItem, quantity: 2 },
    });
    expect(twice.items).toHaveLength(1);
    expect(twice.items[0]?.quantity).toBe(3);
  });

  it("returns a NEW state object (immutability)", () => {
    const next = cartReducer(EMPTY, { type: "ADD_ITEM", item: sampleItem });
    expect(next).not.toBe(EMPTY);
    expect(next.items).not.toBe(EMPTY.items);
  });
});

describe("cart-reducer / REMOVE_ITEM", () => {
  it("removes the item with matching productId", () => {
    const state: CartState = {
      items: [
        { ...sampleItem, quantity: 1 },
        { productId: "prod_xyz", name: "Other", price: 50, quantity: 2 },
      ],
    };
    const next = cartReducer(state, {
      type: "REMOVE_ITEM",
      productId: "prod_abc",
    });
    expect(next.items).toHaveLength(1);
    expect(next.items[0]?.productId).toBe("prod_xyz");
  });

  it("is a no-op when productId is not in the cart", () => {
    const state: CartState = {
      items: [{ ...sampleItem, quantity: 1 }],
    };
    const next = cartReducer(state, {
      type: "REMOVE_ITEM",
      productId: "does_not_exist",
    });
    expect(next.items).toHaveLength(1);
  });
});

describe("cart-reducer / SET_QUANTITY", () => {
  it("updates quantity for matching productId", () => {
    const state: CartState = { items: [{ ...sampleItem, quantity: 1 }] };
    const next = cartReducer(state, {
      type: "SET_QUANTITY",
      productId: "prod_abc",
      quantity: 5,
    });
    expect(next.items[0]?.quantity).toBe(5);
  });

  it("removes the item when quantity drops to 0", () => {
    const state: CartState = { items: [{ ...sampleItem, quantity: 3 }] };
    const next = cartReducer(state, {
      type: "SET_QUANTITY",
      productId: "prod_abc",
      quantity: 0,
    });
    expect(next.items).toHaveLength(0);
  });

  it("removes the item when quantity is negative", () => {
    const state: CartState = { items: [{ ...sampleItem, quantity: 3 }] };
    const next = cartReducer(state, {
      type: "SET_QUANTITY",
      productId: "prod_abc",
      quantity: -1,
    });
    expect(next.items).toHaveLength(0);
  });

  it("is a no-op when productId is not in the cart", () => {
    const state: CartState = { items: [{ ...sampleItem, quantity: 1 }] };
    const next = cartReducer(state, {
      type: "SET_QUANTITY",
      productId: "missing",
      quantity: 9,
    });
    expect(next.items[0]?.quantity).toBe(1);
  });
});

describe("cart-reducer / CLEAR", () => {
  it("empties the cart", () => {
    const state: CartState = {
      items: [
        { ...sampleItem, quantity: 2 },
        { productId: "prod_xyz", name: "Other", price: 50, quantity: 1 },
      ],
    };
    const next = cartReducer(state, { type: "CLEAR" });
    expect(next.items).toHaveLength(0);
  });
});

describe("cart-reducer / HYDRATE", () => {
  it("replaces state with the provided snapshot", () => {
    const snapshot: CartState = {
      items: [{ ...sampleItem, quantity: 4 }],
    };
    const next = cartReducer(EMPTY, { type: "HYDRATE", state: snapshot });
    expect(next).toEqual(snapshot);
  });
});

describe("cart-reducer / selectors", () => {
  const populated: CartState = {
    items: [
      { ...sampleItem, quantity: 2 }, // 2 × 100 = 200
      { productId: "prod_xyz", name: "Other", price: 50, quantity: 3 }, // 3 × 50 = 150
    ],
  };

  it("selectItemCount sums all quantities", () => {
    expect(selectItemCount(populated)).toBe(5);
  });

  it("selectItemCount returns 0 for an empty cart", () => {
    expect(selectItemCount(EMPTY)).toBe(0);
  });

  it("selectSubtotal sums price × quantity for every line", () => {
    expect(selectSubtotal(populated)).toBe(350);
  });

  it("selectSubtotal returns 0 for an empty cart", () => {
    expect(selectSubtotal(EMPTY)).toBe(0);
  });
});
