import re
import zlib

import numpy as np

from services.embedder import EMBEDDING_DIM


class FakeEmbedder:
    """Deterministic hashed bag of words: same words -> same vector."""

    def embed(self, texts: list[str]) -> np.ndarray:
        out = np.zeros((len(texts), EMBEDDING_DIM), dtype=np.float32)
        for row, text in enumerate(texts):
            for token in re.split(r"\W+", text.lower()):
                if token:
                    out[row, zlib.crc32(token.encode("utf-8")) % EMBEDDING_DIM] += 1
            norm = np.linalg.norm(out[row])
            if norm > 0:
                out[row] /= norm
        return out


class FailingEmbedder:
    def embed(self, texts: list[str]) -> np.ndarray:
        raise RuntimeError("embedding failed")
