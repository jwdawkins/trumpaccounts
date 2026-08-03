import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { GiftDraft } from "./api";

export interface CartLine extends GiftDraft {
  id: string; // client-side line id
}

interface CartState {
  lines: CartLine[];
  add: (item: GiftDraft) => void;
  remove: (id: string) => void;
  clear: () => void;
  totalCents: number;
}

const Ctx = createContext<CartState | null>(null);
const STORAGE_KEY = "giftcart.v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as CartLine[];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [lines]);

  const add = (item: GiftDraft) =>
    setLines((prev) => [...prev, { ...item, id: crypto.randomUUID() }]);
  const remove = (id: string) => setLines((prev) => prev.filter((l) => l.id !== id));
  const clear = () => setLines([]);
  const totalCents = lines.reduce((s, l) => s + l.totalAmount, 0);

  return <Ctx.Provider value={{ lines, add, remove, clear, totalCents }}>{children}</Ctx.Provider>;
}

export function useCart(): CartState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
