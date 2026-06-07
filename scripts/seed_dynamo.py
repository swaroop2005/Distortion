#!/usr/bin/env python3
"""Seed ThalNet DynamoDB Users table from data/clean.csv.

Writes all donors + patients with ML scores attached.
Safe to re-run (put_item overwrites).

Usage:
    # From repo root:
    AWS_REGION=us-east-1 .venv/bin/python scripts/seed_dynamo.py

    # Dry run (print first 3 rows, don't write):
    DRY_RUN=1 .venv/bin/python scripts/seed_dynamo.py
"""
from __future__ import annotations

import math
import os
import sys
import time

# Allow running from repo root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import boto3
import pandas as pd
import joblib

REGION  = os.getenv("AWS_REGION", "us-east-1")
PREFIX  = os.getenv("THALNET_TABLE_PREFIX", "ThalNet-")
DRY_RUN = os.getenv("DRY_RUN", "0") == "1"

HERE      = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLEAN_CSV = os.path.join(HERE, "data", "clean.csv")
MODEL_DIR = os.path.join(HERE, "models")


def _attach_scores(df: pd.DataFrame) -> pd.DataFrame:
    for model_name, col, default in [
        ("churn_model", "churn_risk", 0.5),
        ("responsiveness_model", "responsiveness", 0.5),
    ]:
        path = os.path.join(MODEL_DIR, f"{model_name}.pkl")
        if not os.path.exists(path):
            df[col] = default
            continue
        try:
            bundle = joblib.load(path)
            pipe, cats, nums = bundle["pipeline"], bundle["cat_features"], bundle["num_features"]
            X = df[cats + nums].copy()
            for c in cats:
                X[c] = X[c].astype(str).str.strip().replace({"nan": None})
            df[col] = pipe.predict_proba(X)[:, 1].round(4)
        except Exception as exc:
            print(f"  warn: {model_name} scoring failed ({exc}), using default {default}")
            df[col] = default
    return df


def _clean_row(row: dict) -> dict:
    """Convert NaN/inf/None to safe DynamoDB values."""
    out: dict = {}
    for k, v in row.items():
        if v is None:
            continue
        if isinstance(v, float):
            if math.isnan(v) or math.isinf(v):
                continue
            # DynamoDB stores Decimal; boto3 handles float but needs finite values
        if isinstance(v, str) and v.lower() in ("nan", "none", ""):
            continue
        out[str(k)] = v
    out["consent"] = True  # demo: all opt-in
    return out


def seed():
    df = pd.read_csv(CLEAN_CSV, low_memory=False)
    df["user_id"] = df["user_id"].astype(str)
    df = _attach_scores(df)

    rows = [_clean_row(r) for r in df.to_dict("records")]

    if DRY_RUN:
        print(f"DRY RUN — would write {len(rows)} rows. Sample:")
        for r in rows[:3]:
            print(" ", {k: r[k] for k in list(r)[:6]})
        return

    ddb   = boto3.resource("dynamodb", region_name=REGION)
    table = ddb.Table(PREFIX + "Users")

    total = len(rows)
    print(f"Seeding {total} rows → {PREFIX}Users …")

    with table.batch_writer() as batch:
        for i, row in enumerate(rows):
            row["userId"] = row["user_id"]
            batch.put_item(Item=row)
            if (i + 1) % 500 == 0:
                print(f"  {i + 1}/{total} …")

    print(f"Done. {total} rows written.")


if __name__ == "__main__":
    print(f"Region: {REGION}  Prefix: {PREFIX}  DryRun: {DRY_RUN}\n")
    seed()
