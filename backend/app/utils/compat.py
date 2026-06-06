"""ABO+Rh blood compatibility for donor→patient transfusion.

Handles the messy group strings in clean.csv ("A Positive", "O Negative",
"A2 Positive", "A1B Positive", "Bombay Blood Group", "Do not Know", etc.)
and normalises to the 8 standard ABO+Rh types for matching.

Subtype mapping (clinically safe simplifications for the demo):
  A1 / A2 → A   |   A1B / A2B → AB

Bombay phenotype is ultra-rare; can only receive Bombay → treated as its own
group (compatible with nothing else as recipient, and can donate to anyone but
we don't exploit that since we rank donors *for* a patient).
"""
from __future__ import annotations

from typing import Optional

# Canonical form: "O+", "AB-", etc.
_NORMALIZE: dict[str, str] = {
    "a positive": "A+",
    "a negative": "A-",
    "b positive": "B+",
    "b negative": "B-",
    "ab positive": "AB+",
    "ab negative": "AB-",
    "o positive": "O+",
    "o negative": "O-",
    "a1 positive": "A+",
    "a1 negative": "A-",
    "a2 positive": "A+",
    "a2 negative": "A-",
    "a1b positive": "AB+",
    "a1b negative": "AB-",
    "a2b positive": "AB+",
    "a2b negative": "AB-",
    "bombay blood group": "Bombay",
    # Already-canonical forms
    "a+": "A+", "a-": "A-",
    "b+": "B+", "b-": "B-",
    "o+": "O+", "o-": "O-",
    "ab+": "AB+", "ab-": "AB-",
    "bombay": "Bombay",
}

# donor_group -> set of patient groups it can transfuse to
# Standard RBC compatibility (not plasma).
_CAN_GIVE_TO: dict[str, set[str]] = {
    "O-":  {"O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"},
    "O+":  {"O+", "A+", "B+", "AB+"},
    "A-":  {"A-", "A+", "AB-", "AB+"},
    "A+":  {"A+", "AB+"},
    "B-":  {"B-", "B+", "AB-", "AB+"},
    "B+":  {"B+", "AB+"},
    "AB-": {"AB-", "AB+"},
    "AB+": {"AB+"},
    "Bombay": {"Bombay"},
}


def normalize_blood_group(raw: Optional[str]) -> Optional[str]:
    """'O Positive' → 'O+', 'A2B Negative' → 'AB-', unknown → None."""
    if not raw or str(raw).strip().lower() in ("nan", "do not know", ""):
        return None
    return _NORMALIZE.get(str(raw).strip().lower())


def can_donate(donor_group: str, patient_group: str) -> bool:
    """True if donor_group RBCs are safe for patient_group."""
    d = normalize_blood_group(donor_group)
    p = normalize_blood_group(patient_group)
    if d is None or p is None:
        return False
    return p in _CAN_GIVE_TO.get(d, set())


def compatible_donors_mask(patient_group: str) -> set[str]:
    """Return set of canonical donor groups that can give to this patient group."""
    p = normalize_blood_group(patient_group)
    if p is None:
        return set()
    return {d for d, recipients in _CAN_GIVE_TO.items() if p in recipients}
