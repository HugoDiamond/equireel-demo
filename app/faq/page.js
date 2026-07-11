/* FAQ — ported 1:1 from faq.html (server component; no client logic needed) */

import { Header, Footer, Crumbs } from "../../components/Chrome";
import { href } from "../../lib/eq";

export const metadata = {
  title: "FAQ — Equireel",
  description:
    "Everything you need to know about ordering your Equireel cross country video — delivery times, editing, music and privacy."
};

const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    { "@type": "Question", name: "How long until my video is ready?",
      acceptedAnswer: { "@type": "Answer", text: "The exact promise is shown under the order button — instantly, within the hour, or within 5 days depending on the event." } },
    { "@type": "Question", name: "What if I withdrew or was eliminated?",
      acceptedAnswer: { "@type": "Answer", text: "Withdrew before cross country: full refund or credit. Eliminated on course: we can send all footage up to where your day ended." } },
    { "@type": "Question", name: "Is my video public or private?",
      acceptedAnswer: { "@type": "Answer", text: "Your choice at checkout. Public videos may be featured on our social media; untick Public video and only you receive the link." } },
    { "@type": "Question", name: "Can I request edits to my video?",
      acceptedAnswer: { "@type": "Answer", text: "Yes — edit requests are free after delivery." } },
    { "@type": "Question", name: "Do I need to book Equireel before my event?",
      acceptedAnswer: { "@type": "Answer", text: "No. If Equireel is at your event, every competitor at every fence is filmed automatically." } }
  ]
};

export default function FaqPage() {
  return (
    <>
      <Header />

      <div className="container page-head">
        <Crumbs trail={[{ label: "FAQ" }]} />
        <h1>Frequently asked questions</h1>
        <p className="sub">Can&rsquo;t find your answer? Email <a href="mailto:info@equireel.com">info@equireel.com</a> — we reply fast.</p>
      </div>

      <div className="container faq" style={{ paddingBottom: "56px", maxWidth: "820px" }}>
        <details>
          <summary>How do I find my video?</summary>
          <p>Search for your horse, your name or your bib number from the homepage, or open your event and browse the entry list. If we were at your event, every combination is listed — no pre-booking needed.</p>
        </details>
        <details>
          <summary>What do the videos look like?</summary>
          <p>Watch real examples before you order — a cross country video, a social reel and a show jumping video are all on our homepage. <a href={href("/#samples")}>Watch the sample videos &rarr;</a></p>
        </details>
        <details>
          <summary>Can I buy a gift voucher?</summary>
          <p>Yes — any amount from £10/€10, emailed instantly to you or straight to the recipient with your message. It spends like cash on any video and is valid for 24 months; any unused balance stays on the code. <a href={href("/gift-vouchers")}>Buy a gift voucher &rarr;</a></p>
        </details>
        <details>
          <summary>Where can I find videos I&rsquo;ve already bought?</summary>
          <p>Every video you&rsquo;ve ever ordered lives in <a href={href("/my-videos")}>My Videos</a> — sign in with just the email you order with (no password needed), including orders from past seasons.</p>
        </details>
        <details>
          <summary>How long until my video is ready?</summary>
          <p>It depends on the event — the exact promise is shown <strong>under the order button</strong> before you pay. Some videos are ready to watch instantly, some arrive within the hour, and the rest within 5 days. Your video is emailed to you from info@equireel.com the moment it&rsquo;s ready — check your spam folder if you don&rsquo;t see it.</p>
        </details>
        <details>
          <summary>What if I withdrew or was eliminated?</summary>
          <p>No problem. If you withdrew before the cross country, you can choose a <strong>full refund or a credit</strong> towards a future video. If you were eliminated on course, we can still send your video with all the footage up to where your day ended — many riders order exactly that to review what happened.</p>
        </details>
        <details>
          <summary>Is my video public or private?</summary>
          <p>Your choice, at checkout. Public videos may be featured on our social media — most riders love the shout-out. Prefer to keep it to yourself? Untick <strong>Public video</strong> when you order and only you receive the link. The event entry list (horse, rider and owner names) is shown so you can find your ride, exactly as it appears in the public programme.</p>
        </details>
        <details>
          <summary>Can I request edits to my video?</summary>
          <p>Yes — <strong>edit requests are free</strong> after delivery. If you&rsquo;d like a different cut, extra slow motion on a particular fence, or anything else adjusted, just reply to your delivery email and we&rsquo;ll re-edit it.</p>
        </details>
        <details>
          <summary>Can I choose the music?</summary>
          <p>Absolutely. Tell us your preference when you order or after you receive your video — a specific track, a genre, or no music at all — and we&rsquo;ll edit to it. If you plan to post on social media, we can use platform-safe music so your video won&rsquo;t be muted.</p>
        </details>
        <details>
          <summary>What exactly is included in the price?</summary>
          <p>Your complete cross country round — every fence, filmed by multiple cameras around the course and professionally edited into one continuous film. You can add your show jumping round at checkout. The video is yours to keep, download and share. <a href={href("/#samples")}>See a sample &rarr;</a></p>
        </details>
        <details>
          <summary>Do I need to book Equireel before my event?</summary>
          <p>No. If Equireel is at your event, <strong>every competitor at every fence is filmed automatically</strong>. Check the homepage or your country&rsquo;s event list — if your event is there, we have your round.</p>
        </details>
        <details>
          <summary>Can I buy a video as a gift?</summary>
          <p>Yes — gift vouchers are available, and you can also simply order any rider&rsquo;s video and have it delivered to their email. Owners and supporters do this all the time.</p>
        </details>
      </div>

      <Footer />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_SCHEMA) }} />
    </>
  );
}
