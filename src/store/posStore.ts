import { create } from 'zustand';

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  sale_price: number;
  cost_price?: number;
  stock: number;
}

export interface CartItem extends Product {
  quantity: number;
  subtotal: number;
}

interface PosState {
  cart: CartItem[];
  discount: number;
  addToCart: (product: Product, qty?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, qty: number) => void;
  setDiscount: (amount: number) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  getCartSubtotal: () => number;
}

export const usePosStore = create<PosState>((set, get) => ({
  cart: [],
  discount: 0,

  addToCart: (product, qty = 1) => {
    const { cart } = get();
    const existing = cart.find(item => item.id === product.id);

    if (existing) {
      set({
        cart: cart.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + qty, subtotal: (item.quantity + qty) * item.sale_price }
            : item
        )
      });
    } else {
      set({
        cart: [...cart, { ...product, quantity: qty, subtotal: qty * product.sale_price }]
      });
    }
  },

  removeFromCart: (productId) => {
    set((state) => ({
      cart: state.cart.filter(item => item.id !== productId)
    }));
  },

  updateQuantity: (productId, qty) => {
    if (qty <= 0) {
      get().removeFromCart(productId);
      return;
    }
    set((state) => ({
      cart: state.cart.map(item =>
        item.id === productId
          ? { ...item, quantity: qty, subtotal: qty * item.sale_price }
          : item
      )
    }));
  },

  setDiscount: (amount) => set({ discount: amount }),

  clearCart: () => set({ cart: [], discount: 0 }),

  getCartSubtotal: () => {
    return get().cart.reduce((total, item) => total + item.subtotal, 0);
  },

  getCartTotal: () => {
    const subtotal = get().getCartSubtotal();
    return Math.max(0, subtotal - get().discount);
  }
}));
