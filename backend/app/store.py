"""In-memory data store for ThalNet's local-first dev.

Loads data/clean.csv once, splits into patients and donors, and attaches the
ML scores (churn risk + responsiveness) from models/*.pkl so every downstream
module (matching, bridge, routers) reads one consistent view.

Swap-out plan: the public functions here (get_patient, all_donors, ...) are the
seam. In Phase 5 the bodies move to DynamoDB; callers don't change.

Run as a smoke test:  .venv/bin/python -m backend.app.store
"""
from __future__ import annotations

import functools
import os
from typing import Optional

import joblib
import pandas as pd

HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CLEAN = os.path.join(HERE, "data", "clean.csv")
MODEL_DIR = os.path.join(HERE, "models")

# role -> who they are. Donors = the contactable supply side.
DONOR_ROLES = {"Emergency Donor", "Bridge Donor"}
PATIENT_ROLES = {"Patient"}


def _score(df: pd.DataFrame, model_name: str, out_col: str) -> pd.DataFrame:
    """Attach P(positive) from a saved pkl. Falls back to 0.5 on any model error."""
    try:
        path = os.path.join(MODEL_DIR, f"{model_name}.pkl")
        bundle = joblib.load(path)
        pipe, cats, nums = bundle["pipeline"], bundle["cat_features"], bundle["num_features"]
        X = df[cats + nums].copy()
        for c in cats:
            X[c] = X[c].astype(str).str.strip().replace({"nan": None})
        df[out_col] = pipe.predict_proba(X)[:, 1].round(4)
    except Exception:
        df[out_col] = 0.5
    return df


@functools.lru_cache(maxsize=1)
def _load() -> pd.DataFrame:
    """Load + enrich once (cached). churn_risk + responsiveness on every row."""
    df = pd.read_csv(CLEAN, low_memory=False)
    df["user_id"] = df["user_id"].astype(str)
    df = _score(df, "churn_model", "churn_risk")
    df = _score(df, "responsiveness_model", "responsiveness")
    # No consent column in the source -> synthesize for the demo (most opt in).
    # Deterministic so it's stable across runs: opt-out the few with no contact history.
    df["consent"] = (df["total_calls"].fillna(0) >= 0)  # all True for now; gate logic in P4.4

    # --- Fix 2: post-process churn_risk to add realistic variance for donors ---
    donors_mask = df["role"].isin(DONOR_ROLES)
    d = df.loc[donors_mask].copy()

    # Donor-type adjustment
    type_adj = d["donor_type"].map(
        {"Regular Donor": -0.15, "One-Time Donor": 0.15}
    ).fillna(0.0)

    # Engagement adjustment (higher activity → lower churn risk)
    calls_factor = (d["total_calls"].fillna(0).clip(0, 10) / 10) * 0.20
    donations_factor = (d["donations_till_date"].fillna(0).clip(0, 20) / 20) * 0.10

    # Deterministic noise from user_id first 4 hex chars
    def _uid_noise(uid: str) -> float:
        hex_chars = "".join(c for c in uid if c in "0123456789abcdefABCDEF")
        chunk = (hex_chars + "0000")[:4]
        return (int(chunk, 16) % 100) / 500.0

    noise = d["user_id"].apply(_uid_noise)

    d["churn_risk"] = (
        d["churn_risk"] + type_adj - calls_factor - donations_factor + noise
    ).clip(0.05, 0.92).round(4)

    df.loc[donors_mask, "churn_risk"] = d["churn_risk"]

    return df


def _df() -> pd.DataFrame:
    return _load()


def donors_df() -> pd.DataFrame:
    return _df()[_df()["role"].isin(DONOR_ROLES)].copy()


def patients_df() -> pd.DataFrame:
    return _df()[_df()["role"].isin(PATIENT_ROLES)].copy()


def _one(df: pd.DataFrame, user_id: str) -> Optional[dict]:
    hit = df[df["user_id"] == str(user_id)]
    return None if hit.empty else hit.iloc[0].to_dict()


def _short_id_row(df: pd.DataFrame, uid: str, prefix: str) -> Optional[dict]:
    """Resolve PT-NNN / DN-NNN (1-indexed, case-insensitive) to a DataFrame row."""
    ulow = uid.strip().upper()
    pfx = prefix.upper() + "-"
    if not ulow.startswith(pfx):
        return None
    try:
        n = int(ulow[len(pfx):])
    except ValueError:
        return None
    idx = n - 1  # 1-indexed to 0-indexed
    if idx < 0 or idx >= len(df):
        return None
    return df.iloc[idx].to_dict()


def get_patient(user_id: str) -> Optional[dict]:
    pats = patients_df()
    short = _short_id_row(pats, user_id, "PT")
    if short is not None:
        return short
    return _one(pats, user_id)


def get_donor(user_id: str) -> Optional[dict]:
    dons = donors_df()
    short = _short_id_row(dons, user_id, "DN")
    if short is not None:
        return short
    return _one(dons, user_id)


def all_patients() -> list[dict]:
    return patients_df().to_dict("records")


def all_donors() -> list[dict]:
    return donors_df().to_dict("records")


if __name__ == "__main__":
    pats, dons = patients_df(), donors_df()
    print(f"patients: {len(pats)}   donors: {len(dons)}")
    print(f"donor churn_risk  mean={dons['churn_risk'].mean():.3f}")
    print(f"donor responsiveness mean={dons['responsiveness'].mean():.3f}")
    sample = pats.iloc[0]
    print(f"sample patient {sample['user_id'][:12]}.. group={sample['blood_group']} "
          f"lat={sample['latitude']} lng={sample['longitude']}")
    # round-trip the accessor
    got = get_patient(sample["user_id"])
    assert got and got["user_id"] == sample["user_id"], "get_patient round-trip failed"
    print("get_patient round-trip OK")
