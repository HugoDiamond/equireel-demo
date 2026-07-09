/* Terms of sale — drafted against how the site actually works (Stripe
   checkout, 5-day email delivery, public-video consent, withdrawal/elimination
   policy from the FAQ). Plain English on purpose. */

import { Header, Footer, Crumbs } from "../../components/Chrome";

export const metadata = {
  title: "Terms & Conditions — Equireel",
  description: "The terms that apply when you order a video from Equireel."
};

export default function TermsPage() {
  return (
    <>
      <Header />

      <div className="container page-head">
        <Crumbs trail={[{ label: "Terms & Conditions" }]} />
        <h1>Terms &amp; Conditions</h1>
        <p className="sub">The short version: you order a video of your round, we edit it and email it to you, and if something isn&rsquo;t right we fix it. The detail is below. Questions: <a href="mailto:info@equireel.com">info@equireel.com</a>.</p>
      </div>

      <div className="container legal" style={{ paddingBottom: "56px", maxWidth: "820px" }}>
        <h2>1. Who we are</h2>
        <p>Equireel is an equine media company filming eventing competitions, with a particular focus on the cross country phase (&ldquo;Equireel&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). Contact: <a href="mailto:info@equireel.com">info@equireel.com</a>. These terms apply to orders placed on this website.</p>

        <h2>2. What you're buying</h2>
        <p>A professionally edited video of the horse and round you select at checkout (cross country, show jumping, social reel or single-fence video, with any add-ons you choose). Every video is <strong>made to order for you</strong> — edited from our footage of your specific round, with your chosen flag, music and sound preferences.</p>

        <h2>3. Price and payment</h2>
        <p>The price is shown before you pay, in the currency of the event's region (&pound; UK, &euro; Europe, $ USA). Payment is taken securely by <strong>Stripe</strong> — card details go directly to Stripe and never touch our servers. Your order is confirmed by email once payment succeeds.</p>

        <h2>4. Delivery</h2>
        <p>Your video is delivered <strong>by email</strong> to the address you give at checkout. The delivery promise for your event is shown under the order button before you pay — some videos are ready instantly, some within the hour, and the rest within 5 days. Delivery emails come from info@equireel.com; add us to your contacts and check spam if you don't see it.</p>

        <h2>5. Cancellations and refunds</h2>
        <ul>
          <li><strong>Before your video is delivered:</strong> cancel any time for a full refund — just email us.</li>
          <li><strong>You withdrew before the cross country:</strong> full refund or a credit towards a future video, your choice.</li>
          <li><strong>You were eliminated or retired on course:</strong> we can deliver your video with all footage up to where your day ended, or refund you — your choice.</li>
          <li><strong>Something wrong with the video:</strong> edit requests are free after delivery. If we genuinely didn't capture your round, you get a full refund.</li>
        </ul>
        <p>Because each video is personalised and made to order, the standard 14-day cancellation right for online purchases ends once your video has been delivered — but the goodwill policy above goes further than the law requires, and it's the one we work to. Refunds go back to the card you paid with.</p>

        <h2>6. Public videos</h2>
        <p>At checkout you choose whether your video is <strong>public or private</strong>. If you tick Public, you give Equireel a non-exclusive permission to show that video on this website and on our social media channels, credited to your ride. You can withdraw that permission at any time by emailing us and we'll take it down. Private videos are delivered only to you.</p>

        <h2>7. Your video, your use</h2>
        <p>Once delivered, your video is yours to keep, share and post. Equireel retains ownership of the underlying footage and may use footage from public competition (excluding your purchased private edit) for promotion of the sport and our service.</p>

        <h2>8. Filming and takedowns</h2>
        <p>We film at public sporting events by arrangement with organisers. Competitor and horse names shown on this site come from the public event programme. If you appear in our footage or listings and want something removed, email <a href="mailto:info@equireel.com">info@equireel.com</a> and we'll act promptly.</p>

        <h2>9. The sensible legal bits</h2>
        <p>We're not liable for things outside our control (weather stopping a class, an organiser cancelling, technical failure of a camera at your fence — though if we didn't capture your round, you're refunded in full). Nothing in these terms limits your statutory rights as a consumer. These terms are governed by the law of England and Wales; if you buy as a consumer elsewhere in the UK or EU you keep any mandatory protections of your home country.</p>

        <p className="legal-updated">Last updated: July 2026</p>
      </div>

      <Footer />
    </>
  );
}
