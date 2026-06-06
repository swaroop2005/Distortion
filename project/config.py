"""Central configuration for the blood-stock collection pipeline.

Everything tunable lives here so the rest of the codebase stays declarative.
Values can be overridden at runtime via CLI flags (see ``collect_data.py``).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

# --------------------------------------------------------------------------- #
# Endpoints
# --------------------------------------------------------------------------- #
# The portal is a Next.js front-end that proxies India's national e-RaktKosh
# blood portal. Both endpoints are public and require no authentication.
BASE_URL = "https://www.bloodwarriors.in"
STATES_ENDPOINT = "/api/public/eraktkosh/states"
AVAILABILITY_ENDPOINT = "/api/public/eraktkosh/blood-availability"

# A descriptive User-Agent so the host can identify (and contact us about) the
# traffic. We collect under host-org authorization (Blood Warriors hackathon).
USER_AGENT = (
    "BloodWarriors-Hackathon-StockCollector/1.0 "
    "(+research; respectful crawler; contact: hackathon team)"
)

# --------------------------------------------------------------------------- #
# Politeness / reliability
# --------------------------------------------------------------------------- #
# robots.txt disallows /api/. We proceed under host-org authorization with
# conservative, self-imposed throttling. See README for the full writeup.
THROTTLE_SECONDS = 1.5          # base delay between requests
THROTTLE_JITTER = 0.5           # added random [0, jitter) seconds
REQUEST_TIMEOUT = 60            # seconds (state 28 alone can take ~13s uncached)
MAX_RETRIES = 5                 # attempts before giving up on a request
BACKOFF_BASE = 1.0              # exponential backoff base (1, 2, 4, 8, ...)
BACKOFF_MAX = 30.0              # cap a single backoff sleep
RETRY_STATUS = (429, 500, 502, 503, 504)

# --------------------------------------------------------------------------- #
# Collection behaviour
# --------------------------------------------------------------------------- #
# A single stateCode call returns every bank with its full component x blood-group
# stock matrix (validated: count == len(banks), no pagination), so we iterate
# states only. The cross-product is expanded into rows by the parser.
WITH_STOCK_ONLY_DEFAULT = True  # mirror the portal's "available stock" view

# --------------------------------------------------------------------------- #
# Static filter catalogs (server-rendered into the page; kept here for
# documentation, validation, and the optional --verify-filters mode).
# --------------------------------------------------------------------------- #
BLOOD_GROUPS = [
    "A+Ve", "A-Ve", "B+Ve", "B-Ve", "O+Ve", "O-Ve",
    "AB+Ve", "AB-Ve", "Oh+VE", "Oh-VE",
]
COMPONENTS = [
    "Whole Blood", "Packed Red Blood Cells", "Fresh Frozen Plasma",
    "Single Donor Platelet", "Random Donor Platelets", "Platelet Concentrate",
    "Plasma", "Cryoprecipitate", "Cryo Poor Plasma",
]
HOSPITAL_TYPES = ["Govt.", "Private", "Charitable/Vol", "Red Cross"]

# --------------------------------------------------------------------------- #
# Filesystem layout
# --------------------------------------------------------------------------- #
PROJECT_ROOT = Path(__file__).resolve().parent
REPO_ROOT = PROJECT_ROOT.parent
DATA_DIR = REPO_ROOT / "data"
LOG_DIR = REPO_ROOT / "logs"

LONG_CSV_NAME = "blood_stock_long.csv"      # one row per bank x component x group
REGISTRY_CSV_NAME = "blood_banks.csv"       # one row per bank
CHECKPOINT_NAME = "checkpoint.json"
FILTERS_CATALOG_NAME = "filters.json"


@dataclass
class Settings:
    """Runtime settings, seeded from the constants above and overridable via CLI."""

    base_url: str = BASE_URL
    user_agent: str = USER_AGENT
    throttle_seconds: float = THROTTLE_SECONDS
    throttle_jitter: float = THROTTLE_JITTER
    request_timeout: int = REQUEST_TIMEOUT
    max_retries: int = MAX_RETRIES
    with_stock_only: bool = WITH_STOCK_ONLY_DEFAULT
    data_dir: Path = field(default_factory=lambda: DATA_DIR)
    log_dir: Path = field(default_factory=lambda: LOG_DIR)
    resume: bool = True

    # Derived paths -------------------------------------------------------- #
    @property
    def long_csv(self) -> Path:
        return self.data_dir / LONG_CSV_NAME

    @property
    def registry_csv(self) -> Path:
        return self.data_dir / REGISTRY_CSV_NAME

    @property
    def checkpoint_path(self) -> Path:
        return self.data_dir / CHECKPOINT_NAME

    @property
    def filters_path(self) -> Path:
        return self.data_dir / FILTERS_CATALOG_NAME

    def ensure_dirs(self) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.log_dir.mkdir(parents=True, exist_ok=True)
