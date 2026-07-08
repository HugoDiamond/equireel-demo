/* Stripe Checkout return page — success (?sid=...) and cancelled (?cancelled=1)
   states. Static-export friendly: the order itself is written by the Stripe
   webhook server-side; this page only confirms and sets expectations. */

import { Suspense } from "react";
import { Header, Footer } from "../../components/Chrome";
import OrderConfirmedContent from "./content";

export const metadata = {
  title: "Order Confirmed — Equireel",
  robots: { index: false }
};

export default function OrderConfirmedPage() {
  return (
    <>
      <Header />
      <main className="wrap oc-wrap">
        <Suspense fallback={null}>
          <OrderConfirmedContent />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
