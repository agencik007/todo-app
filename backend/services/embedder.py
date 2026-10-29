"""Local multilingual sentence embeddings (fastembed, ONNX, no network at runtime)."""

import logging
import os
import threading
from typing import Protocol

import numpy as np

logger = logging.getLogger(__name__)

EMBEDDING_DIM = 384
MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
DESCRIPTION_MAX_CHARS = 300


class Embedder(Protocol):
    def embed(self, texts: list[str]) -> np.ndarray:
        """Return a float32 array of shape (n, EMBEDDING_DIM) with L2-normalized rows."""
        ...


class FastEmbedEmbedder:
    def __init__(self) -> None:
        from fastembed import TextEmbedding

        self._model = TextEmbedding(
            MODEL_NAME, cache_dir=os.getenv("FASTEMBED_CACHE_DIR")
        )

    def embed(self, texts: list[str]) -> np.ndarray:
        vectors = np.asarray(list(self._model.embed(texts)), dtype=np.float32)
        vectors = vectors.reshape(len(texts), EMBEDDING_DIM)
        norms = np.linalg.norm(vectors, axis=1, keepdims=True)
        return vectors / np.where(norms == 0, 1, norms)


_lock = threading.Lock()
_loaded = False
_embedder: Embedder | None = None


def reset_embedder() -> None:
    """Forget the cached embedder (and cached load failure). For tests."""
    global _loaded, _embedder
    with _lock:
        _loaded = False
        _embedder = None


def install_embedder(instance: Embedder | None) -> None:
    """Make `instance` the process-wide embedder without loading a model. For tests."""
    global _loaded, _embedder
    with _lock:
        _embedder = instance
        _loaded = True


def get_embedder() -> Embedder | None:
    """FastAPI dependency: lazy per-process singleton.

    Returns None when AI_SUGGESTIONS_ENABLED is false or the model failed to
    load (logged once; the failure is cached and not retried).
    """
    global _loaded, _embedder
    if os.getenv("AI_SUGGESTIONS_ENABLED", "true").strip().lower() in (
        "false",
        "0",
        "no",
        "off",
    ):
        return None
    with _lock:
        if not _loaded:
            try:
                _embedder = FastEmbedEmbedder()
            except Exception:
                logger.exception("Could not load the embedding model")
                _embedder = None
            _loaded = True
        return _embedder


def vector_to_bytes(v: np.ndarray) -> bytes:
    return np.asarray(v, dtype=np.float32).tobytes()


def bytes_to_vector(b: bytes) -> np.ndarray:
    return np.frombuffer(b, dtype=np.float32).copy()


def embed_one(embedder: Embedder | None, text: str) -> bytes | None:
    """Embed `text` into storable bytes; None if there is no embedder or it fails.

    Failures are logged without the text, which is user content.
    """
    if embedder is None:
        return None
    try:
        return vector_to_bytes(embedder.embed([text])[0])
    except Exception:
        logger.exception("Could not compute an embedding")
        return None


def todo_embedding_text(title: str, description: str | None) -> str:
    description = (description or "").strip()
    if not description:
        return title
    return f"{title}. {description[:DESCRIPTION_MAX_CHARS]}"
