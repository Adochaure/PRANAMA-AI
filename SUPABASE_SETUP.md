# Supabase setup

Pramana uses Supabase Postgres for saved analyses and their source metadata. The migration restricts each row to its authenticated owner with Row Level Security.

1. Create a Supabase project.
2. In **Project Settings → API**, copy the Project URL and the publishable key.
3. Add them to `pramana/.env.local` using `.env.example` as the template. Keep `.env.local` private; do not use a secret or service-role key in browser code.
4. In the Supabase SQL Editor, run `supabase/migrations/20261101000000_create_analyses.sql`.
5. Restart the Next.js development server after changing environment variables.

The browser and server clients are in `lib/supabase/`. Database reads and writes require a signed-in Supabase user. Authentication screens and analysis persistence still need to be connected in the app.
