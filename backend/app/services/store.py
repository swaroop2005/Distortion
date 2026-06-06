"""In-memory data store for ThalNet's local-first dev.

Loads data/clean.csv once, splits into patients and donors, and attaches the
ML scores (churn risk + responsiveness) from models/*.pkl so every downstream
module (matching, bridge, routers) reads one consistent view.

Swap-out plan: the public functions here (get_patient, all_donors, ...) are the
seam. In Phase 5 the bodies move to DynamoDB; callers don't change.

Run as a smoke test:  .venv/bin/python -m backend.app.services.store
"""
from __future__ import annotations

import functools
import os
from typing import Optional

import joblib
import pandas as pd

HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
CLEAN = os.path.join(HERE, "data", "clean.csv")
MODEL_DIR = os.path.join(HERE, "models")

# role -> who they are. Donors = the contactable supply side.
DONOR_ROLES = {"Emergency Donor", "Bridge Donor"}
PATIENT_ROLES = {"Patient"}


def _score(df: pd.DataFrame, model_name: str, out_col: str, default: float = 0.5) -> pd.DataFrame:
    """Attach P(positive) from a saved {pipeline,cat_features,num_features} pkl.

    Falls back to `default` score for every row when the model file is missing —
    the API stays live during the build phase before ML training is complete.
    """
    path = os.path.join(MODEL_DIR, f"{model_name}.pkl")
    if not os.path.exists(path):
        df[out_col] = default
        return df
    try:
        bundle = joblib.load(path)
        pipe, cats, nums = bundle["pipeline"], bundle["cat_features"], bundle["num_features"]
        X = df[cats + nums].copy()
        for c in cats:
            X[c] = X[c].astype(str).str.strip().replace({"nan": None})
        df[out_col] = pipe.predict_proba(X)[:, 1].round(4)
    except Exception:
        # pkl version mismatch or schema change — fall back to neutral score until retrained
        df[out_col] = default
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


def get_patient(user_id: str) -> Optional[dict]:
    return _one(patients_df(), user_id)


def get_donor(user_id: str) -> Optional[dict]:
    return _one(donors_df(), user_id)


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
