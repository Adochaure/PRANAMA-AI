# Supabase setup

Pramana uses Supabase Postgres for saved analyses and their source metadata. The migration restricts each row to its authenticated owner with Row Level Security.

1. Create a Supabase project.
2. In **Project Settings → API**, copy the Project URL and the publishable key.
3. Add them to `pramana/.env.local` using `.env.example` as the template. Keep `.env.local` private; do not use a secret or service-role key in browser code.
4. In the Supabase SQL Editor, run `supabase/migrations/20261101000000_create_analyses.sql`.
5. In **Authentication → URL Configuration**, add `http://localhost:3000/auth/callback` as a redirect URL. Add the deployed callback URL when deploying.
6. To enable Google sign-in, configure a Google OAuth Web client, then add its client ID and secret under **Authentication → Providers → Google**. Add the Supabase callback URL shown in the Google provider settings to the Google OAuth client's authorized redirect URIs.
7. If you are using Supabase as an OAuth 2.1 identity provider, enable **Authentication → OAuth Server** and set its authorization path to `/oauth/consent`. Pramana implements the consent screen at that route and returns the user to sign-in with the original authorization request preserved.
8. Restart the Next.js development server after changing environment variables.

The browser and server clients are in `lib/supabase/`. The dashboard uses Google sign-in at `/login`, and authenticated users can save and reopen analysis questions and their source metadata. Row Level Security restricts each account to its own records. Analysis generation and result saving will connect when the analysis pipeline is implemented.

## Google sign-in troubleshooting

- Configure Google under **Authentication → Sign In / Providers → Supabase Auth → Google**. **Third-Party Auth** is for identity platforms such as Auth0 and Clerk; it does not enable Google sign-in.
- If the callback contains `error=server_error` and `Unable to exchange external code`, check that the Google Web client ID and secret in Supabase come from the same OAuth client, and that the Google client's authorized redirect URI exactly matches the Supabase callback URL shown on the Google provider settings page.
- The app callback, such as `http://localhost:3000/auth/callback`, belongs in Supabase **URL Configuration → Redirect URLs**. It is different from Google's authorized redirect URI.
