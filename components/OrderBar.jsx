"use client";

/* Order-in-progress bar — appears when the visitor has used "add & keep
   browsing". Floats at the bottom on every page (mounted from the Header),
   shows the running count and total, and opens the multi-item checkout.
   Reads entry ids from the session basket and resolves them against the
   entries store, so it survives page-to-page navigation. */

import { useEffect, useState } from "react";
import { basket, findEntry, onDataLoaded, defaultFlagFor, money, productPrices } from "../lib/eq";
import Checkout from "./Checkout";

export default function OrderBar() {
  const [mounted, setMounted] = useState(false);
  /* the open checkout holds a SNAPSHOT of the items — paying clears the
     basket, and the confirmation must survive the bar disappearing */
  const [order, setOrder] = useState(null);
  const [, tick] = useState(0);

  useEffect(() => {
    setMounted(true);
    const off1 = basket.onChange(() => tick((n) => n + 1));
    const off2 = onDataLoaded(() => tick((n) => n + 1));
    return () => { off1(); off2(); };
  }, []);

  if (!mounted) return null;
  const items = basket.ids().map((id) => findEntry(id)).filter(Boolean)
    .map(({ en, ev }) => ({ ev, en, product: "xc", addSJ: false, addReel: false }));
  if (!items.length && !order) return null;

  /* running total grouped by currency (money("", c) yields just the symbol) */
  const sums = new Map();
  items.forEach((it) => {
    const s = money("", it.ev.country);
    sums.set(s, (sums.get(s) || 0) + productPrices(it.ev).xc);
  });
  const totalStr = [...sums.entries()].map(([s, n]) => s + n).join(" + ");

  return (
    <>
      {items.length > 0 && (
        <div className="orderbar" role="status" aria-label="Order in progress">
          <span className="ob-sum">
            <strong>{items.length} video{items.length > 1 ? "s" : ""}</strong> — {totalStr}
          </span>
          <button className="ob-clear" onClick={() => basket.clear()}>Clear</button>
          <button className="ob-go" onClick={() => setOrder({ items, flag: defaultFlagFor(items[0].ev, items[0].en) })}>Checkout</button>
        </div>
      )}
      {order && <Checkout order={order} onClose={() => setOrder(null)} />}
    </>
  );
}
