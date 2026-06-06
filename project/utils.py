"""Low-level helpers: a throttled, retrying HTTP client plus hashing utilities.

The :class:`HttpClient` is the single choke point for every outbound request, so
politeness (throttle), resilience (retry/backoff), and identification (User-Agent)
are enforced in exactly one place.
"""

from __future__ import annotations

import hashlib
import random
import time
from typing import Any

import requests

from .config import BACKOFF_BASE, BACKOFF_MAX, RETRY_STATUS, Settings
from .logger import get_logger

log = get_logger("http")


class HttpError(RuntimeError):
    """Raised when a request ultimately fails after all retries."""


class HttpClient:
    """A polite, resilient JSON HTTP client.

    Responsibilities:
      * enforce a minimum delay (+ jitter) between requests (throttle)
      * retry transient failures with exponential backoff
      * attach a descriptive User-Agent
    """

    def __init__(self, settings: Settings):
        self.settings = settings
        self._session = requests.Session()
        self._session.headers.update(
            {"User-Agent": settings.user_agent, "Accept": "application/json"}
        )
        self._last_request_ts = 0.0

    # -- throttling -------------------------------------------------------- #
    def _throttle(self) -> None:
        """Sleep so consecutive requests are at least ``throttle_seconds`` apart."""
        elapsed = time.monotonic() - self._last_request_ts
        wait = self.settings.throttle_seconds - elapsed
        if wait > 0:
            time.sleep(wait)
        if self.settings.throttle_jitter > 0:
            time.sleep(random.uniform(0, self.settings.throttle_jitter))
        self._last_request_ts = time.monotonic()

    # -- core request with retry ------------------------------------------ #
    def get_json(self, url: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        """GET ``url`` and return parsed JSON, retrying transient failures.

        Raises :class:`HttpError` if every attempt fails.
        """
        last_exc: Exception | None = None
        for attempt in range(1, self.settings.max_retries + 1):
            self._throttle()
            try:
                resp = self._session.get(
                    url, params=params, timeout=self.settings.request_timeout
                )
                if resp.status_code in RETRY_STATUS:
                    raise HttpError(f"retryable status {resp.status_code}")
                resp.raise_for_status()
                return resp.json()
            except (requests.RequestException, HttpError, ValueError) as exc:
                last_exc = exc
                if attempt < self.settings.max_retries:
                    backoff = min(BACKOFF_BASE * (2 ** (attempt - 1)), BACKOFF_MAX)
                    backoff += random.uniform(0, 0.5)  # decorrelated jitter
                    log.warning(
                        "request failed (attempt %d/%d): %s -> backing off %.1fs",
                        attempt, self.settings.max_retries, exc, backoff,
                    )
                    time.sleep(backoff)
                else:
                    log.error(
                        "request failed permanently after %d attempts: %s",
                        self.settings.max_retries, exc,
                    )
        raise HttpError(f"GET {url} failed after {self.settings.max_retries} attempts") from last_exc

    def close(self) -> None:
        self._session.close()


def record_hash(*parts: Any) -> str:
    """Stable SHA1 over the given parts, used for duplicate detection."""
    joined = "␟".join("" if p is None else str(p) for p in parts)
    return hashlib.sha1(joined.encode("utf-8")).hexdigest()
