# SoleyVolt System Documentation

## 1. Document purpose

This document is a report-style technical documentation of the SoleyVolt system based on the current repository structure, frontend code, Supabase schema and migrations, Edge Functions, automation scripts, and deployment helpers present in this codebase.

It is intended to support:

- academic report submission
- project handover
- technical review
- system maintenance
- onboarding of future developers or administrators

This document reflects the repository state inspected on 2026-03-28.

## 2. System overview

SoleyVolt is a role-based solar energy and token management platform built for Mauritius-oriented energy workflows. The platform combines:

- a public website and application onboarding flow
- a secure user portal
- a secure admin portal
- a secure super-admin portal
- Supabase authentication and database services
- Supabase Edge Functions for protected server logic
- SQL-based business logic and row-level security
- a backend energy calculation pipeline
- token and settlement workflows for yellow, red, and green energy credits

At a business level, the system converts energy activity into tracked digital balances and operational records. It supports controlled onboarding, user account governance, energy dataset imports, wallet tracking, token accounting, and monthly settlement logic.

## 3. Main business objectives

The current system is designed to solve the following problems:

1. provide a controlled way for public users to request access instead of open signup
2. allow staff to review, approve, or reject applications
3. create user accounts only after staff validation
4. maintain role-based access for users, admins, and super admins
5. store wallet balances and transaction history
6. track imported and exported energy readings
7. transform imported energy data into yellow and red token outcomes
8. support green token purchases and settlement against red debt
9. provide operational dashboards for users and staff
10. keep sensitive logic on the backend through Supabase SQL and Edge Functions

## 4. High-level architecture

The application follows a layered architecture.

### 4.1 Presentation layer

The frontend is a React application built with Vite and styled with Tailwind CSS plus component utilities. It contains:

- public landing and application pages
- authentication pages
- user portal pages
- admin portal pages
- super-admin portal pages

### 4.2 Application layer

The frontend application logic includes:

- route protection
- role-based navigation
- auth session and profile loading
- client-side data requests to Supabase
- client-side requests to the protected server Edge Function
- live green coin price presentation

### 4.3 Backend service layer

The backend logic is split between:

- Supabase database tables, views, triggers, and SQL functions
- Supabase Edge Function `server` implemented with Hono
- Supabase Edge Function `send-email` for mail delivery integration
- Python and TypeScript implementations of the energy pipeline and token engine logic

### 4.4 Data layer

Supabase PostgreSQL is the main data store. It manages:

- authentication-linked profiles
- user settings
- wallets and transactions
- notifications
- energy readings
- imported external dataset rows
- calculation outputs
- application onboarding records
- pipeline run logs
- mapping tables and audit logs

### 4.5 Security layer

Security is handled through:

- Supabase Auth
- row-level security on core tables
- profile-driven RBAC
- guarded profile updates
- Edge Function authorization checks
- separation of publishable keys and service-role keys

## 5. Technology stack

### 5.1 Frontend stack

- React 18
- React Router 7
- Vite 6
- Tailwind CSS 4
- Radix UI components
- Lucide React icons
- Recharts for charts
- Sonner for notifications

### 5.2 Backend stack

- Supabase PostgreSQL
- Supabase Auth
- Supabase Realtime for `coin_settings`
- Supabase Edge Functions
- Hono for HTTP routing in the server function
- Postmark integration for outbound email

### 5.3 Scripting and automation

- Python 3 scripts for energy pipeline processing
- PowerShell deployment utilities
- GitHub Actions scheduled pipeline job

## 6. Repository structure

Key top-level directories and files:

- `src/`: React frontend application
- `public/`: static assets, icons, manifest
- `supabase/`: migrations, seed file, config, Edge Functions
- `scripts/`: Python and PowerShell operational scripts
- `utils/`: Supabase helper files and SMTP configuration helper
- `.github/workflows/`: automation workflows
- `.env.example`: frontend environment template
- `.env.server.example`: backend environment template

## 7. Frontend architecture

### 7.1 App bootstrap

The frontend starts in `src/app/App.tsx` and wraps the router with:

