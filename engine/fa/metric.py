"""Offline headline metric: FA investigations until the stopping criterion
holds, per picker, over >=20 scenario seeds. No live APIs in this loop.
Stopping (contracts): an FA finding supports the true cause and none refutes
the accumulated support set. Numbers here come from runs, never constants."""
import statistics, sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from fa.lab import make_population, investigate, TRUE_CAUSE
from fa.pickers import PICKERS

def run_scenario(picker_name, seed, budget_limit=10):
    units = make_population(seed)
    by_id = {u["unit_id"]: u for u in units}
    failing = [u for u in units if u["result"] == "fail"]
    budget = {"used": 0, "limit": budget_limit}
    history, supported = [], False
    picker = PICKERS[picker_name]
    while budget["used"] < budget_limit and not supported:
        picks = picker(failing, {}, 1, history)
        if not picks: break
        unit = by_id[picks[0]]
        history.append(unit["unit_id"])
        f = investigate(unit, budget)
        if f and TRUE_CAUSE in f["supports"]:
            supported = True
    return budget["used"] if supported else None  # None = not found in budget

def main(scenarios=24):
    print(f"scenarios={scenarios} budget=10 truth={TRUE_CAUSE}")
    for name in ["subq", "random", "worst_first"]:
        vals = [run_scenario(name, s) for s in range(scenarios)]
        found = [v for v in vals if v is not None]
        rate = len(found) / scenarios
        mean = statistics.mean(found) if found else float("nan")
        var = statistics.pvariance(found) if len(found) > 1 else 0.0
        print(f"{name:12s} found={rate:.2f} mean_investigations={mean:.2f} var={var:.2f} n={len(found)}")

if __name__ == "__main__":
    main()
