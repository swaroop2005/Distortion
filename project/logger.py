"""Structured logging setup: console + rotating file handler.

Call :func:`get_logger` anywhere; the first call configures the root pipeline
logger. Keeping this in one module guarantees consistent formatting and a single
rotating log file across every component.
"""

from __future__ import annotations

import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

_LOGGER_NAME = "blood_stock"
_CONFIGURED = False

_FMT = "%(asctime)s | %(levelname)-7s | %(name)s | %(message)s"
_DATEFMT = "%Y-%m-%d %H:%M:%S"


def configure_logging(log_dir: Path, level: int = logging.INFO) -> logging.Logger:
    """Configure the pipeline logger once; safe to call repeatedly."""
    global _CONFIGURED
    logger = logging.getLogger(_LOGGER_NAME)
    if _CONFIGURED:
        return logger

    logger.setLevel(level)
    logger.propagate = False
    formatter = logging.Formatter(_FMT, datefmt=_DATEFMT)

    console = logging.StreamHandler()
    console.setFormatter(formatter)
    logger.addHandler(console)

    log_dir.mkdir(parents=True, exist_ok=True)
    file_handler = RotatingFileHandler(
        log_dir / "pipeline.log",
        maxBytes=5 * 1024 * 1024,  # 5 MB
        backupCount=5,
        encoding="utf-8",
    )
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    _CONFIGURED = True
    return logger


def get_logger(name: str | None = None) -> logging.Logger:
    """Return the pipeline logger (or a named child of it)."""
    base = logging.getLogger(_LOGGER_NAME)
    return base.getChild(name) if name else base