- `AuthProvider`
- `RouterProvider`
- `Toaster`
- `SoleyVoltAssistant`

### 7.2 Authentication provider

`AuthProvider` is responsible for:

- reading the current Supabase session
- tracking the authenticated user
- loading the linked profile from `profiles`
- caching profile results per user
- exposing admin and super-admin flags
- exposing the default route for the active role

### 7.3 Route protection model

The route system uses the following guards:

- `ProtectedRoute`: requires an authenticated session
- `PublicOnlyRoute`: blocks login pages for already signed-in users
- `UserRoute`: only allows role `user`
- `AdminRoute`: only allows role `admin`
- `SuperAdminRoute`: only allows role `superadmin`

The route layer also blocks access when:

- Supabase env variables are missing
- profile loading fails
- the profile status is not active

### 7.4 Current route map

#### Public routes

- `/`: landing page
- `/apply`: public onboarding/application page
- `/auth/reset`: password reset page
- `/login`: user login
- `/admin/login`: admin login
- `/super-admin/login`: super-admin login

#### User portal routes

- `/app/dashboard`
- `/app/wallet`
- `/app/bill`
- `/app/history`
- `/app/settings`

#### Admin portal routes

- `/admin/dashboard`
- `/admin/applications`
- `/admin/users`
- `/admin/readings`
- `/admin/wallets`
- `/admin/bills`
- `/admin/logs`
- `/admin/settings`

#### Super-admin portal routes

- `/super-admin/dashboard`
- `/super-admin/admins`
- `/super-admin/users`
- `/super-admin/applications`
- `/super-admin/system`
- `/super-admin/logs`
- `/super-admin/settings`

### 7.5 UI portals

#### User portal

The user portal is built for normal platform users and adapts its copy based on user type:

- consumer
- producer
- prosumer

The layout includes:

- dashboard
- wallet
- bill or settlement view
- transaction history
- profile/settings

#### Admin portal

The admin portal is a staff control surface for:

- system overview
- controlled application review
- user monitoring
- imported energy data monitoring
- wallet and bill monitoring
- logs and settings

#### Super-admin portal

The super-admin portal is the highest governance layer for:

- admin account management
- access governance
- system-wide visibility
- user oversight
- application visibility
- system settings and logs

## 8. Functional modules

### 8.1 Public website module

The landing page is a presentation layer for the platform. It includes:

- multilingual presentation in English, French, and Creole
- product narrative and FAQ
- contact-style form state
- call-to-action links to apply and sign in
- live green coin market preview

The green coin market widget reads the current coin setting and applies a Mauritius-time-based multiplier to show a live-looking market signal.

### 8.2 Controlled onboarding module

Instead of public account creation, the system uses a regulated onboarding flow.

The public application form collects:

- full name
- NIC
- email
- phone
- address
- preferred language
- applicant type
- optional notes

Validation highlights:

- NIC must be exactly 14 alphanumeric characters
- email must be valid
- duplicate pending applications by email or NIC are rejected
- an existing profile with the same email blocks reapplication

### 8.3 Authentication module

There are separate sign-in pages for:

- users
- admins
- super admins

Authentication is backed by Supabase Auth. After sign-in, the system reads the corresponding `profiles` row and redirects the user to the role-appropriate portal.

Password reset is handled through:

- `supabase.auth.resetPasswordForEmail(...)`
- redirect to `/auth/reset`
- password update via `supabase.auth.updateUser(...)`

### 8.4 User dashboard module

The user dashboard displays:

- energy totals
- yellow, red, and green token context
- wallet balance
- bill estimate
- latest transactions
- latest energy readings
- a chart of import/export trends

The dashboard behavior is personalized by `user_type`:

- consumers see import-heavy and liability-oriented metrics
- producers see export and earned-credit metrics
- prosumers see mixed net-energy metrics

### 8.5 Wallet and transaction module

The wallet page displays:

- combined balance
- lifetime earned
- lifetime spent
- yellow token balance
- red token balance
- green token balance
- detailed transaction history

The balance displayed to users is derived as:

`yellow_token + green_token - red_token`

The transaction history shows:

