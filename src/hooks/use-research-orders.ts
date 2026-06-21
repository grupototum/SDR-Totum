import { useCallback, useEffect, useState } from "react";
import { listOrders, RESEARCH_ORDERS_EVENT } from "@/lib/research/storage";
import type { ResearchOrder } from "@/lib/research/types";

/** Lista reativa das ordens salvas (sincroniza via evento + storage). */
export function useResearchOrders(): ResearchOrder[] {
  const [orders, setOrders] = useState<ResearchOrder[]>([]);

  const refresh = useCallback(() => setOrders(listOrders()), []);

  useEffect(() => {
    refresh();
    window.addEventListener(RESEARCH_ORDERS_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(RESEARCH_ORDERS_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [refresh]);

  return orders;
}
