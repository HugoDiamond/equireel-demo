/* Privacy policy — describes what the site actually collects and the real
   processor list (Stripe, Vercel, Supabase, Resend, Backblaze, Cloudflare).
   No ad/analytics cookies exist on this site; say so plainly. */

import { Header, Footer, Crumbs } from "../../components/Chrome";

export const metadata = {
  title: "Privacy Policy — Equireel",
  description: "What data Equireel collects, why, and your rights."
};

export default function PrivacyPage() {
  return (
    <>
      <Header />

      <div className="container page-head">
        <Crumbs trail={[{ label: "Privacy Policy" }]} />
        <h1>Privacy Policy</h1>
        <p className="sub">We collect the minimum needed to make and deliver your video, we don&rsquo;t run advertising trackers, and we never sell your data. Questions: <a href="mailto:info@equireel.com">info@equireel.com</a>.</p>
      </div>

      <div className="container legal" style={{ paddingBottom: "56px", maxWidth: "820px" }}>
        <h2>1. What we collect, and why</h2>
        <ul>
          <li><strong>When you order:</strong> your email address and name — to deliver your video and receipt. A postal address only if you order a DVD.</li>
          <li><strong>Payment:</strong> handled entirely by Stripe. We never see or store your card number; we receive confirmation of payment and the card's last four digits for our records.</li>
          <li><strong>Your order details:</strong> the round you bought and your video preferences (flag, music, sounds, public/private) — so the editors make the video you asked for.</li>
          <li><strong>Competition listings:</strong> horse, rider and section names shown on this site come from the public event programme and results, so you can find your ride.</li>
          <li><strong>On this site:</strong> your basket and preferences are kept in your own browser's storage. We set <strong>no advertising or analytics cookies</strong>.</li>
        </ul>

        <h2>2. Who processes it for us</h2>
        <p>Trusted services run parts of our system, each receiving only what they need: <strong>Stripe</strong> (payments), <strong>Vercel</strong> (website hosting), <strong>Supabase</strong> (order database), <strong>Resend</strong> (sending our emails), <strong>Backblaze</strong> (video storage) and <strong>Cloudflare</strong> (domain and traffic routing). Some are US companies operating under recognised UK/EU data-transfer safeguards.</p>

        <h2>3. How long we keep it</h2>
        <p>Order records are kept as long as tax law requires (six years in the UK). Your delivered video is kept so your link keeps working — many riders come back to their videos years later. Ask us and we'll delete your video and personal details sooner.</p>

        <h2>4. Your rights</h2>
        <p>You can ask for a copy of the personal data we hold about you, ask us to correct it, or ask us to delete it (we may need to keep basic order records for tax purposes). If your name appears in a competition listing or public video and you'd like it removed, tell us and we'll act promptly. Email <a href="mailto:info@equireel.com">info@equireel.com</a> — a human reads it. You also have the right to complain to the ICO (ico.org.uk) in the UK or your local data authority in the EU.</p>

        <h2>5. Emails</h2>
        <p>We email you about your order: confirmation, delivery, and replies to anything you ask us. We don't add you to marketing lists without asking first.</p>

        <p className="legal-updated">Last updated: July 2026</p>
      </div>

      <Footer />
    </>
  );
}
