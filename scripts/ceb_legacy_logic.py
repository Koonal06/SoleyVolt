from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Iterable


TWOPLACES = Decimal("0.01")
THREEPLACES = Decimal("0.001")


def decimalize(value: Any) -> Decimal:
    return Decimal(str(value or 0))


def round2(value: Decimal) -> Decimal:
    return value.quantize(TWOPLACES, rounding=ROUND_HALF_UP)


def round3(value: Decimal) -> Decimal:
    return value.quantize(THREEPLACES, rounding=ROUND_HALF_UP)


def classify_reward_tier(net_kwh: Decimal) -> str:
    if net_kwh > 0:
        return "surplus"
    if net_kwh < 0:
        return "deficit"
    return "balanced"


def calculate_net_energy(import_kwh: Decimal, export_kwh: Decimal) -> tuple[Decimal, Decimal, Decimal]:
    net_kwh = round3(export_kwh - import_kwh)
    if net_kwh > 0:
        return net_kwh, round2(net_kwh), Decimal("0.00")
    if net_kwh < 0:
        return net_kwh, Decimal("0.00"), round2(abs(net_kwh))
    return net_kwh, Decimal("0.00"), Decimal("0.00")


def calculate_green_cap(history_imports: Iterable[Any]) -> Decimal:
    eligible = [round3(max(decimalize(value), Decimal("0"))) for value in history_imports]
    if not eligible:
        return Decimal("0.000")
    recent = eligible[-3:]
    average_import = sum(recent, Decimal("0.000")) / Decimal(len(recent))
    return round3(average_import / Decimal("2"))


@dataclass(frozen=True)
class LegacyMonthlyCalculation:
    imported_kwh: Decimal
    exported_kwh: Decimal
    net_kwh: Decimal
    yellow_tokens: Decimal
    red_tokens: Decimal
    tokens_earned: Decimal
    green_cap_kwh: Decimal
    green_purchased_kwh: Decimal
    remaining_green_cap_kwh: Decimal
    settlement_required_kwh: Decimal
    estimated_bill: Decimal
    reward_tier: str

    @property
    def formula(self) -> dict[str, str]:
        return {
            "yellow_tokens": "max(exported_kwh - imported_kwh, 0)",
            "red_tokens": "max(imported_kwh - exported_kwh, 0)",
            "green_cap_kwh": "average(last_3_imported_kwh_including_current_cycle) / 2",
            "estimated_bill": "max(red_tokens - green_purchased_kwh, 0) * red_coin_rate",
        }


def calculate_monthly_result(
    *,
    imported_kwh: Any,
    exported_kwh: Any,
    history_imports: Iterable[Any],
    green_purchased_kwh: Any,
    red_coin_rate: Any,
) -> LegacyMonthlyCalculation:
    imported = round3(max(decimalize(imported_kwh), Decimal("0")))
    exported = round3(max(decimalize(exported_kwh), Decimal("0")))
    green_purchased = round3(max(decimalize(green_purchased_kwh), Decimal("0")))
    red_rate = decimalize(red_coin_rate)

    net_kwh, yellow_tokens, red_tokens = calculate_net_energy(imported, exported)
    green_cap_kwh = calculate_green_cap(history_imports)
    remaining_green_cap_kwh = round3(max(green_cap_kwh - green_purchased, Decimal("0")))
    settlement_required_kwh = round3(max(red_tokens - green_purchased, Decimal("0")))
    estimated_bill = round2(settlement_required_kwh * red_rate)

    return LegacyMonthlyCalculation(
        imported_kwh=imported,
        exported_kwh=exported,
        net_kwh=net_kwh,
        yellow_tokens=yellow_tokens,
        red_tokens=red_tokens,
        tokens_earned=yellow_tokens,
        green_cap_kwh=green_cap_kwh,
        green_purchased_kwh=green_purchased,
        remaining_green_cap_kwh=remaining_green_cap_kwh,
        settlement_required_kwh=settlement_required_kwh,
        estimated_bill=estimated_bill,
        reward_tier=classify_reward_tier(net_kwh),
    )
