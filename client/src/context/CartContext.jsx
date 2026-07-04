import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const CartContext = createContext(null);
const CART_KEY = 'mira_cart';

// Cart lives in localStorage so guests keep theirs; items carry a product
// snapshot so we can render without refetching.
export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY)) || [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items]);

  const add = (product, size, color, quantity = 1) => {
    setItems((prev) => {
      const idx = prev.findIndex(
        (i) => i.product._id === product._id && i.size === size && i.color === color
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + quantity };
        return next;
      }
      const snapshot = {
        _id: product._id,
        name: product.name,
        price: product.price,
        images: product.images,
        stock: product.stock,
      };
      return [...prev, { product: snapshot, size, color, quantity }];
    });
  };

  const update = (index, quantity) =>
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((_, i) => i !== index)
        : prev.map((it, i) => (i === index ? { ...it, quantity } : it))
    );

  const remove = (index) => setItems((prev) => prev.filter((_, i) => i !== index));
  const clear = () => setItems([]);

  const total = useMemo(
    () => items.reduce((sum, i) => sum + i.product.price * i.quantity, 0),
    [items]
  );
  const count = useMemo(() => items.reduce((n, i) => n + i.quantity, 0), [items]);

  return (
    <CartContext.Provider value={{ items, add, update, remove, clear, total, count }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
