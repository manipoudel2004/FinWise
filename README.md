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

### Option C: Wrangler Workers deploy (assets mode)

If your CI/CD runs `wrangler deploy` (Workers deploy), this repo now includes an `[assets]` section in `wrangler.toml` so static files are uploaded from the repo root:

```bash
npx wrangler deploy
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

## CI/CD troubleshooting

If your deploy logs stop right after the Wrangler banner (for example after `⛅️ wrangler ...`), the two most common causes are:

1. **Missing Cloudflare credentials in CI** (`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`).
2. **A future `compatibility_date`** in `wrangler.toml` relative to the runner timezone/date.

This repo pins `compatibility_date` to `2025-12-01` to avoid timezone-related "future date" failures in automated deploy environments.
