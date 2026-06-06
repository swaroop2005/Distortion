"""Thin re-export of the app-level supply_store for use inside services/."""
from __future__ import annotations

from ..supply_store import banks_with_stock, stock_summary, nearest_districts  # noqa: F401