- earn
- send
- receive
- adjustment

Additional enriched transaction history is available through the server API to collapse mirror rows and present direction-sensitive records.

### 8.6 Bill and settlement module

The system supports bill estimation and monthly settlement logic.

Core concepts:

- red tokens represent energy deficit / consumption obligation
- yellow tokens represent surplus export rewards
- green tokens represent purchased bill-offset credits

The bill estimate exposed in summary views is based on:

`(imported_kwh * red_coin_rate) - (green_coins * green_coin_bill_offset_rate) - (yellow_coins * yellow_coin_bill_offset_rate)`

The value is floored at zero.

Monthly settlement consumes green tokens against red debt and creates an automatic wallet transaction entry.

### 8.7 Application review module

Admins and super admins can:

- list submitted applications
- search by name, NIC, or email
- filter by status
- mark an application under review
- reject an application with a reason
- approve an application and create a real user account

Approval also:

- creates a Supabase Auth user
- upserts the linked profile
- updates application status to approved
- links the application to the created profile
- logs audit events
- optionally sends a password setup email

### 8.8 User management module

The user management page allows staff to:

- inspect active user accounts
- review balances and energy totals
- send password reset links

Super admins additionally can:

- directly provision user accounts as controlled exceptions

### 8.9 Admin governance module

Super admins can create and monitor admin accounts. Admin creation sets app metadata so the created account can access the admin portal but not the super-admin portal.

### 8.10 Energy import and pipeline module

This is one of the most important system modules.

The module supports:

- storage of raw imported external dataset rows
- linking dataset user codes to real SoleyVolt profiles
- running monthly legacy calculations
- storing versioned calculation outputs
- promoting results into live `energy_readings`
- reconciling wallet token balances after promotion
- logging pipeline runs

The admin UI exposes:

- imported row counts
- mapped vs unmapped profiles
- last pipeline run status
- dataset-to-profile mapping controls
- row-level calculated outcomes and statuses

### 8.11 Coin settings and green market module

Admins can configure:

- green coin base price
- red coin conversion factor
- yellow coin conversion factor
- yellow coin bill offset factor
- green coin bill offset factor

The landing page and admin settings page both use the green market logic, which simulates a live price using the Mauritius market clock and cosine/sine-based variation.

### 8.12 Notification and audit module

Notifications are used to record operational events such as:

- application approval
- user creation
- admin creation
- password reset actions

Additional audit coverage exists in:

- `user_application_events`
- `wallet_audit_log`
- `energy_pipeline_runs`
- transaction metadata inside `wallet_transactions`

## 9. Roles and access model

### 9.1 Roles

The system currently defines three roles:

- `user`
- `admin`
- `superadmin`

### 9.2 Status model

Profiles can have:

- `active`
- `inactive`
- `suspended`

Only active accounts should be allowed to use protected workflows.

### 9.3 User types

For platform behavior and reporting, users can be:

- `consumer`
- `producer`
- `prosumer`

### 9.4 RBAC rules

The system enforces a hierarchy:

- superadmin can manage all profiles
- admin can manage normal user profiles but not super admins
- user can only manage safe fields on their own profile

Protected profile fields for normal users include:

- role
- user_type
- status
- created_by

Email changes are not written directly to `profiles`; they are synced from `auth.users`.

## 10. Database design

The database is built around authentication-linked user records, wallets, energy data, and controlled operational flows.

### 10.1 Core tables

#### `profiles`

Purpose:

- main application identity record linked to `auth.users`

Important columns:

- `id`
- `email`
- `full_name`
- `phone`
- `language`
- `role`
- `user_type`
- `status`
- `avatar_url`
- `created_by`
- `created_at`
- `updated_at`

Key behavior:

- created automatically on new auth user creation
- protected by strict RLS and update guards

#### `user_settings`

Purpose:

- per-user notification and security preferences

Important columns:

- `email_notifications`
- `push_notifications`
- `transaction_alerts`
- `mfa_enabled`

#### `wallets`

Purpose:

- stores user token balances and cumulative wallet statistics

Important columns:

