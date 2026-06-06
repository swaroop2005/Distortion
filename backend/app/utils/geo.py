"""Geo utilities for Layer 2 (donor–patient distance)."""
from __future__ import annotations

import math
from typing import Optional


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    """Great-circle distance between two (lat, lng) points, in km."""
    lat1, lon1 = map(math.radians, a)
    lat2, lon2 = map(math.radians, b)
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * 6371.0 * math.asin(math.sqrt(h))


def donor_patient_km(
    donor: dict, patient: dict, fallback: float = 999.0
) -> float:
    """Distance between a donor and patient record (dicts from store).

    Returns fallback when either side is missing coordinates.
    """
    try:
        dlat = float(donor["latitude"])
        dlng = float(donor["longitude"])
        plat = float(patient["latitude"])
        plng = float(patient["longitude"])
    except (KeyError, TypeError, ValueError):
        return fallback
    if math.isnan(dlat) or math.isnan(dlng) or math.isnan(plat) or math.isnan(plng):
        return fallback
    return round(haversine_km((dlat, dlng), (plat, plng)), 2)
