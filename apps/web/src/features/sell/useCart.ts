import { useMemo, useReducer } from 'react';
import { computeSaleTotals, type Product, type SaleItem } from '@pos/shared';

type State = { lines: Record<string, number>; discount: number };
type Action =
  | { type: 'add'; id: string; delta: number; max: number }
  | { type: 'discount'; value: number }
  | { type: 'clear' };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'add': {
      const next = Math.min((s.lines[a.id] ?? 0) + a.delta, a.max);
      const lines = { ...s.lines };
      if (next <= 0) delete lines[a.id];
      else lines[a.id] = next;
      return { ...s, lines };
    }
    case 'discount':
      return { ...s, discount: Math.max(0, a.value) };
    case 'clear':
      return { lines: {}, discount: 0 };
  }
}

export function useCart(products: Product[] | undefined) {
  const [state, dispatch] = useReducer(reducer, { lines: {}, discount: 0 });

  const view = useMemo(() => {
    const byId = new Map((products ?? []).map((p) => [p.id, p]));
    const items: (SaleItem & { product: Product })[] = [];
    for (const [id, qty] of Object.entries(state.lines)) {
      const p = byId.get(id);
      if (p) items.push({ productId: id, name: p.name, price: p.price, cost: p.cost, qty, product: p });
    }
    const totals = computeSaleTotals(items, state.discount, 0);
    return { items, ...totals, count: items.reduce((a, i) => a + i.qty, 0), qtyOf: (id: string) => state.lines[id] ?? 0 };
  }, [products, state]);

  return {
    ...view,
    /** คืน false ถ้าเกินสต็อก */
    add(p: Product, delta = 1) {
      const want = (state.lines[p.id] ?? 0) + delta;
      dispatch({ type: 'add', id: p.id, delta, max: Math.max(0, p.stock) });
      return want <= p.stock;
    },
    setDiscount: (satang: number) => dispatch({ type: 'discount', value: satang }),
    clear: () => dispatch({ type: 'clear' }),
  };
}
export type Cart = ReturnType<typeof useCart>;
