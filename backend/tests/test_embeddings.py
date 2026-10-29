import numpy as np
import pytest

from services import embedder
from services.embedder import (
    EMBEDDING_DIM,
    bytes_to_vector,
    get_embedder,
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
