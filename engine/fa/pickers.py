"""FA-unit pickers. One signature per contracts/CONTRACTS.md:
pick(candidates, hypotheses, k, history) -> [unit_id, ...]
hypotheses carries current scores; history lists investigated unit IDs."""
import random

def _fresh(candidates, history):
    return [u for u in candidates if u["unit_id"] not in history]

def subq_guided(candidates, hypotheses, k, history):
    """Evidence-concentration split: investigate failing units from the lot
    with the highest failure concentration first (that lot best discriminates
    the top hypothesis), worst uniformity first inside the lot.
    Deterministic tie-break by unit_id."""
    pool = _fresh(candidates, history)
    from collections import Counter
    counts = Counter(u["lot_id"] for u in pool)
    pool.sort(key=lambda u: (-counts[u["lot_id"]], u["uniformity"], u["unit_id"]))
    return [u["unit_id"] for u in pool[:k]]

def worst_first(candidates, hypotheses, k, history):
    pool = sorted(_fresh(candidates, history), key=lambda u: (-u["uniformity"], u["unit_id"]))
    return [u["unit_id"] for u in pool[:k]]

def random_pick(candidates, hypotheses, k, history, seed=0):
    pool = _fresh(candidates, history)
    rng = random.Random(seed + len(history))
    return [u["unit_id"] for u in rng.sample(pool, min(k, len(pool)))]

PICKERS = {"subq": subq_guided, "worst_first": worst_first, "random": random_pick}