- `balance`
- `lifetime_earned`
- `lifetime_spent`
- `yellow_token`
- `red_token`
- `green_token`
- `updated_at`

Notes:

- legacy single-balance logic has evolved into separated yellow/red/green token balances
- combined balance is still maintained and also derivable

#### `wallet_transactions`

Purpose:

- ledger of wallet activity

Important columns:

- `user_id`
- `counterparty_user_id`
- `transaction_type`
- `amount`
- `description`
- `status`
- `metadata`
- `created_at`

Transaction types:

- `earn`
- `send`
- `receive`
- `adjustment`

#### `energy_readings`

Purpose:

- live user-facing energy reading table after promotion

Important columns:

- `user_id`
- `reading_date`
- `imported_kwh`
- `exported_kwh`
- `tokens_earned`
- `notes`

#### `notifications`

Purpose:

- user-facing or staff-facing operational messages

Important columns:

- `notification_type`
- `title`
- `message`
- `is_read`
- `created_at`

#### `coin_settings`

Purpose:

- global platform pricing and conversion settings

Important columns:

- `red_coin_rate`
- `yellow_coin_rate`
- `yellow_coin_bill_offset_rate`
- `green_coin_unit_price`
- `green_coin_bill_offset_rate`
- `updated_at`

#### `green_coin_purchases`

Purpose:

- records completed green coin purchases

Important columns:

- `user_id`
- `green_coins`
- `unit_price`
- `total_cost`
- `status`
- `payment_reference`
- `created_at`

#### `user_applications`

Purpose:

- regulated onboarding requests submitted from the public website

Important columns:

- `full_name`
- `nic`
- `email`
- `phone`
- `address`
- `preferred_language`
- `requested_user_type`
- `notes`
- `status`
- `submitted_at`
- `reviewed_at`
- `reviewed_by`
- `rejection_reason`
- `linked_profile_id`

#### `user_application_events`

Purpose:

- audit trail for application lifecycle

Supported actions:

- `submitted`
- `under_review`
- `approved`
- `rejected`
- `account_created`
- `note`

#### `energy_readings_import`

Purpose:

- raw imported energy dataset rows before promotion

Important columns:

- `source_file_name`
- `dataset_user_code`
- `dataset_user_type`
- `meter_id`
- `billing_cycle`
- `reading_date`
- `period_start`
- `period_end`
- `imported_kwh`
- `exported_kwh`
- `linked_user_id`
- `processing_status`
- `calculation_version`
- `net_kwh`
- `tokens_earned`
- `yellow_tokens`
- `red_tokens`
- `green_cap_kwh`
- `green_purchased_kwh`
- `remaining_green_cap_kwh`
- `settlement_required_kwh`
- `estimated_bill`
- `processing_error`
- `calculated_at`
- `promoted_at`

Processing states:

- `pending`
- `processing`
- `calculated`
- `promoted`
- `failed`

#### `energy_calculations`

Purpose:

- versioned storage of monthly energy calculations

Important columns:

- `import_id`
- `linked_user_id`
- `calculation_version`
- `logic_name`
- `net_kwh`
- `tokens_earned`
- `estimated_bill`
- `reward_tier`
- `yellow_tokens`
- `red_tokens`
- `green_cap_kwh`
- `green_purchased_kwh`
- `remaining_green_cap_kwh`
- `settlement_required_kwh`
- `result_payload`
- `calculated_at`

#### `dataset_user_mappings`

Purpose:

- connects raw external dataset user codes to actual platform profiles

Important columns:

- `dataset_user_code`
- `dataset_user_type`
- `linked_user_id`
- `source_file_name`
- `notes`
- `created_at`
- `updated_at`

#### `energy_pipeline_runs`

Purpose:

- log table for energy pipeline execution

Important columns:

- `trigger_source`
- `status`
- `calculation_version`
- `rows_considered`
- `processed_count`
- `failed_count`
- `promoted_count`
- `statuses_filter`
- `promote`
- `dry_run`
- `anchor_date`
- `started_at`
- `completed_at`
- `error_summary`
- `metadata`

#### `wallet_audit_log`

Purpose:

