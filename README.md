# FinWise (Cloudflare Pages-ready)

This project is now configured to run as a **static site on Cloudflare Pages**.

## What changed for Pages

- Added `wrangler.toml` with `pages_build_output_dir = "."` so Pages can deploy directly from this repo root.
- Added `_redirects` so routes like `/login`, `/signup`, and `/dashboard` resolve to their `.html` files, plus a catch-all fallback.
- Added `.gitignore` to avoid committing `node_modules` and local user data artifacts.

## Deploy on Cloudflare Pages

### Option A: Cloudflare Dashboard (recommended)

1. Push this repo to GitHub/GitLab.
2. In Cloudflare, go to **Workers & Pages → Create → Pages → Connect to Git**.
3. Select this repository.
4. Build settings:
   - **Framework preset:** None
   - **Build command:** *(leave empty)*
   - **Build output directory:** `.`
5. Deploy.

### Option B: Wrangler CLI

```bash
npx wrangler pages deploy .
```

## Local development

Because this is static-first, you can run any static server, for example:

```bash
npx serve .
```

or with Wrangler Pages emulation:

```bash
npx wrangler pages dev .
```

## Important auth note

Current auth in `auth.js` uses `localStorage` in the browser. That works on Cloudflare Pages, but user accounts are per-browser/per-device unless you later add a real backend (e.g., Cloudflare Workers + D1/KV/R2).
