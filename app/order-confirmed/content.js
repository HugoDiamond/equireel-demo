"use client";

import { useEffect, useState } from "react";
import { href, purchases } from "../../lib/eq";

export default function OrderConfirmedContent() {
  const [state, setState] = useState("loading"); // loading | ok | cancelled
  const [email, setEmail] = useState("");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setEmail(purchases.email());
    setState(q.get("cancelled") ? "cancelled" : "ok");
  }, []);

  if (state === "loading") return null;

  if (state === "cancelled") {
    return (
      <div className="co2-done oc-page">
        <h3>Payment cancelled</h3>
        <p className="co2-done-line">No charge was made. Your order is still here if you'd like to finish it.</p>
        <div className="co2-done-actions">
          <a className="btn primary big" href={href("/")}>Back to the site</a>
        </div>
      </div>
    );
  }

  return (
    <div className="co2-done oc-page">
      <div className="co2-tick">✓</div>
      <h3>Order Confirmed</h3>
      <p className="co2-done-line">Payment received — our editors have your order.</p>
      <p className="co2-done-promise">Your video will be delivered by email within 5 days (usually much sooner).</p>
      <p className="co2-done-spam">
        A confirmation{email ? " has been sent to " + email : " email is on its way"}.
        Delivery comes from <strong>info@equireel.com</strong> — check your spam folder if you don't see it.
      </p>
      <div className="co2-done-actions">
        <a className="btn big" href={href("/")}>Browse more events</a>
      </div>
    </div>
  );
}