- tracks token reconciliation per imported calculation row

Important columns:

- `user_id`
- `import_id`
- `yellow_delta`
- `red_delta`
- `green_delta`
- `source`
- `metadata`
- `created_at`
- `updated_at`

#### `green_purchase_requests`

Purpose:

- future or partially implemented workflow for request-based P2P green token purchases

Status values:

- `pending`
- `accepted`
- `rejected`
- `expired`
- `completed`

Important note:

- this table exists in the schema but is not part of the main currently exposed frontend flow

### 10.2 Views

#### `user_portal_summary`

Purpose:

- aggregate user-facing summary for dashboard and bill modules

Includes:

- total imported/exported energy
- net energy
- red/yellow/green totals
- green total cost
- bill estimate
- derived balance

#### `user_wallet_summary`

Purpose:

- admin-friendly wallet and summary view across users

#### `admin_overview`

Purpose:

- system-wide aggregates for admin dashboard

Includes:

- total users
- total tokens
- total imported energy
- total exported energy
- total red coins
- total yellow coins
- total green coins

#### `public_user_directory`

Purpose:

- limited searchable public directory for transfer-related user lookup

Only exposes:

- `id`
- `full_name`
- `avatar_url`

#### `energy_import_admin_view`

Purpose:

- joins imported energy rows with linked profile details for admin review

### 10.3 Triggers

Important triggers include:

- profile `updated_at` maintenance
- user settings `updated_at` maintenance
- wallet `updated_at` maintenance
- coin settings `updated_at` maintenance
- auth user creation to bootstrap profile, settings, and wallet rows
- auth email update sync into `profiles`
- profile update guard trigger
- dataset mapping `updated_at` trigger
- wallet audit log `updated_at` trigger

### 10.4 RLS and security posture

The schema enables RLS on critical tables and applies policies so that:

- users can read or update only their own allowed records
- admins can read broader system data where authorized
- super admins have wider control over profile governance
- some operational tables are fully blocked from direct client access and must be accessed through the server function

Examples of restricted direct-access tables:

- `user_applications`
- `user_application_events`

These are intentionally exposed only through trusted server logic.

## 11. SQL functions and business logic

### 11.1 Identity and role helper functions

- `current_profile_role(...)`
- `is_admin(...)`
- `is_superadmin(...)`
- `is_super_admin(...)`

These functions ensure authorization decisions come from server-side profile data, not client-provided role claims.

### 11.2 User bootstrap functions

- `handle_new_user()`
- `handle_auth_user_email_update()`

These keep `profiles`, `user_settings`, and `wallets` aligned with authentication records.

### 11.3 Wallet and energy functions

- `transfer_tokens(receiver_id, transfer_amount, transfer_description)`
- `record_energy_reading(target_date, imported, exported, notes_input)`
- `purchase_green_coins(purchase_amount, payment_reference_input)`

### 11.4 Dataset mapping function

- `apply_dataset_user_mapping(...)`

This function:

- stores the mapping in `dataset_user_mappings`
- updates `energy_readings_import.linked_user_id`
- updates existing `energy_calculations.linked_user_id`

### 11.5 Green market functions

- `green_coin_live_multiplier(target_ts)`
- `green_coin_live_price(target_ts)`

These implement the public live-price simulation based on Mauritius local time.

### 11.6 P2P and settlement functions

- `ensure_wallet_exists(target_user_id)`
- `purchase_green_tokens_p2p(seller_id, amount_rs)`
- `process_end_of_month_settlement(target_user_id, settlement_month)`
- `process_all_users_end_of_month(settlement_month)`
- `get_user_transaction_history(target_user_id, filter_token_type, limit_count)`

These support:

- buyer/seller green token exchange
- monthly settlement against red debt
- batch settlement across all users
- enriched transaction history

## 12. Token and energy logic

### 12.1 Token model

The system uses three token concepts.

#### Yellow tokens

- represent surplus export value
- are earned when export exceeds import
- are used as the seller-side source in the P2P green purchase flow

#### Red tokens

- represent deficit / obligation created by import-heavy usage
- are used to estimate bill liability
- can be reduced by monthly green settlement

