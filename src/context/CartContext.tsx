
import React, {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

type CartContextType = {
  cart: Record<string, number>;
  addToCart: (id: string) => void;
  removeFromCart: (id: string) => void;
  setQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Record<string, number>>({});

  const addToCart = (id: string) => {
    setCart((prev) => ({
      ...prev,
      [id]: (prev[id] || 0) + 1,
    }));
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });
  };

  const setQuantity = (id: string, quantity: number) => {
    setCart((prev) => {
      const updated = { ...prev };

      if (quantity <= 0) {
        delete updated[id];
      } else {
        updated[id] = Math.floor(quantity);
      }

      return updated;
    });
  };

  const clearCart = () => setCart({});

  return (
    <CartContext.Provider
      value={{ cart, addToCart, removeFromCart, setQuantity, clearCart }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart must be used inside CartProvider");
  }

  return context;
}
