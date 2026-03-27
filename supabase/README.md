# Supabase Setup

This project now includes a production-oriented starter schema for:

- `profiles`
- `user_settings`
- `wallets`
- `wallet_transactions`
- `energy_readings`
- `energy_readings_import`
- `energy_calculations`
- `notifications`
- `coin_settings`
- `green_coin_purchases`
- `user_portal_summary` view
- `user_wallet_summary` view
- `admin_overview` view
- `transfer_tokens(...)` RPC
- `record_energy_reading(...)` RPC
- `purchase_green_coins(...)` RPC
- `public_user_directory` view

This repo also now includes a backend Edge Function in `supabase/functions/server/` with authenticated routes for profile, wallet, settings, transfers, energy submission, user search, and admin overview access.

## Frontend env

The React app uses:

```env
VITE_SUPABASE_URL=https://itaykvdfwqfoatqchyzs.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

These belong in the repo root `.env`.

## Server-only secrets

Do not put these in the frontend `.env`:

- Postgres direct connection string
- Supabase service role key

Those are only for trusted backend/server use.

## Apply the schema

Option 1: Supabase SQL Editor

1. Open your Supabase dashboard.
2. Go to SQL Editor.
3. Run `supabase/migrations/20260326_initial_schema.sql`.
4. Run `supabase/migrations/20260326_public_directory_and_grants.sql`.
5. Run `supabase/migrations/20260326_role_segmentation_and_coin_views.sql`.
6. Run `supabase/migrations/20260326_signup_user_type_sync.sql`.
7. Run `supabase/migrations/20260327_energy_readings_import_dataset.sql` to load the SustainX dataset into a raw import table.
8. Run `supabase/migrations/20260327_schema_hardening_and_calculations.sql` to add calculation-ready fields, normalize foreign keys, and harden RLS/indexing.

Option 2: Supabase CLI

If you later install/configure the CLI, this file is already organized like a migration.

## Edge Function env

The backend function expects these server-side values:

```env
SUPABASE_URL=https://itaykvdfwqfoatqchyzs.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

See `.env.server.example` for the template.

## First admin user

After you sign up your first real user:

1. Copy that user's UUID from `auth.users`.
2. Open `supabase/seed.sql`.
3. Replace `00000000-0000-0000-0000-000000000000` with the real UUID.
4. Run the seed script in SQL Editor.

## What the schema does

- Automatically creates `profiles`, `user_settings`, and `wallets` rows when a new auth user signs up
- Protects user data with RLS
- Allows users to read/update only their own data
- Allows admins to read across the system
- Uses SQL functions for transfers and energy reward minting so wallet logic stays consistent
- Exposes a limited user directory for transfer search without opening full profile data
- Stores raw external dataset rows in `energy_readings_import` until they are mapped to real app users and promoted into `energy_readings`
- Stores Python or backend calculation results in `energy_calculations`, with versioning and structured result payloads

## Recommended next app wiring

- Dashboard: read from `wallets`, `wallet_transactions`, and `energy_readings`
- User portal summary: read from `user_portal_summary`
- Wallet: read `wallets` and `wallet_transactions`
- Bill and offsets: read `user_portal_summary`, `coin_settings`, and `green_coin_purchases`
- Transfer: search `public_user_directory`, call `transfer_tokens`
- Settings: update `profiles` and `user_settings`
- Admin: read `admin_overview`, `user_wallet_summary`, `green_coin_purchases`, `coin_settings`, and recent `wallet_transactions`