#### Green tokens

- represent purchased bill-offset capacity
- can be bought directly or received through the P2P flow
- are consumed during end-of-month settlement against red debt

### 12.2 Core formulas

The legacy energy calculation logic currently uses:

- `yellow_tokens = max(exported_kwh - imported_kwh, 0)`
- `red_tokens = max(imported_kwh - exported_kwh, 0)`
- `green_cap_kwh = average(last_3_imported_kwh_including_current_cycle) / 2`
- `settlement_required_kwh = max(red_tokens - green_purchased_kwh, 0)`
- `estimated_bill = max(red_tokens - green_purchased_kwh, 0) * red_coin_rate`

### 12.3 P2P green purchase logic

The implemented green purchase flow uses the following assumptions:

- 1 yellow token = Rs 1
- green tokens received = `amount_rs / 2`

Purchase validation includes:

- buyer and seller must both exist
- buyer and seller must be different
- seller must have enough yellow tokens
- buyer must have a linked meter
- buyer monthly green purchase total must not exceed the green cap

### 12.4 Monthly settlement logic

End-of-month settlement:

- reads the user wallet
- checks red and green balances
- uses `min(red_token, green_token)` as the settlement quantity
- decreases both red and green by that quantity
- records a wallet adjustment transaction

## 13. Server API documentation

The main protected backend API is implemented in the `server` Edge Function. It authenticates requests by verifying bearer tokens itself because the function is configured with `verify_jwt = false` and performs manual auth inside the function.

### 13.1 Public endpoints

- `GET /server/health`
  - health check

- `GET /server/public/coin-settings`
  - returns public coin settings for frontend market display

- `POST /server/public/applications`
  - submits a public onboarding request

### 13.2 Authenticated user endpoints

- `GET /server/api/me`
  - consolidated profile, settings, wallet, transactions, and energy data

- `GET /server/api/profile`
- `PATCH /server/api/profile`

- `GET /server/api/settings`
- `PATCH /server/api/settings`

- `GET /server/api/wallet`

- `GET /server/api/users/search`

- `POST /server/api/transfer`

- `POST /server/api/energy`

- `POST /server/api/green-tokens/purchase`

- `POST /server/api/green-tokens/settlement`

- `GET /server/api/transactions/history`

### 13.3 Admin and super-admin endpoints

- `GET /server/api/admin/overview`
- `GET /server/api/admin/applications`
- `POST /server/api/admin/applications/:applicationId/status`
- `POST /server/api/admin/applications/:applicationId/approve`
- `GET /server/api/admin/energy-pipeline`
- `POST /server/api/admin/energy-pipeline/run`
- `POST /server/api/admin/energy-pipeline/mappings/:datasetUserCode`
- `POST /server/api/admin/users`
- `POST /server/api/admin/users/:userId/password-reset`
- `POST /server/api/admin/green-tokens/settlement-all`

### 13.4 Super-admin-specific endpoints

- `GET /server/api/super-admin/admins`
- `POST /server/api/super-admin/admins`

## 14. Operational workflows

### 14.1 Public onboarding workflow

1. visitor opens `/apply`
2. visitor submits application form
3. server validates NIC, email, and duplicates
4. record is inserted into `user_applications`
5. audit entry is inserted into `user_application_events`
6. admin reviews application
7. admin moves status to under review, rejects, or approves
8. if approved, a real auth user and profile are created
9. applicant receives password setup email or temporary password

### 14.2 Login workflow

1. user signs in through the role-specific login page
2. Supabase returns a session
3. `AuthProvider` loads the user profile
4. frontend derives the correct home route from role
5. route guards admit the user to the correct portal

### 14.3 Energy dataset workflow

1. imported rows are stored in `energy_readings_import`
2. each external dataset user code may be unmapped at first
3. staff links dataset user code to a platform profile
4. pipeline runs calculation logic over eligible rows
5. outputs are written to `energy_calculations`
6. import rows are updated with calculated values and statuses
7. if linked and promotable, rows are promoted into `energy_readings`
8. wallet token balances are reconciled
9. pipeline run status is written to `energy_pipeline_runs`

