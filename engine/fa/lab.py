"""Sealed FA lab (local stand-in for the FA lab interface in contracts/).
Only this module knows ground truth. Investigating a unit spends budget and
reveals that unit's physical slice. Deterministic per scenario seed."""
import random

READY_COLD, READY_WARM = 180, 20
WRITE_AT_MS = 50

def make_population(seed, n=60):
    rng = random.Random(seed)
    units = []
    for i in range(n):
        cold = rng.random() < 0.35          # cold second-source lot share
        defect = rng.random() < 0.05        # known-bad physical dome defect
        units.append({
            "unit_id": f"U-{seed:02d}{i:03d}",
            "driver_ready_ms": READY_COLD if cold else READY_WARM,
            "dome_defect": 1 if defect else 0,
            "lot_id": "LOT-B" if cold else "LOT-A",
        })
    for u in units:  # behavior follows the firmware rule, computed by code
        cal = 1 if u["driver_ready_ms"] <= WRITE_AT_MS else 0
        u["cal_applied"] = cal
        u["uniformity"] = 0.22 if u["dome_defect"] else (0.02 if cal else 0.18)
        u["result"] = "pass" if u["uniformity"] < 0.05 else "fail"
    return units

def investigate(unit, budget_state):
    if budget_state["used"] >= budget_state["limit"]:
        return None  # caller maps this to 429 fa_budget_exceeded
    budget_state["used"] += 1
    if unit["dome_defect"]:
        finding, supports, refutes = "Dome diffuser defect, physical", [], ["H2"]
    elif unit["driver_ready_ms"] > WRITE_AT_MS:
        finding, supports, refutes = "LED driver ready at 180ms; cal write at 50ms dropped", ["H2"], ["H1", "H3"]
    else:
        finding, supports, refutes = "Driver ready on time; cal applied", [], ["H2"]
    return {"finding_id": f"FA-{budget_state['used']:03d}", "unit_id": unit["unit_id"],
            "finding": finding, "supports": supports, "refutes": refutes}

HYPOTHESES = {
    "H1": "LED lot defective (Material)",
    "H2": "Cold driver drops calibration write (Firmware)",
    "H3": "Dome bonding haze (Assembly)",
    "H4": "Optical camera miscalibrated (Test Station)",
}
TRUE_CAUSE = "H2"  # Cold Dome scenario truth; pickers must discover via FA
