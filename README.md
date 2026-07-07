# Equireel — website (Next.js)

The new Equireel ordering site, built with **Next.js** (App Router, static
export). Pixel-identical port of the hand-built prototype, ready to grow into
the database-backed phase 2.

## Run it locally

```
cd "C:\Users\Equireel 1\Documents\Website"
npm run demo        # dev server on http://localhost:8734
```

Or double-click **Start Equireel demo.bat** (starts the server and opens the
browser).

## Structure

| Path | What |
|---|---|
| `app/` | Pages: `/` home, `/events?country=`, `/event?id=`, `/faq` |
| `app/globals.css` | The design system (ported verbatim from the prototype) |
| `components/Chrome.jsx` | Header (with global search overlay) and footer |
| `lib/eq.js` | Data + helpers: events, entries, search, pricing, purchases |
| `lib/player.js` | Video player: free clip → paywall → checkout |
| `public/assets/` | Logos, hero media, sample videos |

## Deployment

Push to `main` → GitHub Actions builds (`BASE_PATH=/equireel-demo npm run
build`) and publishes the static export to GitHub Pages:
https://hugodiamond.github.io/equireel-demo/

## Phase 2 path

- Swap `lib/eq.js` mock data for API/database calls (the events + results
  tables in the Equireel PostgreSQL DB).
- Turn `/event?id=` into `/event/[slug]` server-rendered pages (drop
  `output: "export"`, host on Vercel/Node) for shareable, indexable URLs —
  same components, different data source.
- Real Stripe in `lib/player.js`'s checkout, magic-link accounts, per-horse
  profile pages.
