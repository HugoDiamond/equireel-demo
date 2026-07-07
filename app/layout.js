import "./globals.css";
import { asset } from "../lib/eq";

export const metadata = {
  title: "Equireel — Every Rider. Every Fence.",
  description:
    "Professional cross country videos. Find your event, watch a sample and order your round — filmed at every fence, edited and delivered to your inbox."
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
      </head>
      <body>{children}</body>
    </html>
  );
}
