import numpy as np
import pytest

from main import app
from models.group import Group
from models.todo import Todo
from services import embedder
from services.embedder import (
    EMBEDDING_DIM,
    bytes_to_vector,
    embed_one,
    get_embedder,
    install_embedder,
    todo_embedding_text,
    vector_to_bytes,
)
from tests.fakes import FailingEmbedder, FakeEmbedder


def test_vector_roundtrip():
    v = np.random.default_rng(0).random(EMBEDDING_DIM).astype(np.float32)
    data = vector_to_bytes(v)
    assert len(data) == 1536
    assert np.array_equal(bytes_to_vector(data), v)


def test_todo_embedding_text_truncates_description():
    text = todo_embedding_text("Title", "x" * 500)
    assert text == "Title. " + "x" * 300


def test_todo_embedding_text_without_description():
    assert todo_embedding_text("Title", None) == "Title"
    assert todo_embedding_text("Title", "  ") == "Title"


def test_fake_embedder_identical_text_cosine_one():
    vectors = FakeEmbedder().embed(["Buy milk", "buy MILK"])
    assert vectors.shape == (2, EMBEDDING_DIM)
    assert vectors.dtype == np.float32
    assert float(vectors[0] @ vectors[1]) == pytest.approx(1.0)


def test_fake_embedder_empty_text_is_zero_row():
    assert not FakeEmbedder().embed([""]).any()


def test_failing_embedder_raises():
    with pytest.raises(RuntimeError):
        FailingEmbedder().embed(["x"])


def test_get_embedder_returns_none_when_disabled(monkeypatch):
    monkeypatch.setenv("AI_SUGGESTIONS_ENABLED", "false")
    embedder.reset_embedder()
    assert get_embedder() is None


def test_get_embedder_caches_load_failure(monkeypatch):
    calls = []

    class Boom:
        def __init__(self):
            calls.append(1)
            raise RuntimeError("no model")

    monkeypatch.setenv("AI_SUGGESTIONS_ENABLED", "true")
    monkeypatch.setattr(embedder, "FastEmbedEmbedder", Boom)
    embedder.reset_embedder()
    try:
        assert get_embedder() is None
        assert get_embedder() is None
        assert len(calls) == 1
    finally:
        embedder.reset_embedder()


def test_get_embedder_returns_fake_in_tests(monkeypatch):
    monkeypatch.setenv("AI_SUGGESTIONS_ENABLED", "true")
    assert isinstance(get_embedder(), FakeEmbedder)


# --- embed_one -------------------------------------------------------------


def test_embed_one_returns_bytes():
    assert len(embed_one(FakeEmbedder(), "Buy milk")) == 1536


def test_embed_one_none_embedder():
    assert embed_one(None, "Buy milk") is None


def test_embed_one_failure_is_swallowed_and_not_logged_with_text(caplog):
    assert embed_one(FailingEmbedder(), "secret task text") is None
    assert "secret task text" not in caplog.text


# --- stored vectors --------------------------------------------------------


def _todo_embedding(test_db, todo_id):
    test_db.expire_all()
    return test_db.get(Todo, todo_id).embedding


def _group_embedding(test_db, group_id):
    test_db.expire_all()
    return test_db.get(Group, group_id).embedding


def test_create_todo_stores_embedding(authenticated_client, test_db):
    response = authenticated_client.post("/todos", json={"title": "Buy milk"})
    assert response.status_code == 201
    assert len(_todo_embedding(test_db, response.json()["id"])) == 1536


def test_todo_response_has_no_embedding(authenticated_client):
    created = authenticated_client.post("/todos", json={"title": "Buy milk"})
    assert "embedding" not in created.json()
    todo_id = created.json()["id"]
    assert "embedding" not in authenticated_client.get(f"/todos/{todo_id}").json()
    assert "embedding" not in authenticated_client.get("/todos").json()[0]


def test_group_response_has_no_embedding(authenticated_client):
    created = authenticated_client.post("/groups", json={"name": "Home"})
    assert "embedding" not in created.json()
    assert "embedding" not in authenticated_client.get("/groups").json()[0]


def test_todo_title_update_recomputes_embedding(authenticated_client, test_db):
    todo_id = authenticated_client.post("/todos", json={"title": "Buy milk"}).json()[
        "id"
    ]
    before = _todo_embedding(test_db, todo_id)

    authenticated_client.put(f"/todos/{todo_id}", json={"completed": True})
    assert _todo_embedding(test_db, todo_id) == before

    authenticated_client.put(f"/todos/{todo_id}", json={"title": "Call the dentist"})
    assert _todo_embedding(test_db, todo_id) != before


def test_todo_description_update_recomputes_embedding(authenticated_client, test_db):
    todo_id = authenticated_client.post("/todos", json={"title": "Buy milk"}).json()[
        "id"
    ]
    before = _todo_embedding(test_db, todo_id)
    authenticated_client.put(f"/todos/{todo_id}", json={"description": "oat, 2 cans"})
    assert _todo_embedding(test_db, todo_id) != before


def test_create_group_stores_embedding(authenticated_client, test_db):
    response = authenticated_client.post("/groups", json={"name": "Home"})
    assert response.status_code == 201
    assert len(_group_embedding(test_db, response.json()["id"])) == 1536


def test_group_rename_recomputes_embedding(authenticated_client, test_db):
    group_id = authenticated_client.post("/groups", json={"name": "Home"}).json()["id"]
    before = _group_embedding(test_db, group_id)

    authenticated_client.put(f"/groups/{group_id}", json={"color": "red"})
    assert _group_embedding(test_db, group_id) == before

    authenticated_client.put(f"/groups/{group_id}", json={"name": "Work"})
    assert _group_embedding(test_db, group_id) != before


def test_onboarding_groups_get_embeddings(authenticated_client, test_db):
    response = authenticated_client.post(
        "/users/me/onboarding", json={"groupKeys": ["HOME", "HEALTH"]}
    )
    assert response.status_code == 200
    test_db.expire_all()
    groups = test_db.query(Group).all()
    assert len(groups) == 2
    assert all(g.embedding is not None and len(g.embedding) == 1536 for g in groups)


def test_create_todo_succeeds_when_embedder_fails(authenticated_client, test_db):
    app.dependency_overrides[get_embedder] = lambda: FailingEmbedder()
    install_embedder(FailingEmbedder())
    try:
        response = authenticated_client.post("/todos", json={"title": "Buy milk"})
        group = authenticated_client.post("/groups", json={"name": "Home"})
    finally:
        app.dependency_overrides[get_embedder] = lambda: FakeEmbedder()
        install_embedder(FakeEmbedder())
    assert response.status_code == 201
    assert group.status_code == 201
    assert _todo_embedding(test_db, response.json()["id"]) is None
    assert _group_embedding(test_db, group.json()["id"]) is None


def test_create_todo_succeeds_when_embedder_unavailable(authenticated_client, test_db):
    app.dependency_overrides[get_embedder] = lambda: None
    try:
        response = authenticated_client.post("/todos", json={"title": "Buy milk"})
    finally:
        app.dependency_overrides[get_embedder] = lambda: FakeEmbedder()
    assert response.status_code == 201
    assert _todo_embedding(test_db, response.json()["id"]) is None
