"""
Tests for email rendering (templates, translations) and the account language
the emails are sent in.
"""

import re

import pytest
from fastapi.testclient import TestClient

from models.user import User
from services import email_service
from services.email_service import TRANSLATIONS, format_hours, render_email

TEMPLATES = ["email_verification", "password_reset"]
LANGUAGES = ["en", "pl"]
ACTION_URL = "http://localhost:4200/reset-password/abc_DEF-123"


def _render(template: str, lang: str, to_email: str = "user@example.com"):
    return render_email(
        template,
        lang,
        to_email,
        action_url=ACTION_URL,
        duration=format_hours(lang, 24),
    )


@pytest.mark.parametrize("lang", LANGUAGES)
@pytest.mark.parametrize("template", TEMPLATES)
def test_render_email(template: str, lang: str):
    """Every email renders in every language with its link and no leftovers."""
    subject, html, text = _render(template, lang)

    assert subject == TRANSLATIONS[lang][template]["subject"]
    assert f'<html lang="{lang}"' in html
    assert TRANSLATIONS[lang][template]["title"] in html
    assert f'href="{ACTION_URL}"' in html
    assert ACTION_URL in text
    assert "user@example.com" in html and "user@example.com" in text
    for body in (html, text):
        # Unfilled {placeholders} from the translation files.
        assert not re.search(r"\{[a-z_]+\}", body)


def test_render_email_unknown_language_falls_back_to_english():
    subject, html, _ = _render("password_reset", "de")

    assert subject == TRANSLATIONS["en"]["password_reset"]["subject"]
    assert '<html lang="en"' in html


def test_render_email_escapes_html():
    _, html, _ = _render("password_reset", "en", to_email="<b>x</b>@example.com")

    assert "<b>x</b>" not in html
    assert "&lt;b&gt;x&lt;/b&gt;" in html


@pytest.mark.parametrize("lang", LANGUAGES)
def test_translations_have_the_same_keys(lang: str):
    """Each language defines every email text the English file does."""
    for category, texts in TRANSLATIONS["en"].items():
        if category == "units":
            continue
        assert set(TRANSLATIONS[lang][category]) == set(texts), category


@pytest.mark.parametrize(
    ("lang", "count", "expected"),
    [
        ("en", 1, "1 hour"),
        ("en", 24, "24 hours"),
        ("pl", 1, "1 godzinę"),
        ("pl", 2, "2 godziny"),
        ("pl", 5, "5 godzin"),
        ("pl", 12, "12 godzin"),
        ("pl", 22, "22 godziny"),
        ("pl", 24, "24 godziny"),
    ],
)
def test_format_hours(lang: str, count: int, expected: str):
    assert format_hours(lang, count) == expected


class TestAccountLanguage:
    """The account language is set at sign-up and used for its emails."""

    @pytest.fixture
    def sent(self, monkeypatch):
        """Captures emails instead of sending them."""
        messages: list[dict] = []

        def fake_send(to_email, subject, html_content, text_content=None):
            messages.append({"to": to_email, "subject": subject, "html": html_content})
            return True

        monkeypatch.setattr(email_service, "send_email", fake_send)
        return messages

    def test_register_stores_language_and_sends_email_in_it(
        self, client: TestClient, test_db, sent
    ):
        response = client.post(
            "/auth/register",
            json={
                "email": "pl@example.com",
                "password": "Securepass123!",
                "language": "pl",
            },
        )

        assert response.status_code == 201
        assert response.json()["language"] == "pl"
        user = test_db.query(User).filter(User.email == "pl@example.com").first()
        assert user.language == "pl"
        assert sent[0]["subject"] == TRANSLATIONS["pl"]["email_verification"]["subject"]
        assert "/verify-email/" in sent[0]["html"]

    def test_register_without_language_defaults_to_english(
        self, client: TestClient, sent
    ):
        response = client.post(
            "/auth/register",
            json={"email": "en@example.com", "password": "Securepass123!"},
        )

        assert response.status_code == 201
        assert response.json()["language"] == "en"
        assert sent[0]["subject"] == TRANSLATIONS["en"]["email_verification"]["subject"]

    def test_register_rejects_unknown_language(self, client: TestClient):
        response = client.post(
            "/auth/register",
            json={
                "email": "de@example.com",
                "password": "Securepass123!",
                "language": "de",
            },
        )

        assert response.status_code == 422

    def test_password_reset_email_uses_account_language(
        self, client: TestClient, test_db, test_user, sent
    ):
        test_user.language = "pl"
        test_db.commit()

        response = client.post("/auth/forgot-password", json={"email": test_user.email})

        assert response.status_code == 200
        assert sent[0]["subject"] == TRANSLATIONS["pl"]["password_reset"]["subject"]
        assert "1 godzinę" in sent[0]["html"]
