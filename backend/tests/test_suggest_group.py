"""
Tests for POST /todos/suggest-group (local embedding group suggestions).
"""

import pytest
from starlette.requests import Request

from main import app
from models.group import Group
from models.todo import Todo
from routes.todo import suggestion_rate_limit_key
from services import suggestion_service
from services.auth_service import create_access_token
from services.embedder import get_embedder, install_embedder
from tests.fakes import FailingEmbedder

URL = "/todos/suggest-group"


@pytest.fixture(autouse=True)
def fake_thresholds(monkeypatch):
    """Thresholds that fit FakeEmbedder's bag-of-words cosine similarities."""
    monkeypatch.setattr(suggestion_service, "T_HIGH", 0.8)
    monkeypatch.setattr(suggestion_service, "T_MED", 0.5)
    monkeypatch.setattr(suggestion_service, "T_CATALOG", 0.2)


def _group(db, user, name: str) -> Group:
    group = Group(name=name, color="blue", user_id=user.id)
    db.add(group)
    db.commit()
    db.refresh(group)
    return group


def _todo(db, user, title: str, group: Group | None = None) -> Todo:
    todo = Todo(
        title=title,
        user_id=user.id,
        group_id=group.id if group else None,
    )
    db.add(todo)
    db.commit()
    db.refresh(todo)
    return todo


def test_suggest_high_by_group_name(authenticated_client, test_db, test_user):
    group = _group(test_db, test_user, "zakupy")

    response = authenticated_client.post(URL, json={"title": "zakupy"})

    assert response.status_code == 200
    assert response.json() == {
        "groupId": group.id,
        "newGroup": None,
        "confidence": "high",
        "reason": None,
    }


def test_suggest_high_by_past_todos(authenticated_client, test_db, test_user):
    group = _group(test_db, test_user, "Dom")
    for _ in range(3):
        _todo(test_db, test_user, "kupić mleko chleb", group)

    response = authenticated_client.post(URL, json={"title": "kupić mleko chleb"})

    body = response.json()
    assert body["groupId"] == group.id
    assert body["confidence"] == "high"
    assert body["reason"] == "kupić mleko chleb"


def test_suggest_medium(authenticated_client, test_db, test_user):
    group = _group(test_db, test_user, "mleko chleb")

    response = authenticated_client.post(
        URL, json={"title": "mleko chleb", "description": "masło ser"}
    )

    body = response.json()
    assert body["groupId"] == group.id
    assert body["newGroup"] is None
    assert body["confidence"] == "medium"


def test_suggest_catalog_new_group(authenticated_client, test_db, test_user):
    test_user.language = "pl"
    test_db.commit()
    _group(test_db, test_user, "Praca")

    response = authenticated_client.post(URL, json={"title": "dentysta lekarz"})

    body = response.json()
    assert body["groupId"] is None
    assert body["newGroup"] == {"key": "HEALTH", "name": "Zdrowie", "color": "red"}
    assert body["reason"] is None


def test_catalogue_named_group_matches_by_catalogue_keywords(
    authenticated_client, test_db, test_user, monkeypatch
):
    # The name alone shares no word with the title; HEALTH's keywords do.
    monkeypatch.setattr(suggestion_service, "T_MED", 0.2)
    group = _group(test_db, test_user, "Zdrowie")
    _group(test_db, test_user, "Praca")

    response = authenticated_client.post(URL, json={"title": "dentysta lekarz"})

    body = response.json()
    assert body["groupId"] == group.id
    assert body["newGroup"] is None
    assert body["reason"] is None


def test_catalog_skips_group_user_has_in_other_language(
    authenticated_client, test_db, test_user
):
    test_user.language = "pl"
    test_db.commit()
    _group(test_db, test_user, "Health")

    response = authenticated_client.post(URL, json={"title": "dentysta lekarz"})

    new_group = response.json()["newGroup"]
    assert new_group is None or new_group["key"] != "HEALTH"


def test_suggest_no_match_returns_low_nulls(authenticated_client, test_db, test_user):
    _group(test_db, test_user, "Praca")

    response = authenticated_client.post(URL, json={"title": "xyzzy"})

    assert response.status_code == 200
    assert response.json() == {
        "groupId": None,
        "newGroup": None,
        "confidence": "low",
        "reason": None,
    }


def test_suggest_ignores_other_users_groups(
    authenticated_client, test_db, test_user, second_user
):
    _group(test_db, second_user, "zakupy")

    response = authenticated_client.post(URL, json={"title": "zakupy"})

    assert response.json()["groupId"] is None


def test_suggest_backfills_null_embeddings(authenticated_client, test_db, test_user):
    group = _group(test_db, test_user, "Dom")
    todo = _todo(test_db, test_user, "umyć okna", group)
    assert group.embedding is None and todo.embedding is None
    updated_at = todo.updated_at

    response = authenticated_client.post(URL, json={"title": "coś"})

    assert response.status_code == 200
    test_db.refresh(group)
    test_db.refresh(todo)
    assert len(group.embedding) == 1536
    assert len(todo.embedding) == 1536
    # A backfill isn't an edit: the "updated" time shown to the user stays.
    assert todo.updated_at == updated_at


def test_suggest_returns_503_when_embedder_unavailable(
    authenticated_client, monkeypatch
):
    monkeypatch.setitem(app.dependency_overrides, get_embedder, lambda: None)
    install_embedder(None)

    response = authenticated_client.post(URL, json={"title": "zakupy"})

    assert response.status_code == 503
    assert response.json()["detail"] == {"messageCode": "SUGGESTIONS_UNAVAILABLE"}


def test_suggest_returns_503_when_embedder_raises(authenticated_client, monkeypatch):
    failing = FailingEmbedder()
    monkeypatch.setitem(app.dependency_overrides, get_embedder, lambda: failing)
    install_embedder(failing)

    response = authenticated_client.post(URL, json={"title": "zakupy"})

    assert response.status_code == 503
    assert response.json()["detail"] == {"messageCode": "SUGGESTIONS_UNAVAILABLE"}


def test_suggest_validates_title_length(authenticated_client):
    assert authenticated_client.post(URL, json={"title": ""}).status_code == 422
    assert authenticated_client.post(URL, json={"title": "x" * 201}).status_code == 422
    assert (
        authenticated_client.post(
            URL, json={"title": "ok", "description": "x" * 1001}
        ).status_code
        == 422
    )


def test_suggest_requires_auth(client):
    assert client.post(URL, json={"title": "zakupy"}).status_code == 401


def _request(headers: dict[str, str]) -> Request:
    return Request(
        {
            "type": "http",
            "headers": [(k.lower().encode(), v.encode()) for k, v in headers.items()],
            "client": ("10.0.0.1", 1234),
        }
    )


def test_rate_limit_key_is_user_id_from_access_token():
    token = create_access_token({"sub": "42"})
    assert (
        suggestion_rate_limit_key(_request({"Authorization": f"Bearer {token}"}))
        == "user:42"
    )


def test_rate_limit_key_falls_back_to_ip():
    assert suggestion_rate_limit_key(_request({})) == "10.0.0.1"
    assert (
        suggestion_rate_limit_key(_request({"Authorization": "Bearer nonsense"}))
        == "10.0.0.1"
    )
