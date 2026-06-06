"""Clean the provided Dataset.csv into a model-ready table.

Output: data/clean.csv  (used by notebooks/train_models.py and DynamoDB seeding)

Run:  .venv/bin/python scripts/clean_data.py
"""
from __future__ import annotations

import os
import re

import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(HERE, "Dataset.csv")
OUT_DIR = os.path.join(HERE, "data")
OUT = os.path.join(OUT_DIR, "clean.csv")

# Snapshot "today" for recency features. Dataset dates run into late 2025,
# so we anchor to the max date in the file to keep recency non-negative.
DATE_COLS = [
    "last_transfusion_date",
    "expected_next_transfusion_date",
    "registration_date",
    "last_contacted_date",
    "last_donation_date",
    "next_eligible_date",
    "last_bridge_donation_date",
]

_HEX_PREFIX = re.compile(r"^\\x[0-9a-fA-F]{2}")


def _strip_id(val):
    """IDs come in as e.g. \\x27682386... — drop the leading hex escape."""
    if pd.isna(val):
        return val
    return _HEX_PREFIX.sub("", str(val)).strip()


def main() -> None:
    df = pd.read_csv(RAW, low_memory=False)
    print(f"raw: {df.shape[0]} rows x {df.shape[1]} cols")

    # --- clean id columns ---
    for c in ("user_id", "bridge_id"):
        if c in df.columns:
            df[c] = df[c].map(_strip_id)

    # --- parse dates ---
    for c in DATE_COLS:
        if c in df.columns:
            df[c] = pd.to_datetime(df[c], errors="coerce")

    snapshot = max(df[c].max() for c in DATE_COLS if c in df.columns)
    print(f"snapshot date (anchor for recency): {snapshot.date()}")

    # --- recency features (days since ...) ---
    df["days_since_last_donation"] = (snapshot - df["last_donation_date"]).dt.days
    df["days_since_last_contact"] = (snapshot - df["last_contacted_date"]).dt.days
    df["days_to_next_eligible"] = (df["next_eligible_date"] - snapshot).dt.days

    # --- numeric coercion ---
    num_cols = [
        "donations_till_date", "cycle_of_donations", "total_calls",
        "frequency_in_days", "quantity_required", "calls_to_donations_ratio",
        "latitude", "longitude",
    ]
    for c in num_cols:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce")

    # --- booleans ---
    for c in ("role_status", "bridge_status", "donated_earlier", "status_of_bridge"):
        if c in df.columns:
            df[c] = df[c].astype(str).str.lower().map(
                {"true": 1, "false": 0, "active": 1, "inactive": 0}
            )

    # --- targets ---
    # Model B (churn): user_donation_active_status -> 1 = Inactive (the risk)
    df["target_churn"] = (
        df["user_donation_active_status"].astype(str).str.strip().str.lower()
        == "inactive"
    ).astype(int)

    # Model A (willingness proxy): has the donor actually donated before?
    # donated_earlier + donations_till_date give a usable propensity label.
    df["target_willing"] = (
        (df.get("donated_earlier", 0).fillna(0) == 1)
        | (df["donations_till_date"].fillna(0) > 0)
    ).astype(int)

    # --- fill obvious NaNs for model features ---
    fill_zero = [
        "donations_till_date", "cycle_of_donations", "total_calls",
        "frequency_in_days", "calls_to_donations_ratio",
        "days_since_last_donation", "days_since_last_contact",
    ]
    for c in fill_zero:
        if c in df.columns:
            df[c] = df[c].replace([np.inf, -np.inf], np.nan).fillna(0)

    os.makedirs(OUT_DIR, exist_ok=True)
    df.to_csv(OUT, index=False)
    print(f"wrote: {OUT}  ({df.shape[0]} rows x {df.shape[1]} cols)")
    print("\ntarget_churn  :\n", df["target_churn"].value_counts().to_string())
    print("\ntarget_willing:\n", df["target_willing"].value_counts().to_string())
    print("\nblood_group   :\n", df["blood_group"].value_counts().to_string())


if __name__ == "__main__":
    main()
