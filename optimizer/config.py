"""Configuration, normalization maps, and tunable weights for the optimizer.

Everything domain-specific (blood-group spelling variants, which components count
as transfusable red cells, district geography, optimization weights) lives here so
the stage modules stay generic.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

# --------------------------------------------------------------------------- #
# Filesystem
# --------------------------------------------------------------------------- #
PKG_ROOT = Path(__file__).resolve().parent
REPO_ROOT = PKG_ROOT.parent
DATA_DIR = REPO_ROOT / "data"

SUPPLY_CSV = DATA_DIR / "blood_stock_long.csv"      # produced by project/ scraper
DEMAND_CSV = REPO_ROOT / "Dataset.csv"              # provided donor/patient dataset
OUT_DIR = DATA_DIR / "optimizer"                    # where plans are written

# --------------------------------------------------------------------------- #
# Blood-group normalization → canonical {A+,A-,B+,B-,O+,O-,AB+,AB-} or UNKNOWN
# --------------------------------------------------------------------------- #
CANONICAL_GROUPS = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"]
UNKNOWN_GROUP = "UNKNOWN"

# Maps the many spellings seen across the two sources to canonical codes.
_GROUP_ALIASES = {
    # scraped portal spelling
    "a+ve": "A+", "a-ve": "A-", "b+ve": "B+", "b-ve": "B-",
    "o+ve": "O+", "o-ve": "O-", "ab+ve": "AB+", "ab-ve": "AB-",
    # provided dataset spelling
    "a positive": "A+", "a negative": "A-", "b positive": "B+", "b negative": "B-",
    "o positive": "O+", "o negative": "O-", "ab positive": "AB+", "ab negative": "AB-",
    # already-canonical
    "a+": "A+", "a-": "A-", "b+": "B+", "b-": "B-",
    "o+": "O+", "o-": "O-", "ab+": "AB+", "ab-": "AB-",
}


def normalize_group(raw: str | None) -> str:
    """Map any blood-group spelling to a canonical code (or UNKNOWN)."""
    if not raw:
        return UNKNOWN_GROUP
    return _GROUP_ALIASES.get(raw.strip().lower(), UNKNOWN_GROUP)


# --------------------------------------------------------------------------- #
# Red-cell compatibility (recipient group -> donor groups that can supply it)
# Used only when --allow-substitution is on; default matching is exact group.
# --------------------------------------------------------------------------- #
RED_CELL_COMPAT: dict[str, list[str]] = {
    "O-": ["O-"],
    "O+": ["O+", "O-"],
    "A-": ["A-", "O-"],
    "A+": ["A+", "A-", "O+", "O-"],
    "B-": ["B-", "O-"],
    "B+": ["B+", "B-", "O+", "O-"],
    "AB-": ["AB-", "A-", "B-", "O-"],
    "AB+": CANONICAL_GROUPS,  # universal recipient
}

# Components that deliver red cells (the transfusion need for thalassemia).
RED_CELL_COMPONENTS = {"Whole Blood", "Packed Red Blood Cells"}

# --------------------------------------------------------------------------- #
# Coverage thresholds (days of supply) and optimization weights
# --------------------------------------------------------------------------- #
CRITICAL_DAYS = 3.0
LOW_DAYS = 7.0

# Redistribution objective weights: minimize w_unmet*unmet + w_dist*distance.
W_UNMET = 1000.0   # strongly prefer satisfying demand
W_DISTANCE = 1.0   # then prefer short transfers

# Distance proxy (km-ish) when district centroids are unknown.
SAME_DISTRICT = 0.0
SAME_STATE = 60.0
CROSS_STATE = 400.0


@dataclass
class Settings:
    """Runtime settings (overridable via CLI flags in run.py)."""

    horizon_days: int = 30
    as_of: str | None = None          # ISO date; default = today
    region: str = "Telangana"         # state to optimize (demand data is TG-centric)
    demand_scale: float = 1.0         # scale sample demand toward the real patient base
    mode: str = "demand"              # demand | rebalance | both
    safety_stock: int = 8             # per-bank per-group target for rebalance mode

    use_solver: bool = True           # PuLP MILP; falls back to greedy if unavailable
    allow_substitution: bool = False  # enable O-/compatible substitution edges
    data_dir: Path = field(default_factory=lambda: DATA_DIR)
    out_dir: Path = field(default_factory=lambda: OUT_DIR)

    @property
    def supply_csv(self) -> Path:
        return self.data_dir / "blood_stock_long.csv"

    def ensure_dirs(self) -> None:
        self.out_dir.mkdir(parents=True, exist_ok=True)
