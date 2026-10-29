"""
Group suggestion for a new todo, from local text embeddings.

For the new todo's vector q and each of the user's groups g:
name_sim = cos(q, g), knn_sim = mean of the top-3 cos(q, t) over g's todos,
score(g) = max(name_sim, knn_sim). The best group is "high" at T_HIGH and
"medium" at T_MED; below that, the best catalogue group the user doesn't
have is proposed at T_CATALOG; otherwise there is no suggestion.

Two refinements, measured with scripts/eval_suggestions.py (raw cosines
scored 17/41 there; with both, 35/41):
- Every cosine is taken after removing the mean vector of the catalogue
  words. Short texts share a large common component in this model, so raw
  cosines rank e.g. "Coś" closest to "Zakupy" (0.67).
- A group named like a catalogue entry (either language) is also compared
  with that entry's names and keywords: name_sim is the better of the two.
"""

import logging
import weakref
from collections.abc import Iterable, Sequence
from dataclasses import dataclass

import numpy as np
from sqlalchemy import update
from sqlalchemy.orm import Session

from config.group_catalog import GROUP_CATALOG, CatalogEntry
from models.group import Group
from models.schemas import GroupSuggestion, SuggestedNewGroup
from models.todo import Todo
from models.user import User
from services.embedder import (
    Embedder,
    bytes_to_vector,
    todo_embedding_text,
    vector_to_bytes,
)

logger = logging.getLogger(__name__)

# Tuned with scripts/eval_suggestions.py: high 20/21 precise, accuracy 35/41.
T_HIGH = 0.30
T_MED = 0.25
T_CATALOG = 0.25

KNN_K = 3
BACKFILL_TODO_LIMIT = 200
# Upper bound on the past todos compared per request (newest first).
KNN_TODO_LIMIT = 1000

NO_SUGGESTION = GroupSuggestion(confidence="low")


class SuggestionsUnavailableError(Exception):
    """The embedder failed, so no suggestion can be computed."""


@dataclass(frozen=True)
class GroupMatch:
    group_id: int
    score: float
    reason: str | None


def _embed(embedder: Embedder, texts: list[str]) -> np.ndarray:
    try:
        return embedder.embed(texts)
    except Exception as exc:
        # Logged without the texts, which are user content.
        logger.exception("Could not compute embeddings for a suggestion")
        raise SuggestionsUnavailableError from exc


