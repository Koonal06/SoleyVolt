#!/usr/bin/env python3
from __future__ import annotations

import argparse
import calendar
import json
import os
import sys
from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any
from urllib import error, parse, request

from ceb_legacy_logic import calculate_monthly_result, decimalize, round3


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def load_env_file(path: Path) -> None:
    if not path.exists():
        return

    for line in path.read_text(encoding="utf-8").splitlines():
        raw = line.strip()
        if not raw or raw.startswith("#") or "=" not in raw:
            continue
        key, value = raw.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'").strip('"')
        os.environ.setdefault(key, value)


def load_local_env() -> None:
    root = Path(__file__).resolve().parents[1]
    load_env_file(root / ".env.server")
    load_env_file(root / ".env")


def add_months(anchor: date, months: int) -> date:
    month_index = (anchor.month - 1) + months
    year = anchor.year + month_index // 12
    month = (month_index % 12) + 1
    day = min(anchor.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def derive_period_dates(anchor: date, billing_cycle: int) -> tuple[date, date]:
    period_start = add_months(anchor, billing_cycle - 1)
    period_end = add_months(period_start, 1)
    period_end = date.fromordinal(period_end.toordinal() - 1)
    return period_start, period_end


@dataclass
class CoinSettings:
    red_coin_rate: Decimal
    yellow_coin_rate: Decimal
    yellow_coin_bill_offset_rate: Decimal
    green_coin_unit_price: Decimal
    green_coin_bill_offset_rate: Decimal


class SupabaseRestClient:
    def __init__(self, base_url: str, api_key: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key

    def _headers(self, extra: dict[str, str] | None = None) -> dict[str, str]:
        headers = {
            "apikey": self.api_key,
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        if extra:
            headers.update(extra)
        return headers

    def request_json(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, str] | None = None,
        payload: Any | None = None,
        headers: dict[str, str] | None = None,
    ) -> Any:
        url = f"{self.base_url}{path}"
        if params:
            url = f"{url}?{parse.urlencode(params)}"

        body = None
        if payload is not None:
            body = json.dumps(payload).encode("utf-8")

        req = request.Request(
            url,
            data=body,
            headers=self._headers(headers),
            method=method,
        )

        try:
            with request.urlopen(req) as response:
                raw = response.read().decode("utf-8")
                if not raw:
                    return None
                return json.loads(raw)
        except error.HTTPError as exc:
            details = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"{method} {url} failed: {exc.code} {details}") from exc

    def select(
        self,
        table: str,
        *,
        select: str,
        filters: dict[str, str] | None = None,
        order: str | None = None,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        params = {"select": select}
        if filters:
            params.update(filters)
        if order:
            params["order"] = order
        if limit is not None:
            params["limit"] = str(limit)
        return self.request_json("GET", f"/rest/v1/{table}", params=params) or []

    def patch(self, table: str, filters: dict[str, str], payload: dict[str, Any]) -> list[dict[str, Any]]:
        return self.request_json(
            "PATCH",
            f"/rest/v1/{table}",
            params=filters,
            payload=payload,
            headers={"Prefer": "return=representation"},
        ) or []

    def upsert(
        self,
        table: str,
        rows: list[dict[str, Any]],
        *,
        on_conflict: str,
    ) -> list[dict[str, Any]]:
        return self.request_json(
            "POST",
            f"/rest/v1/{table}",
            params={"on_conflict": on_conflict},
            payload=rows,
            headers={"Prefer": "resolution=merge-duplicates,return=representation"},
        ) or []

    def insert(self, table: str, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return self.request_json(
            "POST",
            f"/rest/v1/{table}",
            payload=rows,
            headers={"Prefer": "return=representation"},
        ) or []


def load_client() -> SupabaseRestClient:
    load_local_env()
    supabase_url = os.environ.get("SUPABASE_URL")
    api_key = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not api_key:
        raise RuntimeError("Missing SUPABASE_URL and SUPABASE_KEY or SUPABASE_SERVICE_ROLE_KEY.")

    return SupabaseRestClient(supabase_url, api_key)


def fetch_coin_settings(client: SupabaseRestClient) -> CoinSettings:
    rows = client.select(
        "coin_settings",
        select="red_coin_rate,yellow_coin_rate,yellow_coin_bill_offset_rate,green_coin_unit_price,green_coin_bill_offset_rate",
        filters={"id": "eq.true"},
        limit=1,
    )
    if not rows:
        raise RuntimeError("coin_settings row not found.")

    row = rows[0]
    return CoinSettings(
        red_coin_rate=decimalize(row["red_coin_rate"]),
        yellow_coin_rate=decimalize(row["yellow_coin_rate"]),
        yellow_coin_bill_offset_rate=decimalize(row["yellow_coin_bill_offset_rate"]),
        green_coin_unit_price=decimalize(row["green_coin_unit_price"]),
        green_coin_bill_offset_rate=decimalize(row["green_coin_bill_offset_rate"]),
    )


def fetch_import_rows(client: SupabaseRestClient, statuses: list[str], limit: int) -> list[dict[str, Any]]:
    joined = ",".join(statuses)
    return client.select(
        "energy_readings_import",
        select=(
            "id,source_file_name,dataset_user_code,dataset_user_type,meter_id,billing_cycle,"
            "reading_date,period_start,period_end,imported_kwh,exported_kwh,linked_user_id,"
            "processing_status,calculation_version"
        ),
        filters={"processing_status": f"in.({joined})"},
        order="billing_cycle.asc,dataset_user_code.asc",
        limit=limit,
    )


def fetch_import_history(client: SupabaseRestClient) -> list[dict[str, Any]]:
    return client.select(
        "energy_readings_import",
        select=(
            "id,dataset_user_code,meter_id,billing_cycle,reading_date,period_start,period_end,"
            "imported_kwh,exported_kwh,linked_user_id,processing_status"
        ),
        order="meter_id.asc,billing_cycle.asc",
        limit=5000,
    )


def fetch_green_purchased_kwh(
    client: SupabaseRestClient,
    *,
    linked_user_id: str | None,
    period_start: str | None,
    period_end: str | None,
) -> Decimal:
    if not linked_user_id:
        return Decimal("0.000")

    filters = {
        "user_id": f"eq.{linked_user_id}",
        "status": "eq.completed",
    }
    clauses: list[str] = []
    if period_start:
        clauses.append(f"created_at.gte.{period_start}T00:00:00+00:00")
    if period_end:
        clauses.append(f"created_at.lte.{period_end}T23:59:59+00:00")
    if clauses:
        filters["and"] = f"({','.join(clauses)})"

    rows = client.select(
        "green_coin_purchases",
        select="green_coins,created_at",
        filters=filters,
        limit=500,
    )
    total = Decimal("0.000")
    for item in rows:
        total += decimalize(item.get("green_coins"))
    return round3(total)


def calculate_row(
    row: dict[str, Any],
    *,
    settings: CoinSettings,
    meter_history: list[dict[str, Any]],
    green_purchased_kwh: Decimal,
) -> dict[str, Any]:
    current_cycle = int(row["billing_cycle"])
    history_imports = [
        item.get("imported_kwh")
        for item in meter_history
        if int(item.get("billing_cycle", 0) or 0) <= current_cycle
    ]
    calculated = calculate_monthly_result(
        imported_kwh=row["imported_kwh"],
        exported_kwh=row["exported_kwh"],
        history_imports=history_imports,
        green_purchased_kwh=green_purchased_kwh,
        red_coin_rate=settings.red_coin_rate,
    )

    return {
        "imported_kwh": calculated.imported_kwh,
        "exported_kwh": calculated.exported_kwh,
        "net_kwh": calculated.net_kwh,
        "yellow_tokens": calculated.yellow_tokens,
        "red_tokens": calculated.red_tokens,
        "tokens_earned": calculated.tokens_earned,
        "green_cap_kwh": calculated.green_cap_kwh,
        "green_purchased_kwh": calculated.green_purchased_kwh,
        "remaining_green_cap_kwh": calculated.remaining_green_cap_kwh,
        "settlement_required_kwh": calculated.settlement_required_kwh,
        "estimated_bill": calculated.estimated_bill,
        "reward_tier": calculated.reward_tier,
        "formula": calculated.formula,
    }


def normalize_date(value: Any) -> str | None:
    if value in (None, ""):
        return None
    return str(value)


def derive_dates_for_row(row: dict[str, Any], anchor_date: date | None) -> tuple[str | None, str | None, str | None]:
    reading_date = normalize_date(row.get("reading_date"))
    period_start = normalize_date(row.get("period_start"))
    period_end = normalize_date(row.get("period_end"))

    if anchor_date is None:
        return reading_date, period_start, period_end

    start, end = derive_period_dates(anchor_date, int(row["billing_cycle"]))
    reading_date = reading_date or end.isoformat()
    period_start = period_start or start.isoformat()
    period_end = period_end or end.isoformat()
    return reading_date, period_start, period_end


def promote_energy_reading(
    client: SupabaseRestClient,
    row: dict[str, Any],
    calculated: dict[str, Any],
    reading_date: str | None,
) -> None:
    linked_user_id = row.get("linked_user_id")
    if not linked_user_id or not reading_date:
        return

    note = (
        f"Promoted from {row['source_file_name']} "
        f"(dataset_user_code={row['dataset_user_code']}, billing_cycle={row['billing_cycle']})"
    )
    client.upsert(
        "energy_readings",
        [
            {
                "user_id": linked_user_id,
                "reading_date": reading_date,
                "imported_kwh": float(calculated["imported_kwh"]),
                "exported_kwh": float(calculated["exported_kwh"]),
                "tokens_earned": float(calculated["tokens_earned"]),
                "notes": note,
            }
        ],
        on_conflict="user_id,reading_date",
    )


def process_rows(
    client: SupabaseRestClient,
    *,
    rows: list[dict[str, Any]],
    settings: CoinSettings,
    history_rows: list[dict[str, Any]],
    calculation_version: str,
    trigger_source: str,
    anchor_date: date | None,
    promote: bool,
    dry_run: bool,
) -> dict[str, Any]:
    successful = 0
    failed = 0
    promoted = 0
    errors: list[dict[str, Any]] = []
    history_by_meter: dict[str, list[dict[str, Any]]] = {}
    for item in history_rows:
        meter_id = item.get("meter_id")
        if not meter_id:
            continue
        history_by_meter.setdefault(str(meter_id), []).append(item)

    for row in rows:
        reading_date, period_start, period_end = derive_dates_for_row(row, anchor_date)
        green_purchased_kwh = fetch_green_purchased_kwh(
            client,
            linked_user_id=row.get("linked_user_id"),
            period_start=period_start,
            period_end=period_end,
        )
        calculated = calculate_row(
            row,
            settings=settings,
            meter_history=history_by_meter.get(str(row.get("meter_id")), []),
            green_purchased_kwh=green_purchased_kwh,
        )
        now_iso = utc_now_iso()

        calculation_payload = {
            "import_id": row["id"],
            "linked_user_id": row.get("linked_user_id"),
            "calculation_version": calculation_version,
            "logic_name": "ceb_legacy_port",
            "net_kwh": float(calculated["net_kwh"]),
            "tokens_earned": float(calculated["tokens_earned"]),
            "estimated_bill": float(calculated["estimated_bill"]),
            "yellow_tokens": float(calculated["yellow_tokens"]),
            "red_tokens": float(calculated["red_tokens"]),
            "green_cap_kwh": float(calculated["green_cap_kwh"]),
            "green_purchased_kwh": float(calculated["green_purchased_kwh"]),
            "remaining_green_cap_kwh": float(calculated["remaining_green_cap_kwh"]),
            "settlement_required_kwh": float(calculated["settlement_required_kwh"]),
            "reward_tier": calculated["reward_tier"],
            "result_payload": {
                "imported_kwh": float(calculated["imported_kwh"]),
                "exported_kwh": float(calculated["exported_kwh"]),
                "yellow_tokens": float(calculated["yellow_tokens"]),
                "red_tokens": float(calculated["red_tokens"]),
                "green_cap_kwh": float(calculated["green_cap_kwh"]),
                "green_purchased_kwh": float(calculated["green_purchased_kwh"]),
                "remaining_green_cap_kwh": float(calculated["remaining_green_cap_kwh"]),
                "settlement_required_kwh": float(calculated["settlement_required_kwh"]),
                "formula": {
                    "yellow_tokens": "max(exported_kwh - imported_kwh, 0)",
                    "red_tokens": "max(imported_kwh - exported_kwh, 0)",
                    "green_cap_kwh": "average(last_3_imported_kwh_including_current_cycle) / 2",
                    "estimated_bill": "max(red_tokens - green_purchased_kwh, 0) * red_coin_rate",
                },
            },
        }

        import_patch = {
            "reading_date": reading_date,
            "period_start": period_start,
            "period_end": period_end,
            "processing_status": "promoted" if promote and row.get("linked_user_id") and reading_date else "calculated",
            "calculation_version": calculation_version,
            "net_kwh": float(calculated["net_kwh"]),
            "tokens_earned": float(calculated["tokens_earned"]),
            "yellow_tokens": float(calculated["yellow_tokens"]),
            "red_tokens": float(calculated["red_tokens"]),
            "green_cap_kwh": float(calculated["green_cap_kwh"]),
            "green_purchased_kwh": float(calculated["green_purchased_kwh"]),
            "remaining_green_cap_kwh": float(calculated["remaining_green_cap_kwh"]),
            "settlement_required_kwh": float(calculated["settlement_required_kwh"]),
            "estimated_bill": float(calculated["estimated_bill"]),
            "processing_error": None,
            "calculated_at": now_iso,
            "promoted_at": now_iso if promote and row.get("linked_user_id") and reading_date else None,
        }

        if dry_run:
            print(
                json.dumps(
                    {
                        "import_id": row["id"],
                        "dataset_user_code": row["dataset_user_code"],
                        "billing_cycle": row["billing_cycle"],
                        "reading_date": reading_date,
                        "calculation": calculation_payload,
                        "import_patch": import_patch,
                    },
                    indent=2,
                )
            )
            successful += 1
            if promote and row.get("linked_user_id") and reading_date:
                promoted += 1
            continue

        client.patch(
            "energy_readings_import",
            {"id": f"eq.{row['id']}"},
            {"processing_status": "processing", "processing_error": None},
        )

        try:
            client.upsert(
                "energy_calculations",
                [calculation_payload],
                on_conflict="import_id,calculation_version",
            )

            if promote:
                promote_energy_reading(client, row, calculated, reading_date)
                if row.get("linked_user_id") and reading_date:
                    promoted += 1

            client.patch("energy_readings_import", {"id": f"eq.{row['id']}"}, import_patch)
        except Exception as exc:  # noqa: BLE001
            client.patch(
                "energy_readings_import",
                {"id": f"eq.{row['id']}"},
                {
                    "processing_status": "failed",
                    "processing_error": str(exc)[:1000],
                },
            )
            failed += 1
            errors.append(
                {
                    "import_id": row["id"],
                    "dataset_user_code": row["dataset_user_code"],
                    "billing_cycle": row["billing_cycle"],
                    "error": str(exc),
                    "trigger_source": trigger_source,
                }
            )
            continue

        successful += 1

    return {
        "rows_considered": len(rows),
        "processed_count": successful,
        "failed_count": failed,
        "promoted_count": promoted,
        "errors": errors,
    }


def start_pipeline_run(
    client: SupabaseRestClient,
    *,
    trigger_source: str,
    statuses: list[str],
    calculation_version: str,
    anchor_date: date | None,
    promote: bool,
    dry_run: bool,
    limit: int,
) -> str | None:
    try:
        rows = client.insert(
            "energy_pipeline_runs",
            [
                {
                    "trigger_source": trigger_source,
                    "status": "running",
                    "calculation_version": calculation_version,
                    "statuses_filter": statuses,
                    "promote": promote,
                    "dry_run": dry_run,
                    "anchor_date": anchor_date.isoformat() if anchor_date else None,
                    "metadata": {
                        "limit": limit,
                    },
                }
            ],
        )
        return rows[0]["id"] if rows else None
    except Exception as exc:  # noqa: BLE001
        print(f"Warning: unable to log pipeline run start: {exc}", file=sys.stderr)
        return None


def finish_pipeline_run(
    client: SupabaseRestClient,
    run_id: str | None,
    *,
    status: str,
    rows_considered: int,
    processed_count: int,
    failed_count: int,
    promoted_count: int,
    error_summary: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    if not run_id:
        return

    try:
        payload = {
            "status": status,
            "rows_considered": rows_considered,
            "processed_count": processed_count,
            "failed_count": failed_count,
            "promoted_count": promoted_count,
            "completed_at": utc_now_iso(),
            "error_summary": error_summary,
            "metadata": metadata or {},
        }
        client.patch("energy_pipeline_runs", {"id": f"eq.{run_id}"}, payload)
    except Exception as exc:  # noqa: BLE001
        print(f"Warning: unable to log pipeline run completion: {exc}", file=sys.stderr)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Calculate and optionally promote energy data from energy_readings_import.",
    )
    parser.add_argument("--limit", type=int, default=100, help="Maximum number of import rows to process.")
    parser.add_argument(
        "--statuses",
        default="pending,failed",
        help="Comma-separated import statuses to process.",
    )
    parser.add_argument(
        "--calculation-version",
        default=os.environ.get("ENERGY_CALCULATION_VERSION", "python-v1"),
        help="Version label stored in energy_calculations and energy_readings_import.",
    )
    parser.add_argument(
        "--anchor-date",
        help="Optional YYYY-MM-DD anchor used to map billing_cycle to period_start/period_end and reading_date.",
    )
    parser.add_argument(
        "--promote",
        action="store_true",
        help="Also upsert mapped rows into energy_readings when linked_user_id and a reading date are available.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print calculated payloads without writing to Supabase.",
    )
    parser.add_argument(
        "--trigger-source",
        default=os.environ.get("PIPELINE_TRIGGER_SOURCE", "manual"),
        help="Source label stored with pipeline run logs.",
    )
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    anchor_date = date.fromisoformat(args.anchor_date) if args.anchor_date else None
    statuses = [status.strip() for status in args.statuses.split(",") if status.strip()]
    if not statuses:
        parser.error("At least one status is required.")

    client = load_client()
    run_id = start_pipeline_run(
        client,
        trigger_source=args.trigger_source,
        statuses=statuses,
        calculation_version=args.calculation_version,
        anchor_date=anchor_date,
        promote=args.promote,
        dry_run=args.dry_run,
        limit=args.limit,
    )
    settings = fetch_coin_settings(client)
    rows = fetch_import_rows(client, statuses=statuses, limit=args.limit)
    history_rows = fetch_import_history(client)

    if not rows:
        print("No import rows matched the requested statuses.")
        finish_pipeline_run(
            client,
            run_id,
            status="skipped",
            rows_considered=0,
            processed_count=0,
            failed_count=0,
            promoted_count=0,
            metadata={"message": "No import rows matched the requested statuses."},
        )
        return 0

    summary = process_rows(
        client,
        rows=rows,
        settings=settings,
        history_rows=history_rows,
        calculation_version=args.calculation_version,
        trigger_source=args.trigger_source,
        anchor_date=anchor_date,
        promote=args.promote,
        dry_run=args.dry_run,
    )

    status = "completed_with_errors" if summary["failed_count"] > 0 else "completed"
    finish_pipeline_run(
        client,
        run_id,
        status=status,
        rows_considered=summary["rows_considered"],
        processed_count=summary["processed_count"],
        failed_count=summary["failed_count"],
        promoted_count=summary["promoted_count"],
        error_summary=summary["errors"][0]["error"][:1000] if summary["errors"] else None,
        metadata={"errors": summary["errors"][:10]},
    )

    print(
        "Processed "
        f"{summary['processed_count']} row(s)"
        f", promoted {summary['promoted_count']} row(s)"
        f", failed {summary['failed_count']} row(s)."
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # noqa: BLE001
        print(f"energy_pipeline.py failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
