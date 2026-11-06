"""
Rate limiter factory shared by every module that rate-limits routes.

The counters live in ``RATE_LIMIT_STORAGE_URI`` (Docker: the ``redis`` service),
so all Uvicorn workers and restarts share them and the limits are exact. Without
the variable they stay in each process's memory (local runs, tests).
"""

import os
from collections.abc import Callable

from slowapi import Limiter
from starlette.requests import Request

RATE_LIMIT_STORAGE_URI = os.getenv("RATE_LIMIT_STORAGE_URI") or "memory://"


def create_limiter(key_func: Callable[[Request], str]) -> Limiter:
    """
    Build a limiter on the shared storage; off when TESTING=1.

    If the storage goes down, slowapi falls back to per-process memory (logging
    a warning) instead of failing the request, and switches back once it
    answers again.
    """
    return Limiter(
        key_func=key_func,
        storage_uri=RATE_LIMIT_STORAGE_URI,
        in_memory_fallback_enabled=True,
        enabled=os.getenv("TESTING") != "1",
    )
