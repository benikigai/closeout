"""Live SubQ assessment on the demo build (seed 7) + calibration gate.
Aggregates are computed by code; SubQ only scores/decides. Results cache to
fa/cache/ so the demo can replay them with a `replay` label offline."""
import json, os, sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from fa.lab import make_population, HYPOTHESES
from fa.subq_client import decide

CACHE = os.path.join(os.path.dirname(__file__), "cache")

def aggregate(units):
    fails = [u for u in units if u["result"] == "fail"]
    by_lot = {}
    for u in units:
        d = by_lot.setdefault(u["lot_id"], {"tested": 0, "failed": 0})
        d["tested"] += 1
        d["failed"] += 1 if u["result"] == "fail" else 0
    return fails, by_lot

def assess(seed=7):
    units = make_population(seed)
    fails, by_lot = aggregate(units)
    state = (f"[BUILD seed={seed}] {len(units)} units tested, {len(fails)} failed T-OPT-01 dome uniformity. "
             f"By lot: {json.dumps(by_lot)}. Failing units cluster in LOT-B and in first-hour cold starts; "
             f"warm LOT-B bench LEDs pass. Hypotheses: {json.dumps(HYPOTHESES)}")
    q = {}
    for hid in HYPOTHESES:
        q[f"{hid}_support"] = {"type": "noul",
            "instructions": f"Does the observed pattern support {hid}: {HYPOTHESES[hid]}?",
            "criteria": {"true": "supported", "false": "not supported"}}
    q["category"] = {"type": "choice", "instructions": "Which MIL category should own this item first?",
        "criteria": {"Material": "material cause", "Firmware": "firmware cause", "Assembly": "assembly cause", "Test Station": "test-station cause"}}
    q["next_probe"] = {"type": "choice", "instructions": "Which FA probe best discriminates the top hypotheses?",
        "criteria": {"driver_timing": "Measure LED driver ready-delay vs cal write timing",
                     "led_bench": "Bench-test LED lot output",
                     "dome_inspect": "Inspect dome bonding haze",
                     "camera_recal": "Recalibrate optical camera"}}
    out = decide(state, q)
    os.makedirs(CACHE, exist_ok=True)
    with open(f"{CACHE}/assessment-seed{seed}.json", "w") as f:
        json.dump({"state": state, "response": out}, f, indent=1)
    return out

# Calibration: statements with known truth about a fixed trace. Brier score
# decides whether we may use probability language or must say "scores".
CAL = [
    ("Unit fails cold and passes warm", True),
    ("LED bench test failed", False),
    ("Failures cluster in one lot", True),
    ("Camera recalibration fixed warm units", False),
    ("Known-bad dome defect units fail after calibration", True),
    ("All lots fail at the same rate", False),
    ("Calibration was applied on cold units (cal_applied=1)", False),
    ("Uniformity improves when calibration is applied", True),
]

def calibrate():
    state = ("[TRACE] LOT-B cold units fail T-OPT-01 (cal_applied=0); warm units pass (cal_applied=1). "
             "LED bench passes. Dome-defect units fail even when calibrated. Lot failure rates differ.")
    q = {f"s{i}": {"type": "noul", "instructions": f"Is this true of the trace: {s}?",
                   "criteria": {"true": "true", "false": "false"}} for i, (s, _) in enumerate(CAL)}
    out = decide(state, q)
    ans = out["answers"]
    brier, correct = 0.0, 0
    for i, (_, truth) in enumerate(CAL):
        p = ans[f"s{i}"]["noul"]
        y = 1.0 if truth else 0.0
        brier += (p - y) ** 2
        correct += 1 if (p >= 0.5) == truth else 0
    brier /= len(CAL)
    verdict = "probability language justified" if brier < 0.15 else "use score language only"
    result = {"brier": round(brier, 4), "accuracy": correct / len(CAL), "verdict": verdict,
              "answers": {f"s{i}": ans[f"s{i}"]["noul"] for i in range(len(CAL))}}
    os.makedirs(CACHE, exist_ok=True)
    with open(f"{CACHE}/calibration.json", "w") as f:
        json.dump(result, f, indent=1)
    return result

if __name__ == "__main__":
    a = assess()
    print("ASSESS:", json.dumps(a["answers"])[:600])
    print("USAGE:", a.get("usage"))
    print("CALIBRATION:", json.dumps(calibrate()))
