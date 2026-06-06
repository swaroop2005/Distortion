"""Blood supply-chain optimization engine.

Predicts blood shortages by comparing forecast demand (from patient transfusion
schedules) against live supply (scraped national blood-bank inventory), then
optimizes the response: inter-bank redistribution + donor mobilization.

Companion to the scraper in ``project/`` (which produces the supply data) and to
the teammate's ``ThalNet`` donor-outreach system (which can consume the
mobilization plan this engine produces).
"""

__version__ = "0.1.0"
