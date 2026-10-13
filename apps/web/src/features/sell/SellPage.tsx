import { useEffect, useState } from 'react';
import { formatBaht, isValidPromptPayId, promptPayPayload, type DisplayState, type PaymentMethod, type Product } from '@pos/shared';
import type { LocalSale } from '../../lib/db';
import { publishDisplay } from '../../lib/display';
import { useProducts, useSettings } from '../../lib/hooks';
import { CartPanel } from './CartPanel';
import { PaymentDialog } from './PaymentDialog';
import { ProductGrid } from './ProductGrid';
import { ReceiptDialog } from './ReceiptDialog';
import { useCart, type Cart } from './useCart';

export type PayDraft = { method: PaymentMethod; received: number };

export function SellPage() {
  const products = useProducts();
  const settings = useSettings();
  const cart = useCart(products);
  const [cartOpen, setCartOpen] = useState(false);
  const [paying, setPaying] = useState<PayDraft | null>(null);
  const [done, setDone] = useState<LocalSale | null>(null);
  const [toast, setToast] = useState('');

  const qr = paying?.method === 'transfer' && settings?.promptPayId && isValidPromptPayId(settings.promptPayId) && cart.total > 0
    ? promptPayPayload(settings.promptPayId, cart.total)
    : undefined;

  // จอลูกค้าสะท้อนสิ่งที่เกิดที่เคาน์เตอร์เสมอ
  useEffect(() => {
    publishDisplay(displayState(settings?.name ?? '', cart, paying, done, qr));
  }, [settings?.name, cart, paying, done, qr]);

  const add = (p: Product, d = 1) => {
    if (!cart.add(p, d)) flash(`${p.name} เหลือในสต็อก ${p.stock} ชิ้น`);
  };
  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  return (
    <section className="view">
      <div className="sell">
        <ProductGrid products={products} qtyOf={cart.qtyOf} onAdd={add} onNotFound={(q) => flash(`ไม่พบสินค้า “${q}”`)} />
        <CartPanel cart={cart} open={cartOpen} onClose={() => setCartOpen(false)} onAdd={add} onPay={() => setPaying({ method: 'cash', received: cart.total })} />
        <button className="cartbar" onClick={() => setCartOpen(true)}>
          <span>{cart.count ? `ดูบิล · ${cart.count} ชิ้น` : 'บิลว่าง'}</span>
          <span className="num">{formatBaht(cart.total)}</span>
        </button>
      </div>
      {paying && (
        <PaymentDialog
          cart={cart}
          qr={qr}
          hasPromptPay={!!settings?.promptPayId}
          onChange={setPaying}
          onClose={() => setPaying(null)}
          onDone={(sale) => {
            cart.clear();
            setPaying(null);
            setCartOpen(false);
            setDone(sale);
          }}
        />
      )}
      {done && <ReceiptDialog sale={done} fresh onClose={() => setDone(null)} />}
      {toast && <div className="toast">{toast}</div>}
    </section>
  );
}

function displayState(shopName: string, cart: Cart, paying: PayDraft | null, done: LocalSale | null, qr?: string): DisplayState {
  if (done)
    return { phase: 'done', shopName, items: [], subtotal: done.subtotal, discount: done.discount, total: done.total, method: done.method, received: done.received, change: done.change, billNo: done.billNo };
  const base = {
    shopName,
    items: cart.items.map((i) => ({ name: i.name, qty: i.qty, price: i.price })),
    subtotal: cart.subtotal,
    discount: cart.discount,
    total: cart.total,
  };
  if (paying) return { ...base, phase: 'pay', method: paying.method, received: paying.received, qr };
  return { ...base, phase: cart.items.length ? 'cart' : 'idle' };
}
