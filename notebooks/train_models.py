"""Train ThalNet's two donor models on data/clean.csv.

  Model B — Donor CHURN risk     (target_churn:  1 = Inactive donor)    STRONG, real label
  Model A — Donor RESPONSIVENESS (target_willing: "has ever donated")   WEAK proxy, honest

Why two: Triage (Layer 2) ranks donors for a Blood Bridge using
  - churn risk     -> who is about to fall out of the bridge (self-heal trigger / cadence action)
  - responsiveness -> rough propensity a profile engages when contacted

------------------------------------------------------------------------------
LEAKAGE GUARDS — learned the hard way (first run gave ROC-AUC 1.000 = a lie).
------------------------------------------------------------------------------
Two kinds of leakage live in this dataset:

1. DIRECT (the target dressed up as a column):
   - `user_donation_active_status`  IS the churn target.
   - `inactive_trigger_comment`     only exists for Inactive rows, describes WHY -> leak.
   - dead cols `role_status`, `status` (no variance).

2. CIRCULAR / DEFINITIONAL (a feature is computed from the same event as the label):
   - CHURN: a donor is flagged Inactive *because* they haven't donated in ~1 year, so the
     recency columns (`days_since_last_donation`, `days_to_next_eligible`, `cycle_of_donations`,
     `days_since_last_contact`) basically restate the label -> they pushed AUC to 1.0 and are
     also operationally useless (if days_since=huge you already KNOW they're gone). DROPPED for
     churn. Churn is predicted from PROFILE + CALL BEHAVIOR only.
   - RESPONSIVENESS: `target_willing` = (donated_earlier OR donations_till_date>0). So
     `donations_till_date`, `donor_type` (One-Time/Regular *means* they donated), and
     `calls_to_donations_ratio` (calls/donations) all tautologically define the label. DROPPED.
     What's left is a softer proxy (~0.86 AUC) — reported honestly, NOT headlined.

Headline number = Model B. Model A is shown with its caveat.

Run:  .venv/bin/python notebooks/train_models.py
Out:  models/churn_model.pkl, models/responsiveness_model.pkl, models/metrics.json
"""
from __future__ import annotations

import json
import os

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import average_precision_score, classification_report, roc_auc_score
from sklearn.model_selection import cross_val_predict, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

import joblib

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLEAN = os.path.join(HERE, "data", "clean.csv")
MODEL_DIR = os.path.join(HERE, "models")
RANDOM_STATE = 42

# --- Model B (churn): profile + call behavior. NO recency (it defines the label). ---
CHURN_CAT = ["donor_type", "eligibility_status", "blood_group", "gender"]
CHURN_NUM = [
    "donations_till_date",
    "total_calls",
    "frequency_in_days",
    "calls_to_donations_ratio",  # inactive mean 3.9 vs active 0.08 — real disengagement signal
]

# --- Model A (responsiveness): call behavior + eligibility only. Donation/donor_type DROPPED
#     because they tautologically define target_willing. Intentionally a weak proxy. ---
RESP_CAT = ["eligibility_status", "blood_group", "gender"]
RESP_NUM = ["total_calls", "frequency_in_days", "days_since_last_contact"]

# Anything here must NEVER appear as a feature in EITHER model.
LEAKAGE = {
    "user_donation_active_status",   # IS the churn target
    "inactive_trigger_comment",      # describes churn reason -> direct leak
    "target_churn",
    "target_willing",
    "role_status",
    "status",
    # circular-for-churn recency (allowed for nothing here to keep it simple):
    "days_since_last_donation",
    "days_to_next_eligible",
    "cycle_of_donations",
}


def _build_pipeline(cat, num) -> Pipeline:
    pre = ColumnTransformer(
        transformers=[
            ("cat", OneHotEncoder(handle_unknown="ignore", min_frequency=10), cat),
            ("num", SimpleImputer(strategy="median"), num),
        ],
        remainder="drop",
    )
    return Pipeline(
        [("pre", pre), ("clf", GradientBoostingClassifier(random_state=RANDOM_STATE))]
    )


def _features(df: pd.DataFrame, cat, num) -> pd.DataFrame:
    assert not (set(cat) | set(num)) & LEAKAGE, "leakage column in feature set"
    X = df[cat + num].copy()
    for c in cat:
        X[c] = X[c].astype(str).str.strip().replace({"nan": np.nan})
    return X


def _train_one(name: str, df: pd.DataFrame, target: str, cat, num) -> dict:
    X = _features(df, cat, num)
    y = df[target].astype(int)
    pos = int(y.sum())
    print(f"\n=== {name}  (target `{target}`) ===")
    print(f"positives {pos}/{len(y)} ({pos / len(y):.1%})  features: {cat + num}")

    # Honest generalization estimate: out-of-fold 5-fold CV (not one lucky split).
    cv_proba = cross_val_predict(
        _build_pipeline(cat, num), X, y, cv=5, method="predict_proba"
    )[:, 1]
    roc = roc_auc_score(y, cv_proba)
    pr = average_precision_score(y, cv_proba)
    print(f"5-fold CV  ROC-AUC: {roc:.3f}   PR-AUC: {pr:.3f}   (base rate {y.mean():.1%})")

    # Holdout classification report for a readable confusion picture.
    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.25, stratify=y, random_state=RANDOM_STATE
    )
    pipe = _build_pipeline(cat, num)
    w = np.where(y_tr == 1, len(y_tr) / (2 * pos), len(y_tr) / (2 * (len(y_tr) - pos)))
    pipe.fit(X_tr, y_tr, clf__sample_weight=w)
    pred = (pipe.predict_proba(X_te)[:, 1] >= 0.5).astype(int)
    print(classification_report(y_te, pred, digits=3, zero_division=0))

    # Refit on ALL data for the served artifact.
    w_all = np.where(y == 1, len(y) / (2 * pos), len(y) / (2 * (len(y) - pos)))
    final = _build_pipeline(cat, num).fit(X, y, clf__sample_weight=w_all)
    out = os.path.join(MODEL_DIR, f"{name}.pkl")
    joblib.dump({"pipeline": final, "cat_features": cat, "num_features": num}, out)
    print(f"saved -> {out}")

    return {
        "target": target,
        "features": cat + num,
        "n_rows": int(len(y)),
        "positives": pos,
        "cv_roc_auc": round(float(roc), 4),
        "cv_pr_auc": round(float(pr), 4),
        "base_rate": round(float(y.mean()), 4),
    }


def main() -> None:
    df = pd.read_csv(CLEAN, low_memory=False)
    print(f"loaded {CLEAN}: {df.shape[0]} rows x {df.shape[1]} cols")
    os.makedirs(MODEL_DIR, exist_ok=True)

    metrics = {
        "churn_model": _train_one(
            "churn_model", df, "target_churn", CHURN_CAT, CHURN_NUM
        ),
        "responsiveness_model": _train_one(
            "responsiveness_model", df, "target_willing", RESP_CAT, RESP_NUM
        ),
    }
    metrics["_note"] = (
        "Model B (churn) is the headline: real Inactive label, strong call-behavior signal "
        "(~0.96 CV ROC). Recency/eligibility-date columns were dropped as circular leakage. "
        "Model A (responsiveness) is a softer PROXY (~0.86 CV ROC): target_willing "
        "is 'ever donated', so donation-count and donor_type were dropped to avoid tautology. "
        "Report A with its caveat; never headline it."
    )

    mp = os.path.join(MODEL_DIR, "metrics.json")
    with open(mp, "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"\nmetrics -> {mp}")


if __name__ == "__main__":
    main()
