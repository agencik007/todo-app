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
    get_loaded_embedder,
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


def test_onboarding_embeds_all_groups_in_one_call(
    authenticated_client, test_db, monkeypatch
):
    calls: list[list[str]] = []

    class CountingEmbedder(FakeEmbedder):
        def embed(self, texts):
            calls.append(list(texts))
            return super().embed(texts)

    counting = CountingEmbedder()
    monkeypatch.setitem(app.dependency_overrides, get_loaded_embedder, lambda: counting)

    response = authenticated_client.post(
        "/users/me/onboarding", json={"groupKeys": ["HOME", "WORK", "HEALTH"]}
    )

    assert response.status_code == 200
    assert calls == [["Home", "Work", "Health"]]
    test_db.expire_all()
    groups = {g.name: g.embedding for g in test_db.query(Group).all()}
    assert groups == {
        name: vector_to_bytes(FakeEmbedder().embed([name])[0])
        for name in ("Home", "Work", "Health")
    }


def test_onboarding_succeeds_without_vectors_when_embedder_fails(
    authenticated_client, test_db, monkeypatch
):
    failing = FailingEmbedder()
    monkeypatch.setitem(app.dependency_overrides, get_loaded_embedder, lambda: failing)

    response = authenticated_client.post(
        "/users/me/onboarding", json={"groupKeys": ["HOME", "WORK"]}
    )

    assert response.status_code == 200
    test_db.expire_all()
    assert [g.embedding for g in test_db.query(Group).all()] == [None, None]


def test_warm_up_embedder_loads_the_model_in_a_thread(monkeypatch):
    loaded = FakeEmbedder()
    monkeypatch.setenv("AI_SUGGESTIONS_ENABLED", "true")
    monkeypatch.setattr(embedder, "FastEmbedEmbedder", lambda: loaded)
    embedder.reset_embedder()

    thread = embedder.warm_up_embedder()

    assert thread is not None
    thread.join(timeout=5)
    assert get_embedder() is loaded


def test_warm_up_embedder_runs_after_with_the_loaded_embedder(monkeypatch):
    loaded = FakeEmbedder()
    seen = []
    monkeypatch.setenv("AI_SUGGESTIONS_ENABLED", "true")
    monkeypatch.setattr(embedder, "FastEmbedEmbedder", lambda: loaded)
    embedder.reset_embedder()

    embedder.warm_up_embedder(after=seen.append).join(timeout=5)

    assert seen == [loaded]


def test_warm_up_embedder_survives_a_failing_after(monkeypatch, caplog):
    def boom(_embedder):
        raise RuntimeError("no catalogue")

    monkeypatch.setenv("AI_SUGGESTIONS_ENABLED", "true")
    monkeypatch.setattr(embedder, "FastEmbedEmbedder", FakeEmbedder)
    embedder.reset_embedder()

    embedder.warm_up_embedder(after=boom).join(timeout=5)

    assert "Could not warm up the embedder" in caplog.text


def test_warm_up_embedder_survives_a_load_failure(monkeypatch):
    def boom():
        raise RuntimeError("no model")

    monkeypatch.setenv("AI_SUGGESTIONS_ENABLED", "true")
    monkeypatch.setattr(embedder, "FastEmbedEmbedder", boom)
    embedder.reset_embedder()

    embedder.warm_up_embedder().join(timeout=5)

    assert get_embedder() is None


def test_warm_up_embedder_does_nothing_when_disabled(monkeypatch):
    monkeypatch.setenv("AI_SUGGESTIONS_ENABLED", "false")
    assert embedder.warm_up_embedder() is None


def test_create_todo_succeeds_when_embedder_fails(authenticated_client, test_db):
    app.dependency_overrides[get_loaded_embedder] = lambda: FailingEmbedder()
    install_embedder(FailingEmbedder())
    try:
        response = authenticated_client.post("/todos", json={"title": "Buy milk"})
        group = authenticated_client.post("/groups", json={"name": "Home"})
    finally:
        app.dependency_overrides[get_loaded_embedder] = lambda: FakeEmbedder()
        install_embedder(FakeEmbedder())
    assert response.status_code == 201
    assert group.status_code == 201
    assert _todo_embedding(test_db, response.json()["id"]) is None
    assert _group_embedding(test_db, group.json()["id"]) is None


def test_create_todo_succeeds_when_embedder_unavailable(authenticated_client, test_db):
    app.dependency_overrides[get_loaded_embedder] = lambda: None
    try:
        response = authenticated_client.post("/todos", json={"title": "Buy milk"})
    finally:
        app.dependency_overrides[get_loaded_embedder] = lambda: FakeEmbedder()
    assert response.status_code == 201
    assert _todo_embedding(test_db, response.json()["id"]) is None


def test_get_loaded_embedder_never_loads_the_model(monkeypatch):
    def boom():
        raise AssertionError("the model must not be loaded")

    monkeypatch.setenv("AI_SUGGESTIONS_ENABLED", "true")
    monkeypatch.setattr(embedder, "FastEmbedEmbedder", boom)
    embedder.reset_embedder()
    assert get_loaded_embedder() is None

    fake = FakeEmbedder()
    install_embedder(fake)
    assert get_loaded_embedder() is fake


def test_get_loaded_embedder_returns_none_when_disabled(monkeypatch):
    monkeypatch.setenv("AI_SUGGESTIONS_ENABLED", "false")
    install_embedder(FakeEmbedder())
    assert get_loaded_embedder() is None


def test_write_never_loads_the_model_and_suggest_backfills(
    authenticated_client, test_db, monkeypatch
):
    """A write before the model is loaded saves a NULL vector at once; the
    next suggestion (which may load the model) fills it in."""
    loads = []

    def recording_load():
        loads.append(1)
        return FakeEmbedder()

    monkeypatch.setenv("AI_SUGGESTIONS_ENABLED", "true")
    monkeypatch.setattr(embedder, "FastEmbedEmbedder", recording_load)
    embedder.reset_embedder()
    # The real dependencies, not the autouse FakeEmbedder overrides.
    app.dependency_overrides.pop(get_embedder, None)
    app.dependency_overrides.pop(get_loaded_embedder, None)

    response = authenticated_client.post("/todos", json={"title": "Buy milk"})
    assert response.status_code == 201
    todo_id = response.json()["id"]
    assert _todo_embedding(test_db, todo_id) is None
    assert loads == []

    suggestion = authenticated_client.post(
        "/todos/suggest-group", json={"title": "Buy bread"}
    )
    assert suggestion.status_code == 200
    assert loads == [1]
    assert _todo_embedding(test_db, todo_id) is not None
