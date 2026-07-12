"""
Password Validator - Checks passwords against a list of common/breached passwords.

Loads a curated list of 20,000 most common passwords (8+ characters) at module
import time. The list is sourced from SecLists (xato-net + NCSC top lists).
"""

import logging
from pathlib import Path

logger = logging.getLogger(__name__)

_PASSWORDS_FILE = Path(__file__).parent / "common_passwords.txt"
COMMON_PASSWORDS: set[str] = set()

MIN_UNIQUE_CHARS = 3


def _load_common_passwords() -> None:
    """Load common passwords from file into memory (called once at import)."""
    if not _PASSWORDS_FILE.exists():
        logger.warning(
            "Common passwords file not found at %s — "
            "password strength validation will be limited.",
            _PASSWORDS_FILE,
        )
        return

    COMMON_PASSWORDS.update(
        line.strip().lower()
        for line in _PASSWORDS_FILE.read_text(encoding="utf-8").splitlines()
        if line.strip()
    )
    logger.info("Loaded %d common passwords for validation.", len(COMMON_PASSWORDS))


_load_common_passwords()


def validate_password_strength(password: str) -> str:
    """
    Validate password strength beyond minimum length.

    Checks:
    - Password is not in the top 20k most common passwords.
    - Password contains at least MIN_UNIQUE_CHARS unique characters.

    Args:
        password: The password to validate.

    Returns:
        The password unchanged if valid.

    Raises:
        ValueError: If the password fails validation.
    """
    if password.lower() in COMMON_PASSWORDS:
        raise ValueError("AUTH_PASSWORD_TOO_COMMON")

    if len(set(password)) < MIN_UNIQUE_CHARS:
        raise ValueError("AUTH_PASSWORD_TOO_SIMPLE")

    return password
