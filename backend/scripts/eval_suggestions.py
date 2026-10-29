"""
Offline evaluation of the group suggestion thresholds with the real model.

Scores the labelled cases in tests/data/suggestion_eval.json in memory (no
database): the user owns the listed groups and has no past todos, so only
group names and the catalogue match. Prints the score per case, the
precision of "high" auto-fills per T_HIGH, and the overall accuracy for a
grid of T_MED / T_CATALOG.

Run inside the backend container (needs the baked model, not run by pytest):
    python -m scripts.eval_suggestions
"""

import json
from itertools import product
from pathlib import Path

import numpy as np

import config  # noqa: F401 - import first: services/__init__ <-> config cycle
from services import suggestion_service
from services.embedder import FastEmbedEmbedder, todo_embedding_text

DATA = (
    Path(__file__).resolve().parent.parent / "tests" / "data" / "suggestion_eval.json"
)
GRID = [round(x, 3) for x in np.arange(0.10, 0.801, 0.025)]


def score_cases(embedder, groups: list[str], cases: list[dict]) -> list[dict]:
    space = suggestion_service.catalog_space(embedder)
    group_rows = [
        (index, suggestion_service.group_vectors(space, name, vector))
        for index, (name, vector) in enumerate(
            zip(groups, embedder.embed(groups), strict=True)
        )
    ]
    queries = space.center(
        embedder.embed(
            [todo_embedding_text(c["title"], c["description"]) for c in cases]
        )
    )
    scored = []
    for case, q in zip(cases, queries, strict=True):
        match = suggestion_service.best_group(q, group_rows, todos=[])
        entry, cat_score = suggestion_service.best_catalog_entry(q, space, groups)
        scored.append(
            {
                **case,
                "group": groups[match.group_id],
                "group_score": match.score,
                "catalog": f"catalog:{entry.key}",
                "catalog_score": cat_score,
            }
        )
    return scored


def predict(case: dict, t_med: float, t_cat: float) -> str | None:
    if case["group_score"] >= t_med:
        return case["group"]
    if case["catalog_score"] >= t_cat:
        return case["catalog"]
    return None


def main() -> None:
    data = json.loads(DATA.read_text(encoding="utf-8"))
    groups, cases = data["groups"], data["cases"]
    embedder = FastEmbedEmbedder()
    scored = score_cases(embedder, groups, cases)

    print(f"{'title':42} {'expected':16} {'best group':18} {'best catalogue':24}")
    for c in scored:
        print(
            f"{c['title'][:42]:42} {c['expected']!s:16} "
            f"{c['group']:10} {c['group_score']:.3f}  "
            f"{c['catalog']:17} {c['catalog_score']:.3f}"
        )

    print("\nT_HIGH  auto-fills  correct  precision")
    for t_high in GRID:
        high = [c for c in scored if c["group_score"] >= t_high]
        correct = sum(c["expected"] == c["group"] for c in high)
        precision = correct / len(high) if high else float("nan")
        print(f"{t_high:6.3f}  {len(high):10d}  {correct:7d}  {precision:9.2%}")

    results = sorted(
        (
            (
                sum(predict(c, t_med, t_cat) == c["expected"] for c in scored),
                t_med,
                t_cat,
            )
            for t_med, t_cat in product(GRID, GRID)
        ),
        key=lambda r: (-r[0], r[1], r[2]),
    )
    print("\nTop T_MED / T_CATALOG by accuracy")
    for correct, t_med, t_cat in results[:25]:
        print(f"T_MED={t_med:.3f} T_CATALOG={t_cat:.3f}  {correct}/{len(scored)}")

    current = (suggestion_service.T_MED, suggestion_service.T_CATALOG)
    correct = sum(predict(c, *current) == c["expected"] for c in scored)
    high = [c for c in scored if c["group_score"] >= suggestion_service.T_HIGH]
    high_correct = sum(c["expected"] == c["group"] for c in high)
    print(
        f"\nCurrent T_HIGH={suggestion_service.T_HIGH} T_MED={current[0]} "
        f"T_CATALOG={current[1]}: accuracy {correct}/{len(scored)} "
        f"({correct / len(scored):.1%}), high {high_correct}/{len(high)}"
    )
    for c in scored:
        got = predict(c, *current)
        if got != c["expected"]:
            print(f"  miss: {c['title']!r} expected {c['expected']}, got {got}")


if __name__ == "__main__":
    main()
