import os
import datetime
import typing
from dotenv import load_dotenv
from supabase import create_client, Client


def _build_supabase_client() -> Client:
    """Create a Supabase client from environment variables once per manager."""
    load_dotenv()

    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY")

    if not supabase_url or not supabase_key:
        raise EnvironmentError(
            "SUPABASE_URL and SUPABASE_KEY must be set in environment variables"
        )

    try:
        return create_client(supabase_url, supabase_key)
    except Exception as exc:
        raise RuntimeError(f"Failed to initialize Supabase client: {exc}") from exc


class CEBTokenManager:
    def __init__(self):
        """Initialize Supabase client from environment variables."""
        self.client: Client = _build_supabase_client()


class CEBTokenEngine(CEBTokenManager):
    def __init__(self):
        """Initialize Supabase client and engine settings."""
        super().__init__()
        self.supabase: Client = self.client
        self.yellow_value_rs = 1.0

    def _utc_now(self):
        """Return the current timezone-aware UTC datetime."""
        return datetime.datetime.now(datetime.timezone.utc)

    def _utc_now_iso(self):
        """Return the current timezone-aware UTC datetime as ISO-8601."""
        return self._utc_now().isoformat()

    def _coerce_float(self, value, field_name):
        """Convert numeric inputs to float with a helpful validation error."""
        try:
            return float(value)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"{field_name} must be numeric") from exc

    def _normalize_month(self, month=None):
        """Return a UTC month anchor as a datetime."""
        if month is None:
            now = self._utc_now()
            return datetime.datetime(now.year, now.month, 1, tzinfo=datetime.timezone.utc)

        if isinstance(month, datetime.datetime):
            return datetime.datetime(month.year, month.month, 1, tzinfo=datetime.timezone.utc)

        if isinstance(month, datetime.date):
            return datetime.datetime(month.year, month.month, 1, tzinfo=datetime.timezone.utc)

        raise TypeError("month must be a date or datetime object")

    def _month_bounds(self, month=None):
        """Return UTC start and end boundaries for a calendar month."""
        month_start = self._normalize_month(month)
        if month_start.month == 12:
            next_month_start = datetime.datetime(month_start.year + 1, 1, 1, tzinfo=datetime.timezone.utc)
        else:
            next_month_start = datetime.datetime(month_start.year, month_start.month + 1, 1, tzinfo=datetime.timezone.utc)
        return month_start, next_month_start

    def _month_to_string(self, month=None):
        """Format a month as YYYY-MM."""
        return self._normalize_month(month).strftime("%Y-%m")

    def _user_exists(self, user_id):
        """Return True when the profile exists."""
        if user_id is None:
            return False

        try:
            response = (
                self.supabase.table("profiles")
                .select("id")
                .eq("id", user_id)
                .single()
                .execute()
            )
            if response.error and response.status_code != 406:
                raise RuntimeError(f"Supabase error fetching user: {response.error}")
            return bool(response.data)
        except Exception as exc:
            raise RuntimeError(f"Error validating user {user_id}: {exc}") from exc

    def _transaction_description(self, token_type, receiver_id=None):
        """Return a readable description for transaction log entries."""
        descriptions = {
            "green_purchase": "Peer green token purchase",
            "monthly_settlement": "Automatic monthly settlement",
        }
        if token_type in descriptions:
            return descriptions[token_type]
        if receiver_id is None:
            return "System wallet adjustment"
        return f"{token_type} transfer"

    def _normalize_transaction_row(self, tx):
        """Map a wallet_transactions row into a sender/receiver transaction shape."""
        if not isinstance(tx, dict):
            return None

        metadata = tx.get("metadata") or {}
        if not isinstance(metadata, dict):
            metadata = {}

        tx_type = tx.get("transaction_type")
        row_user_id = tx.get("user_id")
        counterparty_id = tx.get("counterparty_user_id")

        sender_id = metadata.get("sender_id")
        receiver_id = metadata.get("receiver_id")

        if sender_id is None and receiver_id is None:
            if tx_type == "send":
                sender_id = row_user_id
                receiver_id = counterparty_id
            elif tx_type == "receive":
                sender_id = counterparty_id
                receiver_id = row_user_id
            elif tx_type == "adjustment":
                sender_id = row_user_id
                receiver_id = counterparty_id
            else:
                sender_id = row_user_id
                receiver_id = counterparty_id

        raw_amount = self._coerce_float(tx.get("amount", 0), "transaction amount")
        amount = metadata.get("amount")
        amount = self._coerce_float(amount if amount is not None else abs(raw_amount), "transaction amount")

        amount_rs = metadata.get("amount_rs")
        amount_rs = self._coerce_float(amount_rs if amount_rs is not None else 0, "transaction amount_rs")

        token_type = metadata.get("token_type") or tx_type

        return {
            "id": tx.get("id"),
            "created_at": tx.get("created_at"),
            "status": tx.get("status"),
            "description": tx.get("description"),
            "metadata": metadata,
            "sender_id": sender_id,
            "receiver_id": receiver_id,
            "token_type": token_type,
            "amount": amount,
            "amount_rs": amount_rs,
            "transaction_type": tx_type,
            "ledger_user_id": row_user_id,
            "counterparty_user_id": counterparty_id,
        }

    def _transaction_group_key(self, normalized_tx):
        """Build a stable grouping key so send/receive mirror rows collapse into one event."""
        if not normalized_tx:
            return None

        metadata = normalized_tx.get("metadata") or {}
        transfer_group_id = metadata.get("transfer_group_id")
        if transfer_group_id:
            return str(transfer_group_id)

        return "|".join(
            [
                str(normalized_tx.get("token_type")),
                str(normalized_tx.get("sender_id")),
                str(normalized_tx.get("receiver_id")),
                f"{float(normalized_tx.get('amount', 0)):.4f}",
                str(normalized_tx.get("created_at")),
            ]
        )

    def _execute_select(self, table_name, columns="*", **filters):
        """Run a simple select query with equality filters and return list data."""
        try:
            query = self.supabase.table(table_name).select(columns)
            for key, value in filters.items():
                query = query.eq(key, value)

            response = query.execute()
            if response.error:
                raise RuntimeError(
                    f"Supabase error fetching {table_name}: {response.error}"
                )
            return response.data or []
        except Exception as exc:
            raise RuntimeError(f"Error fetching {table_name}: {exc}") from exc

    def fetch_all_meters(self):
        """Return all meters needed for batch lookups."""
        return self._execute_select("meters", "id, meter_id, user_id, location")

    def fetch_all_wallets(self):
        """Return all wallets needed for batch lookups."""
        return self._execute_select(
            "wallets",
            "user_id, yellow_balance, red_balance, green_balance",
        )

    def fetch_all_users(self):
        """Return all application users from profiles table."""
        try:
            response = (
                self.supabase.table("profiles")
                .select("id, full_name, email, phone, role, status, user_type, created_at")
                .execute()
            )
            if response.error:
                raise RuntimeError(f"Supabase error fetching profiles: {response.error}")

            users = []
            for row in response.data or []:
                if not isinstance(row, dict):
                    continue
                users.append({
                    **row,
                    "name": row.get("full_name"),
                    "tel": row.get("phone"),
                    "user_id": row.get("id"),
                })
            return users
        except Exception as exc:
            raise RuntimeError(f"Error fetching all users: {exc}") from exc

    def fetch_user_meter(self, user_id):
        """Return the most recent imported dataset meter mapped to a user."""
        if user_id is None:
            raise ValueError("user_id is required")
        try:
            response = (
                self.supabase.table("energy_readings_import")
                .select("meter_id, dataset_user_code, source_file_name, reading_date, created_at")
                .eq("linked_user_id", user_id)
                .order("billing_cycle", desc=True)
                .order("created_at", desc=True)
                .single()
                .execute()
            )
            if response.error and response.status_code != 406:
                raise RuntimeError(f"Supabase error fetching meter: {response.error}")

            if not response.data:
                return None

            meter = response.data
            return {
                "id": meter.get("meter_id"),
                "meter_id": meter.get("meter_id"),
                "user_id": user_id,
                "location": meter.get("source_file_name"),
                "dataset_user_code": meter.get("dataset_user_code"),
                "reading_date": meter.get("reading_date"),
            }
        except Exception as exc:
            raise RuntimeError(f"Error fetching user meter {user_id}: {exc}") from exc

    def fetch_energy_readings(self, meter_id, month):
        """Return energy readings for a meter for the given month (date object)."""
        if meter_id is None or month is None:
            raise ValueError("meter_id and month are required")

        if not isinstance(month, (datetime.date, datetime.datetime)):
            raise TypeError("month must be a date or datetime object")

        month_start = datetime.datetime(month.year, month.month, 1)
        if month.month == 12:
            month_end = datetime.datetime(month.year + 1, 1, 1)
        else:
            month_end = datetime.datetime(month.year, month.month + 1, 1)

        try:
            response = (
                self.supabase.table("energy_readings")
                .select("*")
                .eq("meter_id", meter_id)
                .gte("reading_date", month_start.isoformat())
                .lt("reading_date", month_end.isoformat())
                .order("reading_date", desc=False)
                .execute()
            )
            if response.error:
                raise RuntimeError(f"Supabase error fetching energy readings: {response.error}")
            return response.data or []
        except Exception as exc:
            raise RuntimeError(
                f"Error fetching energy readings for meter {meter_id} month {month}: {exc}"
            ) from exc

    def fetch_historical_readings(self, meter_id, months=3):
        """Return last N months of readings ordered by month descending."""
        if meter_id is None:
            raise ValueError("meter_id is required")
        if months <= 0:
            raise ValueError("months must be greater than 0")

        try:
            response = (
                self.supabase.table("energy_readings")
                .select("*")
                .eq("meter_id", meter_id)
                .order("reading_date", desc=True)
                .limit(months)
                .execute()
            )
            if response.error:
                raise RuntimeError(f"Supabase error fetching historical readings: {response.error}")
            return response.data or []
        except Exception as exc:
            raise RuntimeError(
                f"Error fetching historical readings for meter {meter_id}: {exc}"
            ) from exc

    def fetch_wallet(self, user_id):
        """Return wallet for user; create one if it doesn't exist."""
        if user_id is None:
            raise ValueError("user_id is required")

        try:
            response = (
                self.supabase.table("wallets")
                .select("*")
                .eq("user_id", user_id)
                .single()
                .execute()
            )
            if response.error and response.status_code != 406:
                raise RuntimeError(f"Supabase error fetching wallet: {response.error}")

            if response.data:
                return self._normalize_wallet_record(response.data)

            return self._create_wallet(user_id)
        except Exception as exc:
            raise RuntimeError(f"Error fetching wallet for user {user_id}: {exc}") from exc

    def _normalize_wallet_record(self, wallet):
        """Normalize current and legacy wallet schemas to a single shape."""
        if not isinstance(wallet, dict):
            return wallet

        yellow_value = wallet.get("yellow_balance")
        red_value = wallet.get("red_balance")
        green_value = wallet.get("green_balance")

        if yellow_value is None and "yellow_token" in wallet:
            yellow_value = wallet.get("yellow_token")
        if red_value is None and "red_token" in wallet:
            red_value = wallet.get("red_token")
        if green_value is None and "green_token" in wallet:
            green_value = wallet.get("green_token")

        normalized = dict(wallet)
        normalized.setdefault("yellow_balance", yellow_value if yellow_value is not None else 0)
        normalized.setdefault("red_balance", red_value if red_value is not None else 0)
        normalized.setdefault("green_balance", green_value if green_value is not None else 0)

        if "balance" not in normalized:
            normalized["balance"] = float(normalized["yellow_balance"] or 0) + float(normalized["green_balance"] or 0) - float(normalized["red_balance"] or 0)

        return normalized

    def _create_wallet(self, user_id):
        """Create wallet with zero balances and updated_at timestamp."""
        if user_id is None:
            raise ValueError("user_id is required")

        payload = {
            "user_id": user_id,
            "balance": 0,
            "lifetime_earned": 0,
            "lifetime_spent": 0,
            "updated_at": self._utc_now_iso(),
        }

        try:
            response = self.supabase.table("wallets").insert(payload).execute()
            if response.error:
                raise RuntimeError(f"Supabase error creating wallet: {response.error}")
            return (response.data or [None])[0]
        except Exception as exc:
            raise RuntimeError(f"Error creating wallet for user {user_id}: {exc}") from exc

    def fetch_transactions(self, user_id, limit=20):
        """Return recent transactions where user is sender or receiver."""
        if user_id is None:
            raise ValueError("user_id is required")
        if limit <= 0:
            raise ValueError("limit must be greater than 0")

        try:
            response = (
                self.supabase.table("wallet_transactions")
                .select("*")
                .or_(f"user_id.eq.{user_id},counterparty_user_id.eq.{user_id}")
                .order("created_at", desc=True)
                .limit(limit)
                .execute()
            )
            if response.error:
                raise RuntimeError(f"Supabase error fetching transactions: {response.error}")

            transactions = []
            for tx in response.data or []:
                if not isinstance(tx, dict):
                    continue
                tx_type = tx.get("transaction_type")
                sender_id = tx.get("user_id") if tx_type == "send" else tx.get("counterparty_user_id")
                receiver_id = tx.get("user_id") if tx_type == "receive" else tx.get("counterparty_user_id")
                transactions.append({
                    **tx,
                    "sender_id": sender_id,
                    "receiver_id": receiver_id,
                    "token_type": tx.get("transaction_type"),
                    "amount_rs": tx.get("amount"),
                })
            return transactions
        except Exception as exc:
            raise RuntimeError(f"Error fetching transactions for user {user_id}: {exc}") from exc

    def fetch_monthly_summaries(self, user_id, limit=12):
        """Return monthly summaries for user ordered by month descending."""
        if user_id is None:
            raise ValueError("user_id is required")
        if limit <= 0:
            raise ValueError("limit must be greater than 0")

        try:
            response = (
                self.supabase.table("energy_import_admin_view")
                .select("billing_cycle, period_end, imported_kwh, exported_kwh, net_kwh, yellow_tokens, red_tokens, calculated_at, linked_user_id")
                .eq("linked_user_id", user_id)
                .order("billing_cycle", desc=True)
                .limit(limit)
                .execute()
            )
            if response.error:
                raise RuntimeError(f"Supabase error fetching monthly summaries: {response.error}")
            return [
                {
                    "user_id": user_id,
                    "month": row.get("period_end"),
                    "import_kwh": row.get("imported_kwh"),
                    "export_kwh": row.get("exported_kwh"),
                    "net_kwh": row.get("net_kwh"),
                    "yellow_awarded": row.get("yellow_tokens"),
                    "red_awarded": row.get("red_tokens"),
                    "created_at": row.get("calculated_at"),
                }
                for row in (response.data or [])
                if isinstance(row, dict)
            ]
        except Exception as exc:
            raise RuntimeError(
                f"Error fetching monthly summaries for user {user_id}: {exc}"
            ) from exc

    def calculate_net_energy(self, import_kwh, export_kwh):
        """Calculate net energy and token allocations."""
        if import_kwh is None or export_kwh is None:
            raise ValueError("import_kwh and export_kwh are required")

        try:
            net_kwh = float(export_kwh) - float(import_kwh)
        except (TypeError, ValueError) as exc:
            raise ValueError("import_kwh and export_kwh must be numeric") from exc

        if net_kwh > 0:
            yellow_tokens = net_kwh
            red_tokens = 0.0
        elif net_kwh < 0:
            yellow_tokens = 0.0
            red_tokens = abs(net_kwh)
        else:
            yellow_tokens = 0.0
            red_tokens = 0.0

        return net_kwh, yellow_tokens, red_tokens

    def get_average_import(self, meter_id, months=3):
        """Return average import_kwh from historical readings for last N months."""
        if meter_id is None:
            raise ValueError("meter_id is required")
        if months <= 0:
            raise ValueError("months must be greater than 0")

        readings = self.fetch_historical_readings(meter_id, months=months)
        if not readings:
            return 0.0

        total = 0.0
        count = 0

        for item in readings:
            if not item:
                continue
            import_kwh = item.get("import_kwh")
            if import_kwh is None:
                continue
            try:
                total += float(import_kwh)
                count += 1
            except (TypeError, ValueError):
                continue

        return total / count if count > 0 else 0.0

    def calculate_green_cap(self, meter_id):
        """Calculate green cap as half of average import."""
        avg_import = self.get_average_import(meter_id, months=3)
        return avg_import / 2.0

    def get_monthly_green_purchases(self, user_id, month=None):
        """Return total green purchases for the provided month, defaulting to the current month."""
        if user_id is None:
            raise ValueError("user_id is required")

        month_start, next_month_start = self._month_bounds(month)

        try:
            response = (
                self.supabase.table("green_coin_purchases")
                .select("green_coins")
                .eq("user_id", user_id)
                .gte("created_at", month_start.isoformat())
                .lt("created_at", next_month_start.isoformat())
                .execute()
            )
            if response.error:
                raise RuntimeError(f"Supabase error fetching green purchases: {response.error}")

            records = response.data or []
            total = 0.0

            for rec in records:
                try:
                    total += float(rec.get("green_coins", 0))
                except (TypeError, ValueError):
                    continue

            return total
        except Exception as exc:
            raise RuntimeError(f"Error fetching monthly green purchases for user {user_id}: {exc}") from exc

    def process_user_monthly(self, user_id, month):
        """Process monthly energy and token updates for a single user."""
        if user_id is None:
            return {"success": False, "error": "user_id is required"}

        if not isinstance(month, (datetime.date, datetime.datetime)):
            return {"success": False, "error": "month must be a date or datetime object"}

        try:
            meter = self.fetch_user_meter(user_id)
            if not meter:
                return {"success": False, "error": "Meter not found", "user_id": user_id, "month": month}

            meter_id = meter.get("id") or meter.get("meter_id")
            if not meter_id:
                return {"success": False, "error": "meter_id not found in meter record", "user_id": user_id, "month": month}

            readings = self.fetch_energy_readings(meter_id, month)
            if not readings:
                return {"success": False, "error": "No readings found", "user_id": user_id, "month": month}

            total_import = 0.0
            total_export = 0.0
            for r in readings:
                if not r:
                    continue
                try:
                    total_import += float(r.get("import_kwh", 0))
                except (TypeError, ValueError):
                    continue
                try:
                    total_export += float(r.get("export_kwh", 0))
                except (TypeError, ValueError):
                    continue

            net_kwh, yellow_tokens, red_tokens = self.calculate_net_energy(total_import, total_export)

            # Update wallet balances by awarding yellow and red tokens
            self.update_wallet_balances(user_id, yellow_delta=yellow_tokens, red_delta=red_tokens, green_delta=0)

            summary = self.create_monthly_summary(
                user_id=user_id,
                month=month,
                import_kwh=total_import,
                export_kwh=total_export,
                net_kwh=net_kwh,
                yellow_awarded=yellow_tokens,
                red_awarded=red_tokens,
            )

            current_wallet = self.fetch_wallet(user_id)

            return {
                "success": True,
                "user_id": user_id,
                "month": month.isoformat() if isinstance(month, datetime.date) else str(month),
                "readings": readings,
                "tokens_awarded": {
                    "yellow": yellow_tokens,
                    "red": red_tokens,
                    "green": 0,
                },
                "current_balances": current_wallet,
                "monthly_summary": summary,
            }
        except Exception as exc:
            return {"success": False, "error": str(exc), "user_id": user_id, "month": month}

    def process_all_users_monthly(self, month):
        """Process monthly workflow for all users and return summary report."""
        if not isinstance(month, (datetime.date, datetime.datetime)):
            return {"success": False, "error": "month must be a date or datetime object"}

        results = []
        errors = []
        total_users_processed = 0
        total_errors = 0

        users = self.fetch_all_users()
        for user in users:
            user_id = user.get("id") or user.get("user_id")
            if not user_id:
                total_errors += 1
                errors.append({"user": user, "error": "No user_id found"})
                continue

            outcome = self.process_user_monthly(user_id, month)
            results.append(outcome)
            total_users_processed += 1
            if not outcome.get("success"):
                total_errors += 1
                errors.append(outcome)

        return {
            "success": True,
            "month": month.isoformat() if isinstance(month, datetime.date) else str(month),
            "total_users_processed": total_users_processed,
            "total_errors": total_errors,
            "results": results,
            "errors": errors,
        }

    def update_wallet_balances(self, user_id, yellow_delta=0, red_delta=0, green_delta=0):
        """Update wallet balances by delta values and return updated wallet."""
        if user_id is None:
            raise ValueError("user_id is required")

        wallet = self.fetch_wallet(user_id)
        current_yellow = float(wallet.get("yellow_balance", 0))
        current_red = float(wallet.get("red_balance", 0))
        current_green = float(wallet.get("green_balance", 0))

        new_yellow = current_yellow + float(yellow_delta)
        new_red = current_red + float(red_delta)
        new_green = current_green + float(green_delta)

        if new_yellow < 0 or new_red < 0 or new_green < 0:
            raise ValueError("Balance update would result in negative values")

        update_payload = {
            "updated_at": self._utc_now_iso(),
        }

        if "yellow_token" in wallet or "red_token" in wallet or "green_token" in wallet:
            update_payload.update({
                "yellow_token": new_yellow,
                "red_token": new_red,
                "green_token": new_green,
            })
        elif "yellow_balance" in wallet or "red_balance" in wallet or "green_balance" in wallet:
            update_payload.update({
                "yellow_balance": new_yellow,
                "red_balance": new_red,
                "green_balance": new_green,
            })
        else:
            net_delta = float(yellow_delta) + float(green_delta) - float(red_delta)
            update_payload.update({
                "balance": float(wallet.get("balance", 0)) + net_delta,
                "lifetime_earned": float(wallet.get("lifetime_earned", 0)) + max(net_delta, 0),
                "lifetime_spent": float(wallet.get("lifetime_spent", 0)) + abs(min(net_delta, 0)),
            })

        try:
            response = (
                self.supabase.table("wallets")
                .update(update_payload)
                .eq("user_id", user_id)
                .single()
                .execute()
            )
            if response.error:
                raise RuntimeError(f"Supabase error updating wallet balances: {response.error}")
            return self._normalize_wallet_record(response.data)
        except Exception as exc:
            raise RuntimeError(f"Error updating wallet balances for user {user_id}: {exc}") from exc

    def create_monthly_summary(self, user_id, month, import_kwh, export_kwh, net_kwh, yellow_awarded, red_awarded):
        """Insert a monthly summary record and return it."""
        if user_id is None or month is None:
            raise ValueError("user_id and month are required")

        if not isinstance(month, (datetime.date, datetime.datetime)):
            raise TypeError("month must be a date or datetime object")

        payload = {
            "user_id": user_id,
            "month": month.isoformat() if isinstance(month, datetime.date) else month,
            "import_kwh": float(import_kwh),
            "export_kwh": float(export_kwh),
            "net_kwh": float(net_kwh),
            "yellow_awarded": float(yellow_awarded),
            "red_awarded": float(red_awarded),
            "created_at": self._utc_now_iso(),
        }

        try:
            response = self.supabase.table("monthly_summaries").insert(payload).single().execute()
            if response.error:
                raise RuntimeError(f"Supabase error creating monthly summary: {response.error}")
            return response.data
        except Exception as exc:
            raise RuntimeError(f"Error creating monthly summary for user {user_id}: {exc}") from exc

    def record_transaction(self, sender_id, receiver_id, token_type, amount, amount_rs):
        """Insert a logical transaction and return a normalized record."""
        if sender_id is None or token_type is None:
            raise ValueError("sender_id and token_type are required")

        amount = self._coerce_float(amount, "amount")
        amount_rs = self._coerce_float(amount_rs, "amount_rs")
        if amount <= 0:
            raise ValueError("amount must be greater than 0")

        created_at = self._utc_now_iso()
        description = self._transaction_description(token_type, receiver_id=receiver_id)
        transfer_group_id = f"{sender_id}:{receiver_id}:{token_type}:{created_at}"
        metadata = {
            "sender_id": sender_id,
            "receiver_id": receiver_id,
            "token_type": token_type,
            "amount": amount,
            "amount_rs": amount_rs,
            "transfer_group_id": transfer_group_id,
        }

        try:
            payload = [
                {
                    "user_id": sender_id,
                    "counterparty_user_id": receiver_id,
                    "transaction_type": "adjustment" if receiver_id is None else "send",
                    "amount": amount * -1,
                    "description": description,
                    "status": "completed",
                    "metadata": metadata,
                    "created_at": created_at,
                }
            ]

            if receiver_id is not None:
                payload.append(
                    {
                        "user_id": receiver_id,
                        "counterparty_user_id": sender_id,
                        "transaction_type": "receive",
                        "amount": amount,
                        "description": description,
                        "status": "completed",
                        "metadata": metadata,
                        "created_at": created_at,
                    }
                )

            response = self.supabase.table("wallet_transactions").insert(payload).execute()
            if response.error:
                raise RuntimeError(f"Supabase error recording transaction: {response.error}")

            inserted_rows = response.data or []
            return {
                "sender_id": sender_id,
                "receiver_id": receiver_id,
                "token_type": token_type,
                "amount": amount,
                "amount_rs": amount_rs,
                "description": description,
                "created_at": created_at,
                "records": inserted_rows,
            }
        except Exception as exc:
            raise RuntimeError(f"Error recording transaction from {sender_id} to {receiver_id}: {exc}") from exc

    def record_green_purchase(self, user_id, month, green_purchased, kwh_covered, amount_rs):
        """Insert a green purchase row and return an enriched purchase record."""
        if user_id is None or month is None:
            raise ValueError("user_id and month are required")

        month_start = self._normalize_month(month)
        green_purchased = self._coerce_float(green_purchased, "green_purchased")
        kwh_covered = self._coerce_float(kwh_covered, "kwh_covered")
        amount_rs = self._coerce_float(amount_rs, "amount_rs")

        payload = {
            "user_id": user_id,
            "green_coins": green_purchased,
            "unit_price": amount_rs / green_purchased if green_purchased else 0,
            "total_cost": amount_rs,
            "status": "completed",
            "payment_reference": None,
            "created_at": self._utc_now_iso(),
        }

        try:
            response = self.supabase.table("green_coin_purchases").insert(payload).single().execute()
            if response.error:
                raise RuntimeError(f"Supabase error recording green purchase: {response.error}")
            return {
                **(response.data or {}),
                "month": self._month_to_string(month_start),
                "green_purchased": green_purchased,
                "kwh_covered": kwh_covered,
                "amount_rs": amount_rs,
            }
        except Exception as exc:
            raise RuntimeError(f"Error recording green purchase for user {user_id}: {exc}") from exc

    def _calculate_purchase_request_cap_status(
        self,
        buyer_id: str,
        green_amount: float,
        month: typing.Optional[typing.Union[datetime.date, datetime.datetime]] = None,
    ) -> dict[str, typing.Any]:
        """Return buyer cap usage for a requested green purchase amount."""
        if buyer_id is None:
            raise ValueError("buyer_id is required")

        buyer_meter = self.fetch_user_meter(buyer_id)
        if not buyer_meter:
            raise RuntimeError("Buyer meter not found")

        buyer_meter_id = buyer_meter.get("id") or buyer_meter.get("meter_id")
        if not buyer_meter_id:
            raise RuntimeError("Buyer meter_id not found")

        month_start = self._normalize_month(month)
        buyer_cap = round(float(self.calculate_green_cap(buyer_meter_id) or 0), 2)
        existing_purchases = round(float(self.get_monthly_green_purchases(buyer_id, month=month_start) or 0), 2)
        requested = round(float(green_amount), 2)
        total_after_purchase = round(existing_purchases + requested, 2)

        return {
            "limit": buyer_cap,
            "existing": existing_purchases,
            "requested": requested,
            "remaining": max(0.0, round(buyer_cap - total_after_purchase, 2)),
            "total_after_purchase": total_after_purchase,
            "buyer_meter_id": buyer_meter_id,
        }

    def _fetch_purchase_request(self, request_id: str) -> typing.Optional[dict[str, typing.Any]]:
        """Fetch a single green purchase request by id."""
        if request_id is None:
            raise ValueError("request_id is required")

        try:
            response = (
                self.supabase.table("green_purchase_requests")
                .select("*")
                .eq("id", request_id)
                .single()
                .execute()
            )
            if response.error and response.status_code != 406:
                raise RuntimeError(
                    f"Supabase error fetching green purchase request: {response.error}"
                )
            return response.data or None
        except Exception as exc:
            raise RuntimeError(f"Error fetching green purchase request {request_id}: {exc}") from exc

    def _fetch_profile_map(self, user_ids: typing.Iterable[str]) -> dict[str, dict[str, typing.Any]]:
        """Fetch profile name and email for a list of user ids."""
        unique_ids = [user_id for user_id in dict.fromkeys(user_ids) if user_id]
        if not unique_ids:
            return {}

        try:
            response = (
                self.supabase.table("profiles")
                .select("id, full_name, email")
                .in_("id", unique_ids)
                .execute()
            )
            if response.error:
                raise RuntimeError(f"Supabase error fetching profiles: {response.error}")

            return {
                row.get("id"): {
                    "id": row.get("id"),
                    "name": row.get("full_name"),
                    "email": row.get("email"),
                }
                for row in (response.data or [])
                if isinstance(row, dict) and row.get("id")
            }
        except Exception as exc:
            raise RuntimeError(f"Error fetching profile details: {exc}") from exc

    def _enrich_purchase_request(
        self,
        request_row: dict[str, typing.Any],
        profile_map: dict[str, dict[str, typing.Any]],
        user_id: typing.Optional[str] = None,
    ) -> dict[str, typing.Any]:
        """Add role and counterparty details to a purchase request row."""
        buyer_id = request_row.get("buyer_id")
        seller_id = request_row.get("seller_id")
        role = None
        counterparty_id = None

        if user_id:
            role = "buyer" if buyer_id == user_id else "seller" if seller_id == user_id else None
            counterparty_id = seller_id if role == "buyer" else buyer_id if role == "seller" else None

        return {
            **request_row,
            "buyer": profile_map.get(buyer_id),
            "seller": profile_map.get(seller_id),
            "role": role,
            "counterparty": profile_map.get(counterparty_id) if counterparty_id else None,
        }

    def create_green_purchase_request(
        self,
        buyer_id: str,
        seller_id: str,
        amount_rs: typing.Union[int, float],
    ) -> dict[str, typing.Any]:
        """
        Create a pending P2P green purchase request.

        The buyer proposes an off-chain rupee payment, and the request remains
        pending until the seller explicitly accepts or rejects it.
        """
        if buyer_id is None or seller_id is None:
            return {"success": False, "error": "buyer_id and seller_id are required"}
        if buyer_id == seller_id:
            return {"success": False, "error": "buyer_id and seller_id must be different"}

        try:
            amount_rs = round(self._coerce_float(amount_rs, "amount_rs"), 2)
        except ValueError as exc:
            return {"success": False, "error": str(exc)}

        if amount_rs <= 0:
            return {"success": False, "error": "amount_rs must be greater than 0"}

        try:
            if not self._user_exists(buyer_id):
                return {"success": False, "error": "Buyer not found", "buyer_id": buyer_id}
            if not self._user_exists(seller_id):
                return {"success": False, "error": "Seller not found", "seller_id": seller_id}

            yellow_amount = round(amount_rs, 2)
            green_amount = round(amount_rs / (self.yellow_value_rs * 2), 2)
            cap_status = self._calculate_purchase_request_cap_status(buyer_id, green_amount)

            if cap_status["total_after_purchase"] > cap_status["limit"]:
                return {
                    "success": False,
                    "error": "Purchase exceeds green cap",
                    "cap_limit": cap_status["limit"],
                    "existing": cap_status["existing"],
                    "requested": cap_status["requested"],
                    "available": max(0.0, round(cap_status["limit"] - cap_status["existing"], 2)),
                }

            payload = {
                "buyer_id": buyer_id,
                "seller_id": seller_id,
                "amount_rs": amount_rs,
                "yellow_amount": yellow_amount,
                "green_amount": green_amount,
                "status": "pending",
                "created_at": self._utc_now_iso(),
            }

            response = (
                self.supabase.table("green_purchase_requests")
                .insert(payload)
                .single()
                .execute()
            )
            if response.error:
                raise RuntimeError(
                    f"Supabase error creating green purchase request: {response.error}"
                )

            request_row = response.data or {}
            return {
                "success": True,
                "request_id": request_row.get("id"),
                "buyer_id": buyer_id,
                "seller_id": seller_id,
                "amount_rs": amount_rs,
                "yellow_amount": yellow_amount,
                "green_amount": green_amount,
                "status": request_row.get("status", "pending"),
                "cap_status": {
                    "limit": cap_status["limit"],
                    "existing": cap_status["existing"],
                    "requested": cap_status["requested"],
                    "available": max(0.0, round(cap_status["limit"] - cap_status["existing"], 2)),
                    "remaining": cap_status["remaining"],
                },
            }
        except Exception as exc:
            return {
                "success": False,
                "error": str(exc),
                "buyer_id": buyer_id,
                "seller_id": seller_id,
                "amount_rs": amount_rs,
            }

    def accept_green_purchase_request(
        self,
        request_id: str,
        seller_id: str,
    ) -> dict[str, typing.Any]:
        """
        Accept a pending purchase request and execute the token exchange.

        The seller must have enough yellow tokens to complete the request.
        """
        if request_id is None or seller_id is None:
            return {"success": False, "error": "request_id and seller_id are required"}

        try:
            request_row = self._fetch_purchase_request(request_id)
            if not request_row:
                return {"success": False, "error": "Purchase request not found", "request_id": request_id}

            if request_row.get("status") != "pending":
                return {
                    "success": False,
                    "error": "Purchase request is not pending",
                    "request_id": request_id,
                    "status": request_row.get("status"),
                }

            if request_row.get("seller_id") != seller_id:
                return {
                    "success": False,
                    "error": "seller_id does not match request seller",
                    "request_id": request_id,
                    "seller_id": seller_id,
                }

            amount_rs = round(float(request_row.get("amount_rs", 0) or 0), 2)
            yellow_amount = round(float(request_row.get("yellow_amount", 0) or 0), 2)
            green_amount = round(float(request_row.get("green_amount", 0) or 0), 2)
            buyer_id = request_row.get("buyer_id")

            seller_wallet = self.fetch_wallet(seller_id)
            seller_yellow = round(float(seller_wallet.get("yellow_balance", 0) or 0), 2)
            if seller_yellow < yellow_amount:
                return {
                    "success": False,
                    "error": "Seller has insufficient yellow balance",
                    "request_id": request_id,
                    "seller_balance": seller_yellow,
                    "required_amount": yellow_amount,
                }

            self.fetch_wallet(buyer_id)

            seller_updated = False
            buyer_updated = False
            request_marked = False

            try:
                self.update_wallet_balances(seller_id, yellow_delta=-yellow_amount, red_delta=0, green_delta=0)
                seller_updated = True
                self.update_wallet_balances(buyer_id, yellow_delta=0, red_delta=0, green_delta=green_amount)
                buyer_updated = True

                transaction_record = self.record_transaction(
                    sender_id=seller_id,
                    receiver_id=buyer_id,
                    token_type="green_purchase",
                    amount=green_amount,
                    amount_rs=amount_rs,
                )

                green_purchase_record = self.record_green_purchase(
                    user_id=buyer_id,
                    month=self._normalize_month(),
                    green_purchased=green_amount,
                    kwh_covered=green_amount,
                    amount_rs=amount_rs,
                )

                request_update = (
                    self.supabase.table("green_purchase_requests")
                    .update({
                        "status": "completed",
                        "accepted_at": self._utc_now_iso(),
                        "completed_at": self._utc_now_iso(),
                        "updated_at": self._utc_now_iso(),
                    })
                    .eq("id", request_id)
                    .single()
                    .execute()
                )
                if request_update.error:
                    raise RuntimeError(
                        f"Supabase error completing green purchase request: {request_update.error}"
                    )
                request_marked = True
            except Exception as exc:
                rollback_errors = []

                if buyer_updated:
                    try:
                        self.update_wallet_balances(buyer_id, yellow_delta=0, red_delta=0, green_delta=-green_amount)
                    except Exception as rollback_exc:
                        rollback_errors.append(f"buyer rollback failed: {rollback_exc}")
                if seller_updated:
                    try:
                        self.update_wallet_balances(seller_id, yellow_delta=yellow_amount, red_delta=0, green_delta=0)
                    except Exception as rollback_exc:
                        rollback_errors.append(f"seller rollback failed: {rollback_exc}")
                if request_marked:
                    try:
                        self.supabase.table("green_purchase_requests").update(
                            {"status": "pending", "accepted_at": None, "completed_at": None, "updated_at": self._utc_now_iso()}
                        ).eq("id", request_id).execute()
                    except Exception as rollback_exc:
                        rollback_errors.append(f"request rollback failed: {rollback_exc}")

                error_message = str(exc)
                if rollback_errors:
                    error_message = f"{error_message}. Rollback issues: {'; '.join(rollback_errors)}"
                return {"success": False, "error": error_message, "request_id": request_id}

            buyer_balances = self.fetch_wallet(buyer_id)
            seller_balances = self.fetch_wallet(seller_id)

            return {
                "success": True,
                "request_id": request_id,
                "buyer_id": buyer_id,
                "seller_id": seller_id,
                "amount_rs": amount_rs,
                "yellow_deducted": yellow_amount,
                "green_added": green_amount,
                "buyer_balances": buyer_balances,
                "seller_balances": seller_balances,
                "transaction_record": transaction_record,
                "green_purchase_record": green_purchase_record,
            }
        except Exception as exc:
            return {"success": False, "error": str(exc), "request_id": request_id, "seller_id": seller_id}

    def reject_green_purchase_request(
        self,
        request_id: str,
        seller_id: str,
        reason: typing.Optional[str] = None,
    ) -> dict[str, typing.Any]:
        """
        Reject a pending purchase request.

        A seller can reject only their own pending requests and optionally provide
        a rejection reason in the notes field.
        """
        if request_id is None or seller_id is None:
            return {"success": False, "error": "request_id and seller_id are required"}

        try:
            request_row = self._fetch_purchase_request(request_id)
            if not request_row:
                return {"success": False, "error": "Purchase request not found", "request_id": request_id}

            if request_row.get("status") != "pending":
                return {
                    "success": False,
                    "error": "Purchase request is not pending",
                    "request_id": request_id,
                    "status": request_row.get("status"),
                }

            if request_row.get("seller_id") != seller_id:
                return {
                    "success": False,
                    "error": "seller_id does not match request seller",
                    "request_id": request_id,
                    "seller_id": seller_id,
                }

            response = (
                self.supabase.table("green_purchase_requests")
                .update({
                    "status": "rejected",
                    "rejected_at": self._utc_now_iso(),
                    "notes": reason,
                    "updated_at": self._utc_now_iso(),
                })
                .eq("id", request_id)
                .single()
                .execute()
            )
            if response.error:
                raise RuntimeError(
                    f"Supabase error rejecting green purchase request: {response.error}"
                )

            return {
                "success": True,
                "request_id": request_id,
                "status": "rejected",
                "buyer_id": request_row.get("buyer_id"),
                "seller_id": seller_id,
                "message": "Purchase request rejected",
            }
        except Exception as exc:
            return {"success": False, "error": str(exc), "request_id": request_id, "seller_id": seller_id}

    def get_pending_purchase_requests(
        self,
        user_id: str,
        as_seller: bool = True,
    ) -> dict[str, typing.Any]:
        """
        Return pending purchase requests for a buyer or seller.

        When as_seller is True, pending inbound requests are returned for the
        seller. Otherwise, the buyer's own pending outbound requests are listed.
        """
        if user_id is None:
            return {"success": False, "error": "user_id is required"}

        try:
            if not self._user_exists(user_id):
                return {"success": False, "error": "User not found", "user_id": user_id}

            column_name = "seller_id" if as_seller else "buyer_id"
            response = (
                self.supabase.table("green_purchase_requests")
                .select("*")
                .eq(column_name, user_id)
                .eq("status", "pending")
                .order("created_at", desc=True)
                .execute()
            )
            if response.error:
                raise RuntimeError(
                    f"Supabase error fetching pending purchase requests: {response.error}"
                )

            request_rows = [row for row in (response.data or []) if isinstance(row, dict)]
            counterparty_ids = [
                row.get("buyer_id") if as_seller else row.get("seller_id")
                for row in request_rows
                if row.get("buyer_id") or row.get("seller_id")
            ]
            profile_map = self._fetch_profile_map(counterparty_ids)
            enriched_requests = [
                {
                    **row,
                    "counterparty": profile_map.get(row.get("buyer_id") if as_seller else row.get("seller_id")),
                }
                for row in request_rows
            ]

            return {
                "success": True,
                "user_id": user_id,
                "as_seller": as_seller,
                "total_pending": len(enriched_requests),
                "requests": enriched_requests,
            }
        except Exception as exc:
            return {"success": False, "error": str(exc), "user_id": user_id, "as_seller": as_seller}

    def get_purchase_request_history(
        self,
        user_id: str,
        status_filter: typing.Optional[str] = None,
        limit: int = 50,
    ) -> dict[str, typing.Any]:
        """
        Return historical green purchase requests for a user.

        Each request is enriched with the user's role in the request and the
        counterparty's basic profile details.
        """
        if user_id is None:
            return {"success": False, "error": "user_id is required"}

        try:
            limit = int(limit)
        except (TypeError, ValueError):
            return {"success": False, "error": "limit must be an integer", "user_id": user_id}

        if limit <= 0:
            return {"success": False, "error": "limit must be greater than 0", "user_id": user_id}

        try:
            if not self._user_exists(user_id):
                return {"success": False, "error": "User not found", "user_id": user_id}

            query = (
                self.supabase.table("green_purchase_requests")
                .select("*")
                .or_(f"buyer_id.eq.{user_id},seller_id.eq.{user_id}")
                .order("updated_at", desc=True)
                .limit(limit)
            )
            if status_filter:
                query = query.eq("status", status_filter)

            response = query.execute()
            if response.error:
                raise RuntimeError(
                    f"Supabase error fetching purchase request history: {response.error}"
                )

            request_rows = [row for row in (response.data or []) if isinstance(row, dict)]
            related_ids = []
            for row in request_rows:
                if row.get("buyer_id"):
                    related_ids.append(row.get("buyer_id"))
                if row.get("seller_id"):
                    related_ids.append(row.get("seller_id"))
            profile_map = self._fetch_profile_map(related_ids)
            enriched_requests = [
                self._enrich_purchase_request(row, profile_map, user_id=user_id)
                for row in request_rows
            ]

            return {
                "success": True,
                "user_id": user_id,
                "total": len(enriched_requests),
                "requests": enriched_requests,
            }
        except Exception as exc:
            return {"success": False, "error": str(exc), "user_id": user_id}

    def purchase_green_tokens(self, buyer_id, seller_id, amount_rs, month=None):
        """
        Handle a peer-to-peer green token purchase.

        Green purchases are capped at average monthly import / 2 for the buyer.
        The buyer pays the seller off-chain in rupees, while this method only
        updates token balances and audit records.
        """
        if buyer_id is None or seller_id is None:
            return {"success": False, "error": "buyer_id and seller_id are required"}
        if buyer_id == seller_id:
            return {"success": False, "error": "buyer_id and seller_id must be different"}
        if amount_rs is None:
            return {"success": False, "error": "amount_rs is required"}

        try:
            amount_rs = self._coerce_float(amount_rs, "amount_rs")
            if amount_rs <= 0:
                return {"success": False, "error": "amount_rs must be greater than 0"}

            if not self._user_exists(buyer_id):
                return {"success": False, "error": "Buyer not found", "buyer_id": buyer_id}
            if not self._user_exists(seller_id):
                return {"success": False, "error": "Seller not found", "seller_id": seller_id}

            month_start = self._normalize_month(month)

            yellow_amount = round(amount_rs, 2)
            green_tokens_received = round(amount_rs / (self.yellow_value_rs * 2), 2)
            total_after_purchase = 0.0

            buyer_meter = self.fetch_user_meter(buyer_id)
            if not buyer_meter:
                return {"success": False, "error": "Buyer meter not found", "buyer_id": buyer_id}

            buyer_meter_id = buyer_meter.get("id") or buyer_meter.get("meter_id")
            if not buyer_meter_id:
                return {"success": False, "error": "Buyer meter_id not found", "buyer_id": buyer_id}

            buyer_cap = round(float(self.calculate_green_cap(buyer_meter_id) or 0), 2)
            existing_purchases = round(float(self.get_monthly_green_purchases(buyer_id, month=month_start) or 0), 2)
            total_after_purchase = round(existing_purchases + green_tokens_received, 2)

            if total_after_purchase > buyer_cap:
                return {
                    "success": False,
                    "error": "Purchase exceeds green cap",
                    "cap_limit": buyer_cap,
                    "existing_purchases": existing_purchases,
                    "requested": green_tokens_received,
                    "available": max(0.0, round(buyer_cap - existing_purchases, 2)),
                    "buyer_id": buyer_id,
                    "seller_id": seller_id,
                    "amount_rs": amount_rs,
                }

            seller_wallet = self.fetch_wallet(seller_id)
            seller_yellow = float(seller_wallet.get("yellow_balance", 0))
            if seller_yellow < yellow_amount:
                return {
                    "success": False,
                    "error": "Seller has insufficient yellow balance",
                    "seller_id": seller_id,
                    "yellow_required": yellow_amount,
                    "yellow_available": seller_yellow,
                }

            self.fetch_wallet(buyer_id)

            seller_updated = False
            buyer_updated = False
            try:
                self.update_wallet_balances(seller_id, yellow_delta=-yellow_amount, red_delta=0, green_delta=0)
                seller_updated = True
                self.update_wallet_balances(buyer_id, yellow_delta=0, red_delta=0, green_delta=green_tokens_received)
                buyer_updated = True

                transaction_record = self.record_transaction(
                    sender_id=seller_id,
                    receiver_id=buyer_id,
                    token_type="green_purchase",
                    amount=green_tokens_received,
                    amount_rs=amount_rs,
                )

                green_purchase_record = self.record_green_purchase(
                    user_id=buyer_id,
                    month=month_start,
                    green_purchased=green_tokens_received,
                    kwh_covered=green_tokens_received,
                    amount_rs=amount_rs,
                )
            except Exception as exc:
                rollback_errors = []
                if buyer_updated:
                    try:
                        self.update_wallet_balances(
                            buyer_id,
                            yellow_delta=0,
                            red_delta=0,
                            green_delta=-green_tokens_received,
                        )
                    except Exception as rollback_exc:
                        rollback_errors.append(f"buyer rollback failed: {rollback_exc}")
                if seller_updated:
                    try:
                        self.update_wallet_balances(
                            seller_id,
                            yellow_delta=yellow_amount,
                            red_delta=0,
                            green_delta=0,
                        )
                    except Exception as rollback_exc:
                        rollback_errors.append(f"seller rollback failed: {rollback_exc}")

                error_message = str(exc)
                if rollback_errors:
                    error_message = f"{error_message}. Rollback issues: {'; '.join(rollback_errors)}"

                return {
                    "success": False,
                    "error": error_message,
                    "buyer_id": buyer_id,
                    "seller_id": seller_id,
                    "amount_rs": amount_rs,
                }

            buyer_balances = self.fetch_wallet(buyer_id)
            seller_balances = self.fetch_wallet(seller_id)

            return {
                "success": True,
                "buyer_id": buyer_id,
                "seller_id": seller_id,
                "amount_rs": amount_rs,
                "yellow_deducted_from_seller": yellow_amount,
                "green_added_to_buyer": green_tokens_received,
                "buyer_balances": buyer_balances,
                "seller_balances": seller_balances,
                "transaction_record": transaction_record,
                "green_purchase_record": green_purchase_record,
                "cap_status": {
                    "limit": buyer_cap,
                    "existing": existing_purchases,
                    "requested": green_tokens_received,
                    "remaining": max(0.0, round(buyer_cap - total_after_purchase, 2)),
                },
            }
        except Exception as exc:
            return {
                "success": False,
                "error": str(exc),
                "buyer_id": buyer_id,
                "seller_id": seller_id,
                "amount_rs": amount_rs,
            }

    def process_end_of_month_settlement(self, user_id, month=None):
        """
        Apply green tokens against red debt at month end.

        If month is omitted, the current UTC month is used.
        """
        if user_id is None:
            return {"success": False, "error": "user_id is required"}

        try:
            if not self._user_exists(user_id):
                return {"success": False, "error": "User not found", "user_id": user_id}

            month_start = self._normalize_month(month)
            wallet = self.fetch_wallet(user_id)

            red_balance = round(float(wallet.get("red_balance", 0) or 0), 2)
            green_balance = round(float(wallet.get("green_balance", 0) or 0), 2)

            if red_balance <= 0 or green_balance <= 0:
                return {
                    "success": True,
                    "user_id": user_id,
                    "month": self._month_to_string(month_start),
                    "green_used": 0.0,
                    "red_before": red_balance,
                    "red_after": red_balance,
                    "green_before": green_balance,
                    "green_after": green_balance,
                    "settlement_record": None,
                    "message": "No settlement needed",
                }

            green_to_use = round(min(green_balance, red_balance), 2)
            new_red_balance = round(red_balance - green_to_use, 2)
            new_green_balance = round(green_balance - green_to_use, 2)

            try:
                self.update_wallet_balances(
                    user_id,
                    red_delta=-green_to_use,
                    green_delta=-green_to_use,
                    yellow_delta=0,
                )

                settlement_record = self.record_transaction(
                    sender_id=user_id,
                    receiver_id=None,
                    token_type="monthly_settlement",
                    amount=green_to_use,
                    amount_rs=round(green_to_use * 2, 2),
                )
            except Exception as exc:
                rollback_error = None
                try:
                    self.update_wallet_balances(
                        user_id,
                        red_delta=green_to_use,
                        green_delta=green_to_use,
                        yellow_delta=0,
                    )
                except Exception as rollback_exc:
                    rollback_error = str(rollback_exc)

                error_message = str(exc)
                if rollback_error:
                    error_message = f"{error_message}. Rollback failed: {rollback_error}"

                return {
                    "success": False,
                    "error": error_message,
                    "user_id": user_id,
                    "month": self._month_to_string(month_start),
                }

            updated_wallet = self.fetch_wallet(user_id)

            return {
                "success": True,
                "user_id": user_id,
                "month": self._month_to_string(month_start),
                "green_used": green_to_use,
                "red_before": red_balance,
                "red_after": round(float(updated_wallet.get("red_balance", new_red_balance) or new_red_balance), 2),
                "green_before": green_balance,
                "green_after": round(float(updated_wallet.get("green_balance", new_green_balance) or new_green_balance), 2),
                "settlement_record": settlement_record,
            }
        except Exception as exc:
            return {
                "success": False,
                "error": str(exc),
                "user_id": user_id,
                "month": self._month_to_string(month) if month is not None else self._month_to_string(),
            }

    def process_all_users_end_of_month(self, month=None):
        """
        Run end-of-month settlement for every user and return a batch summary.

        Individual user failures are captured in the response and do not stop the batch.
        """
        try:
            month_start = self._normalize_month(month)
            results = []
            errors = []
            total_users_processed = 0
            total_green_used = 0.0
            total_red_remaining = 0.0

            users = self.fetch_all_users()
            for user in users:
                user_id = user.get("id") or user.get("user_id")
                if not user_id:
                    errors.append({"user": user, "error": "No user_id found"})
                    continue

                result = self.process_end_of_month_settlement(user_id, month=month_start)
                results.append(result)

                if result.get("success"):
                    total_users_processed += 1
                    total_green_used += float(result.get("green_used", 0) or 0)
                    total_red_remaining += float(result.get("red_after", 0) or 0)
                else:
                    errors.append({"user_id": user_id, "error": result.get("error", "Unknown error")})

            return {
                "success": len(errors) == 0,
                "month": self._month_to_string(month_start),
                "total_users_processed": total_users_processed,
                "total_green_used_across_all_users": round(total_green_used, 2),
                "total_red_remaining_across_all_users": round(total_red_remaining, 2),
                "results": results,
                "errors": errors,
            }
        except Exception as exc:
            return {
                "success": False,
                "month": self._month_to_string(month) if month is not None else self._month_to_string(),
                "total_users_processed": 0,
                "total_green_used_across_all_users": 0.0,
                "total_red_remaining_across_all_users": 0.0,
                "results": [],
                "errors": [{"error": str(exc)}],
            }

    def get_user_transaction_history(self, user_id, token_type=None, limit=50):
        """Return enriched transaction history for a user with optional token filtering."""
        if user_id is None:
            return {"success": False, "error": "user_id is required"}

        try:
            limit = int(limit)
        except (TypeError, ValueError):
            return {"success": False, "error": "limit must be an integer", "user_id": user_id}

        if limit <= 0:
            return {"success": False, "error": "limit must be greater than 0", "user_id": user_id}

        try:
            if not self._user_exists(user_id):
                return {"success": False, "error": "User not found", "user_id": user_id}

            fetch_limit = max(limit * 4, 100)
            response = (
                self.supabase.table("wallet_transactions")
                .select("*")
                .or_(f"user_id.eq.{user_id},counterparty_user_id.eq.{user_id}")
                .order("created_at", desc=True)
                .limit(fetch_limit)
                .execute()
            )
            if response.error:
                raise RuntimeError(f"Supabase error fetching transactions: {response.error}")

            preferred = {}
            fallback = {}

            for tx in response.data or []:
                normalized = self._normalize_transaction_row(tx)
                if not normalized:
                    continue

                if token_type and normalized.get("token_type") != token_type:
                    continue

                key = self._transaction_group_key(normalized)
                if normalized.get("ledger_user_id") == user_id:
                    preferred[key] = normalized
                elif key not in preferred and key not in fallback:
                    fallback[key] = normalized

            ordered = list(preferred.values())
            for key, item in fallback.items():
                if key not in preferred:
                    ordered.append(item)

            ordered.sort(key=lambda item: item.get("created_at") or "", reverse=True)

            enriched = []
            for tx in ordered[:limit]:
                sender_id = tx.get("sender_id")
                receiver_id = tx.get("receiver_id")

                if receiver_id is None:
                    direction = "system"
                elif sender_id == user_id:
                    direction = "sent"
                elif receiver_id == user_id:
                    direction = "received"
                else:
                    direction = "system"

                history_item = {
                    "id": tx.get("id"),
                    "sender_id": sender_id,
                    "receiver_id": receiver_id,
                    "token_type": tx.get("token_type"),
                    "amount": tx.get("amount"),
                    "amount_rs": tx.get("amount_rs"),
                    "description": tx.get("description"),
                    "status": tx.get("status"),
                    "created_at": tx.get("created_at"),
                    "direction": direction,
                }

                if direction == "system":
                    history_item["note"] = "Automatic monthly settlement applied green tokens to red debt."

                enriched.append(history_item)

            return {
                "success": True,
                "user_id": user_id,
                "total_transactions": len(enriched),
                "transactions": enriched,
            }
        except Exception as exc:
            return {"success": False, "error": str(exc), "user_id": user_id}

    def settle_bill(self, user_id):
        """Settle red debt using yellow and then green tokens."""
        if user_id is None:
            return {"success": False, "error": "user_id is required"}

        try:
            wallet = self.fetch_wallet(user_id)

            red_balance = float(wallet.get("red_balance", 0))
            if red_balance <= 0:
                return {"success": True, "message": "No red debt to settle", "user_id": user_id}

            yellow_available = float(wallet.get("yellow_balance", 0))
            green_available = float(wallet.get("green_balance", 0))

            yellow_used = min(red_balance, yellow_available)
            remaining = red_balance - yellow_used
            green_used = min(remaining, green_available)
            total_settled = yellow_used + green_used
            red_remaining = red_balance - total_settled

            # Apply updates
            self.update_wallet_balances(
                user_id,
                yellow_delta=-yellow_used,
                green_delta=-green_used,
                red_delta=-total_settled,
            )

            new_wallet = self.fetch_wallet(user_id)

            return {
                "success": True,
                "user_id": user_id,
                "yellow_used": yellow_used,
                "green_used": green_used,
                "total_settled": total_settled,
                "red_remaining": red_remaining,
                "new_balances": new_wallet,
            }

        except Exception as exc:
            return {"success": False, "error": str(exc), "user_id": user_id}

    def get_user_dashboard_data(self, user_id):
        """Fetch dashboard data for user, a collection of wallet/meter/transactions/summaries."""
        try:
            if user_id is None:
                raise ValueError("user_id is required")

            user_resp = (
                self.supabase.table("profiles")
                .select("id, full_name, email, phone")
                .eq("id", user_id)
                .single()
                .execute()
            )
            if user_resp.error and user_resp.status_code != 406:
                raise RuntimeError(f"Supabase error fetching user: {user_resp.error}")

            user_record = user_resp.data or {}
            if not user_record:
                return {"success": False, "error": "User not found", "user_id": user_id}

            wallet = self.fetch_wallet(user_id)
            meter = self.fetch_user_meter(user_id)
            transactions = self.fetch_transactions(user_id, limit=20)
            monthly_history = self.fetch_monthly_summaries(user_id, limit=12)

            meter_id = None
            if meter:
                meter_id = meter.get("id") or meter.get("meter_id")

            green_purchased_this_month = self.get_monthly_green_purchases(user_id)
            green_cap = 0.0
            if meter_id:
                green_cap = self.calculate_green_cap(meter_id)

            # Calculate remaining cap, no negative
            remaining_kwh = max(0.0, green_cap - float(green_purchased_this_month or 0.0))

            structured_transactions = []
            for tx in transactions or []:
                if not isinstance(tx, dict):
                    continue
                sender = tx.get("sender_id")
                receiver = tx.get("receiver_id")
                direction = "received" if receiver == user_id else "sent" if sender == user_id else "unknown"

                structured_transactions.append({
                    "id": tx.get("id"),
                    "type": direction,
                    "token_type": tx.get("token_type"),
                    "amount": tx.get("amount"),
                    "amount_rs": tx.get("amount_rs"),
                    "counterparty_id": sender if direction == "received" else receiver,
                    "date": tx.get("created_at") or tx.get("updated_at"),
                })

            return {
                "success": True,
                "timestamp": self._utc_now_iso(),
                "data": {
                    "user": {
                        "id": user_record.get("id"),
                        "name": user_record.get("full_name"),
                        "email": user_record.get("email"),
                        "tel": user_record.get("phone"),
                    },
                    "meter": {
                        "id": meter_id,
                        "location": meter.get("location") if meter else None,
                    },
                    "wallet": {
                        "yellow_balance": wallet.get("yellow_balance"),
                        "red_balance": wallet.get("red_balance"),
                        "green_balance": wallet.get("green_balance"),
                        "updated_at": wallet.get("updated_at"),
                    },
                    "token_config": {
                        "yellow_value_rs": self.yellow_value_rs,
                        "green_multiplier": 2.0,
                        "green_conversion_rate": 1.0,
                    },
                    "green_purchase": {
                        "cap_limit_kwh": green_cap,
                        "used_this_month_kwh": green_purchased_this_month,
                        "remaining_kwh": remaining_kwh,
                    },
                    "recent_transactions": structured_transactions,
                    "monthly_history": [
                        {
                            "month": rec.get("month"),
                            "import_kwh": rec.get("import_kwh"),
                            "export_kwh": rec.get("export_kwh"),
                            "net_kwh": rec.get("net_kwh"),
                            "yellow_awarded": rec.get("yellow_awarded"),
                            "red_awarded": rec.get("red_awarded"),
                        }
                        for rec in (monthly_history or [])
                        if isinstance(rec, dict)
                    ],
                },
            }

        except Exception as exc:
            return {"success": False, "error": str(exc), "user_id": user_id}

    def get_all_users_summary(self):
        """Fetch all users with aggregated wallet and meter data, return system-wide statistics."""
        try:
            users = self.fetch_all_users()
            if not users:
                return {
                "success": True,
                    "timestamp": self._utc_now_iso(),
                    "statistics": {
                        "total_users": 0,
                        "total_yellow_circulation_kwh": 0.0,
                        "total_red_debt_kwh": 0.0,
                        "total_green_circulation_kwh": 0.0,
                        "net_system_position_kwh": 0.0,
                    },
                    "users": [],
                }

            wallets_by_user = {
                wallet.get("user_id"): wallet
                for wallet in self.fetch_all_wallets()
                if wallet and wallet.get("user_id")
            }
            meters_by_user = {}
            for meter in self.fetch_all_meters():
                if not meter:
                    continue
                user_id = meter.get("user_id")
                if user_id and user_id not in meters_by_user:
                    meters_by_user[user_id] = meter

            total_yellow = 0.0
            total_red = 0.0
            total_green = 0.0
            users_list = []

            for user in users:
                if not user:
                    continue

                user_id = user.get("id") or user.get("user_id")
                if not user_id:
                    continue

                user_name = user.get("name", "")
                user_email = user.get("email", "")
                user_tel = user.get("tel", "")

                wallet = wallets_by_user.get(user_id)
                meter = meters_by_user.get(user_id)

                if not wallet:
                    continue

                yellow_bal = float(wallet.get("yellow_balance", 0))
                red_bal = float(wallet.get("red_balance", 0))
                green_bal = float(wallet.get("green_balance", 0))

                total_yellow += yellow_bal
                total_red += red_bal
                total_green += green_bal

                meter_location = None
                if meter:
                    meter_location = meter.get("location")

                user_entry = {
                    "user_id": user_id,
                    "name": user_name,
                    "email": user_email,
                    "tel": user_tel,
                    "meter_location": meter_location,
                    "wallet": {
                        "yellow_balance": yellow_bal,
                        "red_balance": red_bal,
                        "green_balance": green_bal,
                    },
                }
                users_list.append(user_entry)

            net_system_position = total_yellow - total_red

            return {
                "success": True,
                "timestamp": self._utc_now_iso(),
                "statistics": {
                    "total_users": len(users_list),
                    "total_yellow_circulation_kwh": total_yellow,
                    "total_red_debt_kwh": total_red,
                    "total_green_circulation_kwh": total_green,
                    "net_system_position_kwh": net_system_position,
                },
                "users": users_list,
            }

        except Exception as exc:
            return {"success": False, "error": str(exc)}

    def get_energy_readings_for_month(self, month):
        """Fetch all energy readings for a given month with meter info (user_id, location)."""
        if month is None:
            return {"success": False, "error": "month is required"}

        if not isinstance(month, (datetime.date, datetime.datetime)):
            return {"success": False, "error": "month must be a date or datetime object"}

        try:
            # Calculate month boundaries
            month_start = datetime.datetime(month.year, month.month, 1)
            if month.month == 12:
                month_end = datetime.datetime(month.year + 1, 1, 1)
            else:
                month_end = datetime.datetime(month.year, month.month + 1, 1)

            # Fetch all meters and build meter_id -> {user_id, location} mapping
            try:
                meters_response = self.supabase.table("meters").select("id, meter_id, user_id, location").execute()
                if meters_response.error:
                    raise RuntimeError(f"Supabase error fetching meters: {meters_response.error}")
                meters_data = meters_response.data or []
            except Exception as exc:
                raise RuntimeError(f"Error fetching meters: {exc}") from exc

            meter_map = {}
            for meter_record in meters_data:
                if not meter_record:
                    continue
                meter_id = meter_record.get("id") or meter_record.get("meter_id")
                user_id = meter_record.get("user_id")
                location = meter_record.get("location")
                if meter_id:
                    meter_map[meter_id] = {"user_id": user_id, "location": location}

            # Fetch all energy readings for the month
            try:
                readings_response = (
                    self.supabase.table("energy_readings")
                    .select("*")
                    .gte("reading_date", month_start.isoformat())
                    .lt("reading_date", month_end.isoformat())
                    .order("reading_date", desc=False)
                    .execute()
                )
                if readings_response.error:
                    raise RuntimeError(f"Supabase error fetching energy readings: {readings_response.error}")
                readings_data = readings_response.data or []
            except Exception as exc:
                raise RuntimeError(f"Error fetching energy readings: {exc}") from exc

            # Enrich readings with meter metadata
            enriched_readings = []
            for reading in readings_data:
                if not reading:
                    continue
                meter_id = reading.get("meter_id")
                meter_info = meter_map.get(meter_id, {})

                enriched_reading = {
                    "id": reading.get("id"),
                    "meter_id": meter_id,
                    "user_id": meter_info.get("user_id"),
                    "location": meter_info.get("location"),
                    "reading_date": reading.get("reading_date"),
                    "import_kwh": reading.get("import_kwh"),
                    "export_kwh": reading.get("export_kwh"),
                    "created_at": reading.get("created_at"),
                    "updated_at": reading.get("updated_at"),
                }
                enriched_readings.append(enriched_reading)

            return {
                "success": True,
                "month": month.isoformat() if isinstance(month, datetime.date) else str(month),
                "total_readings": len(enriched_readings),
                "readings": enriched_readings,
                "timestamp": self._utc_now_iso(),
            }

        except Exception as exc:
            return {"success": False, "error": str(exc), "month": month.isoformat() if isinstance(month, datetime.date) else str(month)}


if __name__ == "__main__":
    engine = CEBTokenEngine()
    
    print("Fetching all users summary...")
    result = engine.get_all_users_summary()
    
    if result.get("success"):
        stats = result.get("statistics", {})
        print(f"  Total Users: {stats.get('total_users')}")
        print(f"  Total Yellow Circulation (kWh): {stats.get('total_yellow_circulation_kwh')}")
        print(f"  Total Red Debt (kWh): {stats.get('total_red_debt_kwh')}")
    else:
        print(f"  Error: {result.get('error')}")

