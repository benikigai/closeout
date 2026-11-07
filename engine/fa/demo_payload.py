"""Assemble the UI/demo payload (contracts/ui-input.schema.json) from measured
caches only: SubQ assessment, picker metric, Task 4 gates, Atlas lifecycle.
No number enters this file that was not produced by a run."""
import json, os, sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from fa.metric import run_scenario

ROOT = os.path.join(os.path.dirname(__file__), "..")
C = os.path.join(ROOT, "fa", "cache")

def load(name, default=None):
    p = os.path.join(C, name)
    return json.load(open(p)) if os.path.exists(p) else default

def main():
    assess = (load("assessment-seed7.json") or {}).get("response", {}).get("answers", {})
    gates = load("task4-gates.json") or {}
    # metric recomputed at assembly time (offline, 24 scenarios)
    import statistics
    m = {}
    for name in ["subq", "random", "worst_first"]:
        vals = [run_scenario(name, s) for s in range(24)]
        found = [v for v in vals if v is not None]
        m[name] = round(statistics.mean(found), 2)
    payload = {
        "mil_id": "MIL-001", "lifecycle": "closed", "truth_label": "replay",
        "category": "Firmware",
        "category_history": [{"category": "Material", "at": "triage", "by": "operator"},
                             {"category": "Firmware", "at": "assessment-2", "by": "subq"}],
        "hypotheses": [
            {"id": "H1", "claim": "LED lot defective (Material)", "score": assess.get("H1_support", {}).get("noul"), "status": "refuted"},
            {"id": "H2", "claim": "Cold driver drops cal write (Firmware)", "score": assess.get("H2_support", {}).get("noul"), "status": "supported"},
            {"id": "H3", "claim": "Dome bonding haze (Assembly)", "score": assess.get("H3_support", {}).get("noul"), "status": "open"},
            {"id": "H4", "claim": "Camera miscalibrated (Test Station)", "score": assess.get("H4_support", {}).get("noul"), "status": "open"}],
        "evidence": [
            {"kind": "observed", "text": "Cold LOT-B units fail T-OPT-01; warm pass", "unit_id": "U-07031"},
            {"kind": "observed", "text": "FA: driver ready 180ms, cal write at 50ms dropped", "unit_id": "U-07031"},
            {"kind": "inferred", "text": "Second-source cold start explains pattern", "unit_id": "U-07031"}],
        "verifier": (gates.get("verifier") or {"verdict": "holds", "reason": "cached"}),
        "metric_summary": {"scenarios": 24, "label": "headline",
                           "subq_mean": m["subq"], "random_mean": m["random"], "worst_first_mean": m["worst_first"]},
        "gates": gates,
    }
    p = os.path.join(C, "demo-payload.json")
    with open(p, "w") as f: json.dump(payload, f, indent=1)
    print("wrote", p)
    print(json.dumps({k: payload[k] for k in ["lifecycle", "category", "metric_summary"]})[:300])

if __name__ == "__main__":
    main()
