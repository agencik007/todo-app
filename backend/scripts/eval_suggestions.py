"""
Offline evaluation of the group suggestion thresholds with the real model.

Scores the labelled cases in tests/data/suggestion_eval.json in memory (no
database) in two scenarios: "cold" (the user owns the listed groups but has
no past todos, so only group names and the catalogue match) and "history"
(the groups also hold the past todos listed under "todos", so the kNN path
competes too). Prints the score per case and scenario, the precision of
"high" auto-fills per T_HIGH, and the best T_MED / T_CATALOG / KNN_MARGIN
by accuracy over both scenarios.

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
MARGINS = [0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3]


def score_cases(embedder, data: dict) -> list[dict]:
    """Score every case in both scenarios with the current KNN_MARGIN."""
    groups, cases = data["groups"], data["cases"]
    space = suggestion_service.catalog_space(embedder)
    group_rows = [
        (index, suggestion_service.group_vectors(space, name, vector))
        for index, (name, vector) in enumerate(
            zip(groups, embedder.embed(groups), strict=True)
        )
    ]
    history = [
        (groups.index(name), title, vector)
        for name, titles in data.get("todos", {}).items()
        for title, vector in zip(
            titles, space.center(embedder.embed(titles)), strict=True
        )
    ]
    queries = space.center(
        embedder.embed(
            [todo_embedding_text(c["title"], c["description"]) for c in cases]
        )
    )
    scored = []
    for case, q in zip(cases, queries, strict=True):
        entry, cat_score = suggestion_service.best_catalog_entry(q, space, groups)
        for scenario, todos in (("cold", []), ("history", history)):
            match = suggestion_service.best_group(q, group_rows, todos)
            scored.append(
                {
                    **case,
                    "scenario": scenario,
                    "group": groups[match.group_id],
                    "group_score": match.score,
                    "reason": match.reason,
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


def high_precision(scored: list[dict], t_high: float) -> tuple[int, int]:
    high = [c for c in scored if c["group_score"] >= t_high]
    return sum(c["expected"] == c["group"] for c in high), len(high)


def accuracy(scored: list[dict], t_med: float, t_cat: float) -> int:
    return sum(predict(c, t_med, t_cat) == c["expected"] for c in scored)


def main() -> None:
    data = json.loads(DATA.read_text(encoding="utf-8"))
    embedder = FastEmbedEmbedder()
    chosen_margin = suggestion_service.KNN_MARGIN

    print("Best settings per KNN_MARGIN (T_HIGH: lowest with >= 95% precision)")
    for margin in MARGINS:
        suggestion_service.KNN_MARGIN = margin
        scored = score_cases(embedder, data)
        t_high = next(
            (
                t
                for t in GRID
                if (p := high_precision(scored, t))[1] and p[0] >= 0.95 * p[1]
            ),
            None,
        )
        correct, t_med, t_cat = max(
            (accuracy(scored, t_med, t_cat), -t_med, -t_cat)
            for t_med, t_cat in product(GRID, GRID)
            if t_high is None or t_med <= t_high
        )
        ok, n = high_precision(scored, t_high) if t_high is not None else (0, 0)
        print(
            f"KNN_MARGIN={margin:.2f}: T_HIGH={t_high} high {ok}/{n}, "
            f"best accuracy {correct}/{len(scored)} at T_MED={-t_med:.3f} "
            f"T_CATALOG={-t_cat:.3f}"
        )

    suggestion_service.KNN_MARGIN = chosen_margin
    scored = score_cases(embedder, data)

    print(
        f"\nScores with KNN_MARGIN={chosen_margin}\n"
        f"{'title':36} {'scenario':8} {'expected':16} {'best group':17} "
        f"{'best catalogue':23} reason"
    )
    for c in scored:
        print(
            f"{c['title'][:36]:36} {c['scenario']:8} {c['expected']!s:16} "
            f"{c['group']:10} {c['group_score']:6.3f} "
            f"{c['catalog']:16} {c['catalog_score']:6.3f} {c['reason'] or ''}"
        )

    print("\nT_HIGH  auto-fills  correct  precision")
    for t_high in GRID:
        correct, n = high_precision(scored, t_high)
        precision = correct / n if n else float("nan")
        print(f"{t_high:6.3f}  {n:10d}  {correct:7d}  {precision:9.2%}")

    results = sorted(
        (
            (accuracy(scored, t_med, t_cat), t_med, t_cat)
            for t_med, t_cat in product(GRID, GRID)
        ),
        key=lambda r: (-r[0], r[1], r[2]),
    )
    print("\nTop T_MED / T_CATALOG by accuracy")
    for correct, t_med, t_cat in results[:15]:
        print(f"T_MED={t_med:.3f} T_CATALOG={t_cat:.3f}  {correct}/{len(scored)}")

    current = (suggestion_service.T_MED, suggestion_service.T_CATALOG)
    print(
        f"\nCurrent T_HIGH={suggestion_service.T_HIGH} T_MED={current[0]} "
        f"T_CATALOG={current[1]} KNN_MARGIN={chosen_margin}:"
    )
    for scenario in ("cold", "history", None):
        subset = [c for c in scored if scenario in (None, c["scenario"])]
        correct = accuracy(subset, *current)
        high_ok, high_n = high_precision(subset, suggestion_service.T_HIGH)
        print(
            f"  {scenario or 'both':8} accuracy {correct}/{len(subset)} "
            f"({correct / len(subset):.1%}), high {high_ok}/{high_n}"
        )
    for c in scored:
        got = predict(c, *current)
        if got != c["expected"]:
            high = c["group_score"] >= suggestion_service.T_HIGH
            print(
                f"  miss ({c['scenario']}): {c['title']!r} expected "
                f"{c['expected']}, got {got}{' (HIGH)' if high and got else ''}"
            )


if __name__ == "__main__":
    main()
