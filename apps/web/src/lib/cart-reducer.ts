export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string | null;
}

export interface CartState {
  items: CartItem[];
}

export type CartAction =
  | {
      type: "ADD_ITEM";
      item: Omit<CartItem, "quantity"> & { quantity?: number };
    }
  | { type: "REMOVE_ITEM"; productId: string }
  | { type: "SET_QUANTITY"; productId: string; quantity: number }
  | { type: "CLEAR" }
  | { type: "HYDRATE"; state: CartState };

export const EMPTY_CART: CartState = { items: [] };

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD_ITEM": {
      const incomingQty = action.item.quantity ?? 1;
      const existingIndex = state.items.findIndex(
        (i) => i.productId === action.item.productId,
      );
      if (existingIndex >= 0) {
        const items = state.items.map((i, idx) =>
          idx === existingIndex
            ? { ...i, quantity: i.quantity + incomingQty }
            : i,
        );
        return { items };
      }
      const { quantity: _ignored, ...rest } = action.item;
      return {
        items: [...state.items, { ...rest, quantity: incomingQty }],
      };
    }
    case "REMOVE_ITEM": {
      return {
        items: state.items.filter((i) => i.productId !== action.productId),
      };
    }
    case "SET_QUANTITY": {
      if (action.quantity <= 0) {
        return {
          items: state.items.filter((i) => i.productId !== action.productId),
        };
      }
      return {
        items: state.items.map((i) =>
          i.productId === action.productId
            ? { ...i, quantity: action.quantity }
            : i,
        ),
      };
    }
    case "CLEAR":
      return { items: [] };
    case "HYDRATE":
      return action.state;
    default:
      return state;
  }
}

export function selectItemCount(state: CartState): number {
  return state.items.reduce((sum, i) => sum + i.quantity, 0);
}

export function selectSubtotal(state: CartState): number {
  return state.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
}