### 14.4 Wallet transfer workflow

1. authenticated user chooses a receiver
2. `transfer_tokens(...)` checks balance and wallet validity
3. sender balance is reduced
4. receiver balance is increased
5. mirrored sender/receiver transaction records are created

### 14.5 Green purchase workflow

There are two purchase concepts in the repository:

- direct green purchase using `purchase_green_coins(...)`
- P2P green purchase using `purchase_green_tokens_p2p(...)`

The more advanced implemented backend workflow is the P2P model with buyer cap checks and seller yellow-token deduction.

### 14.6 Settlement workflow

1. settlement reads current wallet
2. compares `red_token` and `green_token`
3. consumes the minimum of the two
4. writes updated balances
5. records a transaction marked as automatic monthly settlement

## 15. Energy pipeline implementations

There are two important implementation forms in the repository.

### 15.1 TypeScript backend pipeline

The active server-side calculation logic exists in:

- `supabase/functions/server/energy-pipeline.ts`

It:

- fetches import rows and history
- fetches coin settings
- derives monthly results
- optionally promotes rows into live tables
- reconciles wallet balances
- logs pipeline executions

### 15.2 Python legacy-compatible pipeline

The repository also contains:

- `scripts/energy_pipeline.py`
- `scripts/ceb_legacy_logic.py`

These are used for:

- standalone processing
- scheduled GitHub Actions runs
- preserving legacy calculation compatibility
- external or manual operational runs

## 16. Automation and scripts

### 16.1 GitHub Actions workflow

The workflow `.github/workflows/energy-pipeline.yml`:

- runs hourly at minute 15
- can run on manual dispatch
- can run on push to relevant pipeline files
- sets up Python 3.11
- validates required secrets
- executes `scripts/energy_pipeline.py`

### 16.2 Deployment helper

`scripts/deploy-green-token-engine.ps1`:

- optionally links local Supabase project
- pushes migrations
- deploys the `server` Edge Function

### 16.3 SMTP configuration helper

`utils/configure-supabase-smtp.ps1` patches Supabase Auth configuration using the management API so that SMTP mail settings can be managed programmatically.

## 17. Email subsystem

The `send-email` Edge Function integrates with Postmark and supports auth-related email actions such as:

- signup confirmation
- password recovery
- invitation
- magic link
- email change
- reauthentication

The function verifies webhook requests using `SEND_EMAIL_HOOK_SECRET` and sends email through Postmark using:

- `POSTMARK_SERVER_TOKEN`
- `POSTMARK_FROM_EMAIL`
- optional message stream and sender name settings

## 18. Environment configuration

### 18.1 Frontend environment variables

Expected frontend variables include:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SERVER_API_BASE_URL`

### 18.2 Backend and Edge Function variables

Expected backend/server variables include:

- `SUPABASE_URL`
- `SUPABASE_KEY`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ENERGY_CALCULATION_VERSION`
- `ENERGY_BILLING_ANCHOR_DATE`

### 18.3 Email variables

Expected email variables include:

- `SEND_EMAIL_HOOK_SECRET`
- `POSTMARK_SERVER_TOKEN`
- `POSTMARK_FROM_EMAIL`
- `POSTMARK_MESSAGE_STREAM`
- `POSTMARK_SENDER_NAME`

## 19. Deployment and runtime notes

### 19.1 Frontend runtime

The frontend is built with Vite and can be run locally with:

- `npm run dev`
- `npm run build`

### 19.2 Edge Function auth mode

The Supabase function config sets:

- `[functions.server]`
- `verify_jwt = false`

This is intentional. The server function verifies tokens itself by calling `requireUser(...)`, which allows consistent handling of publishable-key-based frontend requests.

### 19.3 First-admin bootstrap

The existing Supabase setup notes indicate that an initial admin or privileged account may require a seed/bootstrap step after the first user exists.

## 20. Notable strengths of the current design

- strong separation between public onboarding and real account creation
- role-aware routing and UI segmentation
- SQL-backed security with RLS
- guarded profile mutation to reduce privilege escalation risk
- versioned energy calculations
- pipeline run logging
- wallet audit logging
- reusable server API layer on the frontend
- preserved legacy calculation compatibility through Python and TypeScript

