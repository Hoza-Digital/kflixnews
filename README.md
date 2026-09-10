# Kflixnews

A responsive publishing dashboard backed by a shared Supabase database.

## Run locally

Requirements: Node.js 22.13 or newer and pnpm 11.

```bash
pnpm install
cp .env.example .env
pnpm dev --hostname 127.0.0.1 --port 5556
```

Open `http://127.0.0.1:5556`.

## Shared database

Copy `.env.example` to `.env` to connect to the `kflixnews` Supabase project.
The example contains only the project URL and browser-safe publishable key.
Local environment files are ignored by Git. Configure the same two
`NEXT_PUBLIC_SUPABASE_*` variables in Vercel for deployments.

The admin dashboard currently uses mock authentication. Its existing policies
allow anonymous writes, including article edits and media deletion. User
management stores mock password hashes rather than secure credentials.
Use test data only until real authentication and restricted policies are added.
Never add account passwords, Supabase secrets, or service-role keys to this repository.

The matching schema migration is stored in `supabase/migrations/`.

## Commands

- `pnpm dev`: start the development server
- `pnpm build`: create and verify the production build
- `pnpm lint`: run ESLint
