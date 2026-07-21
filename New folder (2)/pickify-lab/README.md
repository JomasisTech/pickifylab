# Pickify Lab

A premium, static skincare affiliate review site built with plain HTML5, CSS3, and vanilla JavaScript (ES6). No frameworks, no build step, no backend — ready to deploy to Vercel as-is. Includes a client-side admin dashboard for managing products without editing code.

## Live user journey

1. Visitor watches a short-form video (TikTok / Reels / YouTube Shorts).
2. They tap the link in bio and land on Pickify Lab.
3. They search for the product they just saw (real-time, no page reload).
4. They read an honest, structured review.
5. They tap through to Amazon via the affiliate button.

## Folder structure

```
pickify-lab/
├── index.html          Homepage — hero, real-time search, all product rails
├── about.html           Brand story, values, review process
├── categories.html      Full filterable + searchable product catalogue
├── contact.html         Validated contact form + social links
├── product.html         Data-driven product detail page (reads ?slug=)
├── admin.html            Admin dashboard — manage products/categories/settings
├── css/
│   ├── style.css         Design tokens, components, mobile-first base
│   ├── responsive.css    Tablet / desktop breakpoint overrides
│   └── admin.css         Admin dashboard-only styles
├── js/
│   ├── products.js       Product + category data (single source of truth)
│   ├── settings.js       Site-wide settings (social links, email, disclosure)
│   ├── search.js         Real-time search/scoring engine
│   ├── app.js             Nav, theme, card rendering, forms, page wiring
│   └── admin.js           Admin dashboard: auth, CRUD, import/export, toasts
├── images/               Add real product photography here
├── icons/                Reserved for any custom SVG icons
└── README.md
```

## Design system

- **Palette:** white background, light-gray alternate sections, blue (#0056FD) accent for interactive elements, brand-dark navy (#030C18) for headings and the footer — with a full dark-mode token set toggled via the moon/sun icon (persisted in `localStorage`).
- **Type:** Poppins for display/headings, Inter for body and UI text.
- **Signature element — the Match Ring:** a small radial indicator (a conic-gradient ring) on every card and product page showing how strongly a product matches Pickify Lab's review criteria — a quick-glance trust signal that goes beyond a plain star rating.
- **Category color system:** each of the 8 categories has a muted, packaging-inspired tint used only on product media placeholders, so browsing by category feels visually organized without the UI turning busy.

## Admin dashboard

Go to `admin.html` (there's a small "Admin" link in every page's footer). First visit prompts you to set a local username/password — **this is a soft, local-only gate, not real security**; credentials live in this browser's `localStorage`. Don't rely on it to protect sensitive data or use it on a shared device.

**What it does:** full product CRUD (add / edit / delete / duplicate / reorder / sort / search), a Categories overview, and Settings for social links, business email, and the affiliate disclosure text.

**How "publishing" works, since there's no backend:** everything you do in the admin saves to this browser's `localStorage` and previews live for you, in this browser, immediately. It does **not** appear for other visitors — there's no shared server for a static site to publish to. To make changes public:

1. In the admin, click **Export products.js** (or **Export settings.js**).
2. Replace the matching file in your project folder with the downloaded one.
3. Redeploy to Vercel (push to GitHub if it's connected, or re-upload the folder).

The **Import products.js** button does the reverse — point it at your currently-deployed file to load your whole live catalogue into the admin as a starting point, before making edits. Exporting always writes out the *complete* current catalogue (existing + edited + newly added, with deletions removed) — never just the newest item.

Each product row has up/down arrows that set its manual **display order** — this drives the default order shown on the Categories page and which items get sliced into the homepage rails (Featured / Trending / Best Seller / Recently Added), which are controlled per-product via checkboxes in the product form, independent of the single decorative **Badge** shown on the card (only one badge is ever shown per card).

"Discard local changes" clears the browser-local draft and reverts the admin's working copy back to whatever is in the currently deployed `products.js` / `settings.js`.

## Editing product data directly

All product content lives in `js/products.js` as a single array (`PICKIFY_PRODUCTS`). Every page (home, categories, product detail) renders from this file — add a new object to the array with a unique `id`, `slug`, and `order`, and it will automatically appear across the site, including in search. The admin dashboard is a UI on top of this same file; editing the file by hand and editing it through the admin (then exporting) both work.

## Adding real photography

Product cards and detail pages render a real `<img>` when a product has an `image` value (a URL, or a base64 data URI from the admin's upload field), and fall back to an icon placeholder (`product.icon`, category-tinted) otherwise. To add photography in bulk without the admin:
1. Add optimized images to `/images` (WebP recommended, ~800px wide for cards, ~1200px for detail pages).
2. Set `image: "images/your-file.webp"` on the relevant product object in `products.js`.

## Future scalability

The project is intentionally decoupled so it can migrate without a redesign:
- `PICKIFY_PRODUCTS` can be swapped for a `fetch()` call to a real API (e.g. FastAPI + PostgreSQL) with no change to the render functions in `app.js`. The admin dashboard's form/validation/table logic is already separated from its storage layer (`loadProducts`/`saveProducts` in `admin.js`), so swapping localStorage for real API calls there is a contained change too.
- Card, badge, and rating markup are generated by pure functions (`productCardMarkup`, `starsMarkup`, `matchRingMarkup`) — a React/Next.js migration can port these almost directly into components.
- CSS uses design tokens (CSS custom properties) rather than hard-coded values throughout, so the visual system transfers cleanly to any framework or a Tailwind config.

## Deployment

No build step required.

1. Push this folder to a GitHub repository (or drag-and-drop into Vercel).
2. In Vercel, import the repository/folder as a **static site** — no framework preset needed.
3. Deploy. `index.html` is served at the root automatically.

## Performance & SEO notes

- Semantic HTML5 landmarks (`header`, `main`, `footer`, `nav`, `article`) throughout.
- Meta title, description, canonical, Open Graph, and Twitter Card tags on every page.
- JSON-LD structured data: `Organization` sitewide, `Product` + `AggregateRating` injected per product page.
- All images use descriptive `aria-label`s on the placeholder containers; real `<img>` tags added per the section above should include descriptive `alt` text and `loading="lazy"` (both handled automatically for images added via the admin or the `image` field).
- Fonts and Font Awesome are loaded from CDN with `preconnect` hints; no unused JS frameworks are shipped.
- `admin.html` is marked `noindex, nofollow` so it doesn't appear in search results.
