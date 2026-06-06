"""90-day whole-blood donation eligibility window.

Uses next_eligible_date from clean.csv when present; otherwise estimates from
last_donation_date + 90 days. Returns days until eligible and a boolean.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Optional

import pandas as pd

WHOLE_BLOOD_INTERVAL = 90


def _parse_date(val) -> Optional[date]:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    try:
        return pd.Timestamp(val).date()
    except Exception:
        return None


def days_until_eligible(donor: dict, ref: Optional[date] = None) -> int:
    """Days until donor can donate again. 0 = eligible now. Negative = overdue (eligible)."""
    ref = ref or date.today()
    ned = _parse_date(donor.get("next_eligible_date"))
    if ned:
        return (ned - ref).days

    last = _parse_date(donor.get("last_donation_date"))
    if last:
        return (last + timedelta(days=WHOLE_BLOOD_INTERVAL) - ref).days

    # No donation history → assume eligible
    return 0


def is_eligible(donor: dict, ref: Optional[date] = None) -> bool:
    return days_until_eligible(donor, ref) <= 0


def next_eligible_date(donor: dict) -> Optional[date]:
    """Absolute date when donor becomes eligible, or None if already eligible."""
    d = days_until_eligible(donor)
    if d <= 0:
        return None
    return date.today() + timedelta(days=d)
