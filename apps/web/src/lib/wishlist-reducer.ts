/**
 * Wishlist reducer — client-side, localStorage-persisted (template-alignment
 * T2.5). Mirrors `cart-reducer.ts` shape 1:1: pure state/action types + a
 * reducer + selectors, kept dependency-free so it's trivially unit-testable
 * without React or DOM.
 */
export interface WishlistItem {
  productId: string;
  name: string;
  price: number;
  imageUrl?: string | null;
}

export interface WishlistState {
  items: WishlistItem[];
}

export type WishlistAction =
  | { type: "ADD_ITEM"; item: WishlistItem }
  | { type: "REMOVE_ITEM"; productId: string }
  | { type: "TOGGLE_ITEM"; item: WishlistItem }
  | { type: "CLEAR" }
  | { type: "HYDRATE"; state: WishlistState };

export const EMPTY_WISHLIST: WishlistState = { items: [] };

export function wishlistReducer(
  state: WishlistState,
  action: WishlistAction,
): WishlistState {
  switch (action.type) {
    case "ADD_ITEM": {
      if (state.items.some((i) => i.productId === action.item.productId)) {
        return state;
      }
      return { items: [...state.items, action.item] };
    }
    case "REMOVE_ITEM": {
      return {
        items: state.items.filter((i) => i.productId !== action.productId),
      };
    }
    case "TOGGLE_ITEM": {
      const exists = state.items.some(
        (i) => i.productId === action.item.productId,
      );
      if (exists) {
        return {
          items: state.items.filter(
            (i) => i.productId !== action.item.productId,
          ),
        };
      }
      return { items: [...state.items, action.item] };
    }
    case "CLEAR":
      return { items: [] };
    case "HYDRATE":
      return action.state;
    default:
      return state;
  }
}

export function selectItemCount(state: WishlistState): number {
  return state.items.length;
}

export function isWishlisted(state: WishlistState, productId: string): boolean {
  return state.items.some((i) => i.productId === productId);
}