def _normalize(vectors: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(vectors, axis=-1, keepdims=True)
    return vectors / np.where(norms == 0, 1, norms)


@dataclass(frozen=True)
class CatalogSpace:
    """The mean vector removed before every cosine, plus the catalogue vectors."""

    mean: np.ndarray
    # Centred match_text() vector per GROUP_CATALOG entry, in catalogue order.
    entries: np.ndarray

    def center(self, vectors: np.ndarray) -> np.ndarray:
        """Remove the mean and renormalize (one vector or a matrix of rows)."""
        return _normalize(vectors - self.mean)


# One space per embedder instance, so vectors of different models (or of the
# test fake) never mix. Weak keys drop the entry together with the embedder.
_spaces: "weakref.WeakKeyDictionary[Embedder, CatalogSpace]" = (
    weakref.WeakKeyDictionary()
)


def catalog_space(embedder: Embedder) -> CatalogSpace:
    """Embed the catalogue once per embedder: entries and the word mean."""
    space = _spaces.get(embedder)
    if space is None:
        words = sorted(
            {
                word
                for entry in GROUP_CATALOG
                for word in (
                    entry.name_pl,
                    entry.name_en,
                    *entry.keywords_pl,
                    *entry.keywords_en,
                )
            }
        )
        vectors = _embed(
            embedder, [entry.match_text() for entry in GROUP_CATALOG] + words
        )
        mean = vectors[len(GROUP_CATALOG) :].mean(axis=0)
        space = CatalogSpace(
            mean=mean, entries=_normalize(vectors[: len(GROUP_CATALOG)] - mean)
        )
        _spaces[embedder] = space
    return space


def _catalog_index(name: str) -> int | None:
    """Index of the catalogue entry named `name` in either language, if any."""
    folded = name.casefold()
    for index, entry in enumerate(GROUP_CATALOG):
        if folded in (entry.name_pl.casefold(), entry.name_en.casefold()):
            return index
    return None


def group_vectors(space: CatalogSpace, name: str, vector: np.ndarray) -> np.ndarray:
    """
    Centred vectors a group's name is compared by: the stored name vector and,
    for a group named like a catalogue entry, that entry's vector.
    """
    rows = [space.center(vector)]
    index = _catalog_index(name)
    if index is not None:
        rows.append(space.entries[index])
    return np.stack(rows)


def best_group(
    q: np.ndarray,
    groups: Sequence[tuple[int, np.ndarray]],
    todos: Sequence[tuple[int, str, np.ndarray]],
) -> GroupMatch | None:
    """
    Score the user's groups against the query vector and return the best one.

    Args:
        q: Centred query vector.
        groups: (group_id, centred name vectors as rows; see group_vectors).
        todos: (group_id, title, centred vector) of the user's grouped todos.

    Returns:
        GroupMatch | None: The best group with its score and reason, or None
        when there are no groups.
    """
    todo_sims: dict[int, list[tuple[float, str]]] = {}
    if todos:
        sims = np.stack([vector for _, _, vector in todos]) @ q
        for (group_id, title, _), sim in zip(todos, sims, strict=True):
            todo_sims.setdefault(group_id, []).append((float(sim), title))

    best: GroupMatch | None = None
    for group_id, vectors in groups:
        name_sim = float((vectors @ q).max())
        top = sorted(todo_sims.get(group_id, []), key=lambda s: s[0], reverse=True)
        top = top[:KNN_K]
        knn_sim = sum(sim for sim, _ in top) / len(top) if top else None
        if knn_sim is not None and knn_sim > name_sim:
            match = GroupMatch(group_id, knn_sim, top[0][1])
        else:
            match = GroupMatch(group_id, name_sim, None)
        if best is None or match.score > best.score:
            best = match
    return best


def best_catalog_entry(
    q: np.ndarray, space: CatalogSpace, owned_names: Iterable[str]
) -> tuple[CatalogEntry, float] | None:
    """
    Return the catalogue entry closest to the centred q among those the user
    doesn't have: none of their group names equals, casefolded, its Polish or
    English name.
    """
    owned = {name.casefold() for name in owned_names}
    sims = space.entries @ q
    best: tuple[CatalogEntry, float] | None = None
    for entry, sim in zip(GROUP_CATALOG, sims, strict=True):
        if entry.name_pl.casefold() in owned or entry.name_en.casefold() in owned:
            continue
        if best is None or sim > best[1]:
            best = (entry, float(sim))
    return best


def backfill_embeddings(db: Session, user: User, embedder: Embedder) -> None:
    """
    Embed the user's groups and up to BACKFILL_TODO_LIMIT newest todos that
    have no vector yet (created while the model was unavailable), in one call.

    Writes with Core updates that keep updated_at: a backfill is not an edit.

    Raises:
        SuggestionsUnavailableError: If the embedder fails.
    """
    groups = (
        db.query(Group.id, Group.name)
        .filter(Group.user_id == user.id, Group.embedding.is_(None))
        .all()
    )
    todos = (
        db.query(Todo.id, Todo.title, Todo.description)
        .filter(Todo.user_id == user.id, Todo.embedding.is_(None))
        .order_by(Todo.created_at.desc(), Todo.id.desc())
        .limit(BACKFILL_TODO_LIMIT)
        .all()
    )
    if not groups and not todos:
        return

    texts = [g.name for g in groups] + [
        todo_embedding_text(t.title, t.description) for t in todos
    ]
    vectors = iter(_embed(embedder, texts))
    for g in groups:
        db.execute(
            update(Group)
            .where(Group.id == g.id)
            .values(
                embedding=vector_to_bytes(next(vectors)), updated_at=Group.updated_at
            )
        )
    for t in todos:
        db.execute(
            update(Todo)
            .where(Todo.id == t.id)
            .values(
                embedding=vector_to_bytes(next(vectors)), updated_at=Todo.updated_at
            )
        )
    db.commit()


def suggest_group(
    db: Session,
    user: User,
    embedder: Embedder,
    title: str,
    description: str | None,
) -> GroupSuggestion:
    """
    Suggest one of the user's groups, or a catalogue group, for a new todo.

    Raises:
        SuggestionsUnavailableError: If the embedder fails.
    """
    backfill_embeddings(db, user, embedder)
    space = catalog_space(embedder)
    q = space.center(_embed(embedder, [todo_embedding_text(title, description)])[0])

    groups = (
        db.query(Group.id, Group.name, Group.embedding)
        .filter(Group.user_id == user.id)
        .all()
    )
    todos = (
        db.query(Todo.group_id, Todo.title, Todo.embedding)
        .filter(
            Todo.user_id == user.id,
            Todo.group_id.is_not(None),
            Todo.embedding.is_not(None),
        )
        .order_by(Todo.created_at.desc(), Todo.id.desc())
        .limit(KNN_TODO_LIMIT)
        .all()
    )

    match = best_group(
        q,
        [
            (g.id, group_vectors(space, g.name, bytes_to_vector(g.embedding)))
            for g in groups
            if g.embedding
        ],
        [
            (t.group_id, t.title, space.center(bytes_to_vector(t.embedding)))
            for t in todos
        ],
    )
    if match is not None and match.score >= T_HIGH:
        return GroupSuggestion(
            group_id=match.group_id, confidence="high", reason=match.reason
        )
    if match is not None and match.score >= T_MED:
        return GroupSuggestion(
            group_id=match.group_id, confidence="medium", reason=match.reason
        )

    catalog = best_catalog_entry(q, space, [g.name for g in groups])
    if catalog is not None and catalog[1] >= T_CATALOG:
        entry = catalog[0]
        return GroupSuggestion(
            new_group=SuggestedNewGroup(
                key=entry.key, name=entry.name(user.language), color=entry.color
            ),
            confidence="medium",
        )
    return NO_SUGGESTION
