import { createContext, useContext, type ReactNode } from "react";
import { useML10X as useML10XHook } from "@/hooks/useML10X";

type ML10XContextValue = ReturnType<typeof useML10XHook>;

const ML10XContext = createContext<ML10XContextValue | null>(null);

export function ML10XProvider({ children }: { children: ReactNode }) {
  const value = useML10XHook();
  return <ML10XContext.Provider value={value}>{children}</ML10XContext.Provider>;
}

export function useML10X(): ML10XContextValue {
  const ctx = useContext(ML10XContext);
  if (!ctx) throw new Error("useML10X must be used within ML10XProvider");
  return ctx;
}
