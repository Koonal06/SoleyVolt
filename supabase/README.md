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

The function auth model is declared in [supabase/config.toml](c:/Users/koona/Downloads/SoleyVolt/supabase/config.toml). The `server` function uses `verify_jwt = false` because it performs its own bearer-token verification inside the function with `requireUser(...)`. This avoids gateway-level `401` failures when the frontend uses publishable keys and keeps auth behavior consistent across user, admin, and super admin dashboards.

## Frontend env

The React app uses:

```env
VITE_SUPABASE_URL=https://itaykvdfwqfoatqchyzs.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_SERVER_API_BASE_URL=https://itaykvdfwqfoatqchyzs.supabase.co/functions/v1/server/api
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
9. Run `supabase/migrations/20260327_legacy_logic_fields.sql` to store the legacy CEB-style yellow/red/green calculation outputs.
10. Run `supabase/migrations/20260327_dataset_mapping_and_admin_view.sql` to enable admin mapping of dataset users to real profiles.

Option 2: Supabase CLI

If you later install/configure the CLI, this file is already organized like a migration.

## Edge Function env

The backend function expects these server-side values:

```env
SUPABASE_URL=https://itaykvdfwqfoatqchyzs.supabase.co
SUPABASE_PUBLISHABLE_KEY=...   # preferred
SUPABASE_ANON_KEY=...          # supported for legacy setups
SUPABASE_SERVICE_ROLE_KEY=...
```

See `.env.server.example` for the template.

## Deploy the function fix

After updating `supabase/config.toml`, redeploy the Edge Function so Supabase applies the auth-mode change:

```bash
supabase functions deploy server
```

If you set secrets through the CLI, make sure the deployed function has either `SUPABASE_PUBLISHABLE_KEY` or `SUPABASE_ANON_KEY`, plus `SUPABASE_SERVICE_ROLE_KEY`.

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
- Preserves legacy CEB-style logic outputs such as yellow tokens, red deficit, green cap, and settlement-required kWh
- Adds dataset-user mapping and an admin-facing import view so imported rows can be linked to real profiles before promotion

## Recommended next app wiring

- Dashboard: read from `wallets`, `wallet_transactions`, and `energy_readings`
- User portal summary: read from `user_portal_summary`
- Wallet: read `wallets` and `wallet_transactions`
- Bill and offsets: read `user_portal_summary`, `coin_settings`, and `green_coin_purchases`
- Transfer: search `public_user_directory`, call `transfer_tokens`
- Settings: update `profiles` and `user_settings`
- Admin: read `admin_overview`, `user_wallet_summary`, `green_coin_purchases`, `coin_settings`, and recent `wallet_transactions`

## Python Calculation Pipeline

Use [energy_pipeline.py](c:/Users/koona/Downloads/SoleyVolt/scripts/energy_pipeline.py) to process rows from `energy_readings_import` into `energy_calculations`.

Expected env:

```env
SUPABASE_URL=https://itaykvdfwqfoatqchyzs.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
ENERGY_CALCULATION_VERSION=python-v1
ENERGY_BILLING_ANCHOR_DATE=2026-01-01
```

Example usage:

```bash
python scripts/energy_pipeline.py --dry-run --anchor-date 2026-01-01
python scripts/energy_pipeline.py --anchor-date 2026-01-01
python scripts/energy_pipeline.py --anchor-date 2026-01-01 --promote
```

## Keeping the Python logic alive

The repo now includes a scheduled GitHub Actions workflow at [.github/workflows/energy-pipeline.yml](c:/Users/koona/Downloads/SoleyVolt/.github/workflows/energy-pipeline.yml).

Set these GitHub repository secrets before enabling it:

```env
SUPABASE_URL=https://itaykvdfwqfoatqchyzs.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

Optional GitHub repository variables:

```env
ENERGY_CALCULATION_VERSION=python-v1
ENERGY_BILLING_ANCHOR_DATE=2026-01-01
```

What it does:

- Runs the Python legacy CEB logic every hour
- Processes `pending` and `failed` imported rows
- Promotes linked rows into live `energy_readings`
- Writes pipeline run status when `energy_pipeline_runs` exists

What the script does:

- Reads `pending` or `failed` rows from `energy_readings_import`
- Ports the legacy Python CEB logic onto the current Supabase schema
- Stores versioned outputs in `energy_calculations`
- Updates `energy_readings_import` with calculation fields and processing state
- Optionally promotes mapped rows into `energy_readings` when `linked_user_id` and a usable reading date are available

Current legacy formulas:

- `yellow_tokens = max(exported_kwh - imported_kwh, 0)`
- `red_tokens = max(imported_kwh - exported_kwh, 0)`
- `green_cap_kwh = average(last_3_imported_kwh_including_current_cycle) / 2`
- `estimated_bill = max(red_tokens - green_purchased_kwh, 0) * red_coin_rate`
