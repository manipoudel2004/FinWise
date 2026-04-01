# FinWise (Cloudflare Workers + KV + Pages Assets)

FinWise now runs as a **real web app** on Cloudflare:

- Static HTML assets are served from Cloudflare Pages/Workers assets.
- Auth APIs run on Cloudflare Workers.
- User and session data are stored in Cloudflare KV (`USERS_KV`, `SESSIONS_KV`).

## Architecture

- Worker entrypoint: `src/index.ts`
- Front-end auth client: `auth.js`
- HTML pages stay static, but sign-up/sign-in now call server APIs:
  - `POST /api/auth/signup`
  - `POST /api/auth/login`
  - `POST /api/auth/google`
  - `GET /api/auth/me`
  - `POST /api/auth/logout`

## 1) Create KV namespaces

```bash
npx wrangler kv namespace create USERS_KV
npx wrangler kv namespace create USERS_KV --preview
npx wrangler kv namespace create SESSIONS_KV
npx wrangler kv namespace create SESSIONS_KV --preview
```

Copy the returned IDs into `wrangler.toml`.

## 2) Configure `wrangler.toml`

This repo includes bindings:

- `USERS_KV`
- `SESSIONS_KV`

Replace placeholder IDs:

- `YOUR_USERS_KV_NAMESPACE_ID`
- `YOUR_USERS_KV_PREVIEW_NAMESPACE_ID`
- `YOUR_SESSIONS_KV_NAMESPACE_ID`
- `YOUR_SESSIONS_KV_PREVIEW_NAMESPACE_ID`

## 3) Deploy

```bash
npx wrangler deploy
```

## Local development

```bash
npx wrangler dev
```

Then open the local URL and test signup/login.

## Security note

- Passwords are hashed before storing in KV.
- Sessions are stored server-side and referenced by an HttpOnly cookie.
- Google sign-in still requires setting a valid Google Client ID in `login.html` and `signup.html`.
