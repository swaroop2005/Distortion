"""Geography helpers: blood-group canon re-export, district centroids, distances.

Bank addresses in the scraped data have no coordinates, so for the district-level
redistribution optimizer we use an approximate centroid lookup for Telangana's
districts (the demo region). Distances fall back to a tiered same-district /
same-state / cross-state proxy when a centroid is unknown.
"""

from __future__ import annotations

import math

from .config import CROSS_STATE, SAME_DISTRICT, SAME_STATE

# Approximate district-HQ coordinates (lat, lng) for Telangana. Good enough for a
# transport-distance proxy in the redistribution LP; not survey-grade.
TELANGANA_CENTROIDS: dict[str, tuple[float, float]] = {
    "Hyderabad": (17.385, 78.486),
    "Medchal Malkajgiri": (17.630, 78.480),
    "Rangareddy": (17.400, 78.300),
    "Karimnagar": (18.440, 79.130),
    "Khammam": (17.250, 80.150),
    "Warangal": (17.970, 79.590),
    "Hanumakonda": (18.010, 79.560),
    "Nizamabad": (18.670, 78.100),
    "Bhadradri Kothagudem": (17.550, 80.620),
    "Siddipet": (18.100, 78.850),
    "Nalgonda": (17.050, 79.270),
    "Sangareddy": (17.630, 78.080),
    "Nirmal": (19.100, 78.340),
    "Mancherial": (18.870, 79.460),
    "Suryapet": (17.140, 79.620),
    "Mahbubnagar": (16.740, 77.990),
    "Kamareddy": (18.320, 78.340),
    "Peddapalli": (18.610, 79.380),
    "Jagtial": (18.790, 78.910),
    "Narayanpet": (16.740, 77.500),
    "Adilabad": (19.670, 78.530),
    "Jayashankar Bhupalpally": (18.420, 79.840),
    "Jangaon": (17.720, 79.180),
    "Vikarabad": (17.330, 77.900),
    "Rajanna Sircilla": (18.390, 78.810),
    "Kumaram Bheem Asifabad": (19.360, 79.280),
    "Medak": (18.040, 78.270),
    "Jogulamba Gadwal": (16.230, 77.800),
    "Nagarkurnool": (16.480, 78.320),
    "Mulugu": (18.190, 79.940),
    "Wanaparthy": (16.360, 78.060),
    "Yadadri Bhuvanagiri": (17.490, 78.900),
    "Mahabubabad": (17.600, 80.000),
}


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    """Great-circle distance between two (lat, lng) points, in kilometres."""
    lat1, lon1 = map(math.radians, a)
    lat2, lon2 = map(math.radians, b)
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * 6371.0 * math.asin(math.sqrt(h))


def district_distance(d1: str, d2: str) -> float:
    """Distance between two districts.

    Uses centroid haversine when both are known; otherwise a tiered proxy
    (same district = 0, same state = SAME_STATE, else CROSS_STATE).
    """
    if d1 == d2:
        return SAME_DISTRICT
    c1, c2 = TELANGANA_CENTROIDS.get(d1), TELANGANA_CENTROIDS.get(d2)
    if c1 and c2:
        return round(haversine_km(c1, c2), 1)
    # one or both unknown — both are within the same optimized state here
    return SAME_STATE


def bank_distance(b1: dict, b2: dict) -> float:
    """Distance between two bank nodes.

    Uses centroid haversine when both have coordinates; otherwise a tiered proxy
    on district/state (same district = 0, same state = SAME_STATE, else CROSS_STATE).
    """
    if b1["id"] == b2["id"]:
        return SAME_DISTRICT
    if b1.get("lat") is not None and b2.get("lat") is not None:
        d = haversine_km((b1["lat"], b1["lng"]), (b2["lat"], b2["lng"]))
        # banks in the same district share a centroid -> nudge off zero
        return round(d, 1) if d > 0 else 5.0
    if b1["district"] and b1["district"] == b2["district"]:
        return 5.0
    if b1["state"] and b1["state"] == b2["state"]:
        return SAME_STATE
    return CROSS_STATE


def point_distance_km(lat: float, lng: float, district: str) -> float:
    """Distance from a (lat,lng) point to a district centroid; large if unknown."""
    c = TELANGANA_CENTROIDS.get(district)
    if not c:
        return CROSS_STATE
    return round(haversine_km((lat, lng), c), 1)
