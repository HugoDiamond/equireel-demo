import "./globals.css";
import { asset } from "../lib/eq";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://equireel.com";

export const metadata = {
  metadataBase: new URL(SITE),
  title: "Equireel — Every Rider. Every Fence.",
  description:
    "Professional cross country videos. Find your event, watch a sample and order your round — filmed at every fence, edited and delivered to your inbox.",
  openGraph: {
    type: "website",
    siteName: "Equireel",
    title: "Equireel — Every Rider. Every Fence.",
    description:
      "Professional cross country videos from UK, Irish, French and US eventing. Find your horse, watch a sample, order your round.",
    images: [{ url: "/assets/video/thumb-xc.jpg", width: 1280, height: 720, alt: "Equireel cross country video" }]
  },
  twitter: { card: "summary_large_image" }
};

/* who we are — for search engines and AI agents alike */
const ORG_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": SITE + "/#org",
      name: "Equireel",
      url: SITE,
      logo: SITE + "/assets/logo-camera.png",
      slogan: "Every Rider. Every Fence.",
      description:
        "Equine media company filming eventing cross country in the UK, Ireland, France and USA. Riders order professionally edited videos of their own round.",
      email: "info@equireel.com",
      sameAs: ["https://www.facebook.com/Equireel", "https://www.instagram.com/equireel_official/"]
    },
    {
      "@type": "WebSite",
      url: SITE,
      name: "Equireel",
      publisher: { "@id": SITE + "/#org" },
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: SITE + "/horses?name={search_term_string}" },
        "query-input": "required name=search_term_string"
      }
    }
  ]
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href={asset("/assets/favicon.png")} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <script type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_LD) }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
