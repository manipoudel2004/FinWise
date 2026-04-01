# FinWise

Static FinWise prototype site.

## Auth flow added

This project now includes a lightweight client-side auth module in `auth.js`:

- Email/password sign up and login.
- Google sign-in/sign-up integration using Google Identity Services.
- User profile/session persistence in `localStorage` (`finwise_users_v1` and `finwise_session_v1`).

## Configure Google sign-in

1. Create a Google OAuth web client in Google Cloud Console.
2. Add your local/dev origin (for example `http://localhost:5500`).
3. Copy the Client ID.
4. Paste it into `GOOGLE_CLIENT_ID` in:
   - `signup.html`
   - `login.html`

> Note: This is a front-end-only demo implementation. For production, move auth and data storage to a secure backend.
