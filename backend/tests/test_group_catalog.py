"""
Tests for the starter group catalogue and GET /groups/catalog.
"""

from fastapi.testclient import TestClient

from config.group_catalog import GROUP_CATALOG, get_catalog_entry


def test_catalog_has_15_unique_keys():
    keys = [entry.key for entry in GROUP_CATALOG]
    assert len(GROUP_CATALOG) == 15
    assert len(set(keys)) == 15
    preselected = {entry.key for entry in GROUP_CATALOG if entry.preselected}
    assert preselected == {"HOME", "WORK", "SHOPPING", "HOBBY"}


def test_catalog_entries_have_keywords_and_helpers():
    for entry in GROUP_CATALOG:
        assert 5 <= len(entry.keywords_pl) <= 10
        assert 5 <= len(entry.keywords_en) <= 10
    home = get_catalog_entry("HOME")
    assert home is not None
    assert home.name("pl") == "Dom"
    assert home.name("en") == "Home"
    assert home.name("de") == "Home"
    text = home.match_text()
    assert "Dom" in text and "Home" in text and "sprzątanie" in text
    assert get_catalog_entry("NOPE") is None


def test_catalog_endpoint_returns_user_language(
    authenticated_client: TestClient, test_user, test_db
):
    test_user.language = "pl"
    test_db.commit()

    response = authenticated_client.get("/groups/catalog")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 15
    assert data[0] == {
        "key": "HOME",
        "icon": "🏠",
        "color": "blue",
        "name": "Dom",
        "preselected": True,
    }


def test_catalog_endpoint_english(authenticated_client: TestClient, test_user, test_db):
    test_user.language = "en"
    test_db.commit()

    response = authenticated_client.get("/groups/catalog")

    assert response.status_code == 200
    errands = next(item for item in response.json() if item["key"] == "ERRANDS")
    assert errands["name"] == "Errands"


def test_catalog_requires_auth(client: TestClient):
    response = client.get("/groups/catalog")
    assert response.status_code == 401
