# STORY Dashboard

A responsive publishing dashboard backed by a shared Supabase database.

## Run locally

Requirements: Node.js 22.13 or newer and pnpm 11.

```bash
pnpm install
pnpm dev -- --hostname 127.0.0.1 --port 5555
```

Open `http://127.0.0.1:5555`.

## Shared database

The committed `.env` contains only the Supabase project URL and its safe
publishable key. Any clone of this repository therefore reads articles and
traffic data from the same `dashboard` Supabase project automatically.

Row-level security is enabled. Public clients can read dashboard data, create
articles, and upload cover images, but cannot edit or delete existing rows.
Add Supabase Auth before exposing the admin dashboard publicly. Never add a
Supabase secret or service-role key to this repository.

The matching schema migration is stored in `supabase/migrations/`.

## Commands

- `pnpm dev`: start the development server
- `pnpm build`: create and verify the production build
- `pnpm lint`: run ESLint
