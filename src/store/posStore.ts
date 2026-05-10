import { create } from 'zustand';

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  sale_price: number;
  cost_price?: number;
  stock: number;
  category_id?: string;
  categories?: { name: string };
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

  addToCart: (product) => set((state) => {
    const existing = state.cart.find(item => item.id === product.id);
    if (existing) {
      if (existing.quantity >= product.stock) {
        alert('Stock insuficiente para agregar más unidades.');
        return state;
      }
      return {
        cart: state.cart.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.sale_price }
            : item
        )
      };
    }
    if (product.stock <= 0) {
      alert('Producto sin stock disponible.');
      return state;
    }
    return { cart: [...state.cart, { ...product, quantity: 1, subtotal: product.sale_price }] };
  }),

  removeFromCart: (productId) => {
    set((state) => ({
      cart: state.cart.filter(item => item.id !== productId)
    }));
  },

  updateQuantity: (productId, quantity) => set((state) => ({
    cart: state.cart.map(item => {
      if (item.id === productId) {
        // Prevent exceeding stock
        const validQuantity = Math.min(Math.max(1, quantity), item.stock);
        if (quantity > item.stock) alert('No puedes vender más del stock disponible.');
        return { ...item, quantity: validQuantity, subtotal: validQuantity * item.sale_price };
      }
      return item;
    })
  })),

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