## 21. Current limitations and implementation observations

The following observations are based on the repository contents and should be useful in a formal report.

### 21.1 Mixed legacy and current logic

The repository contains both:

- old or transitional Python token logic in `tmp_logic/` and `scripts/`
- current TypeScript Edge Function implementations

This shows an active migration from earlier logic into the production-oriented backend.

### 21.2 Some schema artifacts are ahead of the UI

Certain database structures such as `green_purchase_requests` exist but are not yet fully exposed in the main routed frontend flow. This suggests planned expansion or partial implementation.

### 21.3 Multiple balance concepts coexist

The schema still stores:

- a combined `balance`
- split token balances

This is practical for backward compatibility, but it means documentation and future development should be careful to treat split token balances as the real source of meaning.

### 21.4 Current report basis

This document is based on code inspection, schema inspection, and repository automation scripts. It does not assume every page or migration has already been fully deployed to the live environment.

## 22. Suggested submission summary

SoleyVolt is a full-stack energy-token management platform built with React, Vite, Supabase, SQL-based business logic, and Edge Functions. The system is designed around controlled onboarding, role-based portals, wallet accounting, imported energy dataset processing, yellow/red/green token logic, and administrative governance. Its most significant technical strengths are the migration toward server-enforced business rules, the use of row-level security, and the dedicated energy pipeline that converts imported monthly energy records into auditable financial-style token outcomes.

## 23. Appendix: concise file-to-responsibility mapping

### Frontend

- `src/app/routes.tsx`: route map and route protection
- `src/app/providers/AuthProvider.tsx`: auth and profile state
- `src/app/components/AuthGate.tsx`: role-based gate logic
- `src/app/pages/LandingPage.tsx`: public product website
- `src/app/pages/ApplyNowPage.tsx`: public application entry point
- `src/app/components/PublicApplicationSection.tsx`: onboarding form
- `src/app/pages/AuthPage.tsx`: user login
- `src/app/pages/AdminAuthPage.tsx`: admin login
- `src/app/pages/SuperAdminAuthPage.tsx`: super-admin login
- `src/app/pages/Dashboard.tsx`: user dashboard
- `src/app/pages/Wallet.tsx`: wallet and transaction display
- `src/app/pages/TransactionHistory.tsx`: enriched transaction history
- `src/app/pages/Settings.tsx`: user profile and preference management
- `src/app/pages/SystemDashboard.tsx`: admin dashboard
- `src/app/pages/AdminApplicationsPage.tsx`: staff application review
- `src/app/pages/UserManagement.tsx`: user account monitoring and reset workflow
- `src/app/pages/EnergyPipelineAdminPage.tsx`: import mapping and pipeline control
- `src/app/pages/AdminSettingsPage.tsx`: pricing and coin controls
- `src/app/pages/SuperAdminAdminsPage.tsx`: admin creation and governance

### Shared frontend data layer

- `src/lib/supabase.ts`: frontend Supabase client
- `src/lib/supabase-data.ts`: direct Supabase data access
- `src/lib/server-api.ts`: Edge Function API client
- `src/lib/green-coin-market.ts`: live green market model and polling

### Backend

- `supabase/functions/server/index.tsx`: HTTP API routes
- `supabase/functions/server/supabase.ts`: admin and user Supabase clients
- `supabase/functions/server/energy-pipeline.ts`: energy import processing
- `supabase/functions/server/green-token-engine.ts`: P2P purchase, settlement, history logic
- `supabase/functions/send-email/index.ts`: Postmark email delivery hook

### Database and operations

- `supabase/migrations/`: schema evolution and business rules
- `supabase/seed.sql`: bootstrap support
- `scripts/energy_pipeline.py`: standalone pipeline runner
- `scripts/ceb_legacy_logic.py`: legacy monthly formula implementation
- `scripts/deploy-green-token-engine.ps1`: deployment helper
- `.github/workflows/energy-pipeline.yml`: scheduled pipeline automation
