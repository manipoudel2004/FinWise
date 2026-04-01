# FinWise

FinWise is now a **full-stack development website**:

- Front-end pages are still plain HTML/CSS/JS.
- A new Node.js/Express backend provides auth APIs, cookie sessions, and persistent user storage.

## Stack

- **Frontend:** static HTML pages + `auth.js`
- **Backend:** `express`, `jsonwebtoken`, `bcryptjs`, `cookie-parser`
- **Storage:** local JSON database at `data/users.json`

## Run locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start in dev mode:
   ```bash
   npm run dev
   ```
3. Open:
   - `http://localhost:3000`

## Backend API

- `GET /api/health` - backend status check
- `POST /api/auth/signup` - create account (email/password)
- `POST /api/auth/login` - login with email or username + password
- `POST /api/auth/google` - upsert Google profile and login
- `GET /api/auth/me` - fetch current authenticated user from cookie
- `POST /api/auth/logout` - clear auth cookie

## Environment variables

- `PORT` (default: `3000`)
- `JWT_SECRET` (default: `dev-only-change-me`; set a strong secret in real deployments)

## Google sign-in

Set your Google Client ID in:

- `signup.html`
- `login.html`

`auth.js` decodes the Google credential client-side and sends profile data to the backend.
