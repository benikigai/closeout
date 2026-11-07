"""Builds the Closeout UI fixture. Seeded synthetic logs. SubQ scores are a real API call.
Everything else is a stand-in until the engine writes run.json. Never prints the key."""
import hashlib, json, os, random, statistics, time, urllib.request
from datetime import datetime, timezone

HYP = [
    {"id": "firmware_timing", "label": "Firmware timing", "category": "Firmware", "text": "Firmware applied ring calibration before the part was ready"},
    {"id": "fixture_contact", "label": "Test fixture", "category": "Test Station", "text": "The optical fixture measured a good unit badly"},
    {"id": "assembly_guide", "label": "Light guide seating", "category": "Assembly", "text": "The light guide sat out of position"},
    {"id": "material_led", "label": "LED material", "category": "Material", "text": "The LED parts are out of specification"},
]
MIX = [("firmware_timing", 52), ("fixture_contact", 34), ("assembly_guide", 26), ("material_led", 16)]
FIND = {
    "firmware_timing": "LEDs pass on the bench. Calibration registers hold defaults. Unit passes once warm.",
    "fixture_contact": "Unit passes on a reference fixture. Contact wear on the fixture nest.",
    "assembly_guide": "Light guide sits out of position under the microscope.",
    "material_led": "LED bin is out of specification on the bench.",
}
r = random.Random(11)

def unit(i, cause):
    u = {"id": f"U{i:04d}", "station": "S6", "lot": r.choice("AB"), "fixture": r.choice([1, 2]),
         "hour_of_shift": r.randint(1, 8), "temp_c": round(r.gauss(24, 1.6), 1),
         "retest": "fail", "guide_offset_mm": round(abs(r.gauss(0.07, 0.05)), 2),
         "uniformity": round(r.gauss(0.71, 0.03), 2)}
    if cause == "firmware_timing":
        u.update(lot="B" if r.random() < .85 else "A", fixture=2 if r.random() < .75 else 1,
                 hour_of_shift=1 if r.random() < .8 else 2, temp_c=round(r.gauss(18.5, 1.3), 1))
        u["retest"] = "pass" if r.random() < .3 else "fail"
    elif cause == "fixture_contact":
        u.update(fixture=2 if r.random() < .85 else 1, lot="B" if r.random() < .65 else "A")
        u["retest"] = "pass" if r.random() < .6 else "fail"
    elif cause == "assembly_guide":
        u["guide_offset_mm"] = round(r.gauss(0.19, 0.06), 2)
    else:
        u["uniformity"] = round(r.gauss(0.66, 0.03), 2)
    return u

units, truth = [], {}
pool = [c for c, n in MIX for _ in range(n)]
r.shuffle(pool)
for i, c in enumerate(pool):
    u = unit(i + 1, c); units.append(u); truth[u["id"]] = c

k = os.environ["SUBQ_API_KEY"]
state = "Failure logs for light ring units at the optical station. Causes can overlap in the data.\n" + "\n".join(json.dumps(u) for u in units)
qs = {u["id"]: {"type": "choice", "instructions": f"Which cause best explains unit {u['id']}?",
                "criteria": {h["id"]: h["text"] for h in HYP}} for u in units}
req = urllib.request.Request("https://api.subq.ai/v1/systemone",
    data=json.dumps({"model": "subq-snap-1.1", "state": state, "questions": qs}).encode(),
    headers={"Authorization": f"Bearer {k}", "Content-Type": "application/json", "User-Agent": "closeout-fixture"})
t = time.time(); res = json.load(urllib.request.urlopen(req, timeout=90)); secs = time.time() - t
for u in units:
    u["subq"] = {a: round(b, 4) for a, b in res["answers"][u["id"]]["probabilities"].items()}
tops = [max(u["subq"], key=u["subq"].get) for u in units]
acc = sum(tops[i] == truth[u["id"]] for i, u in enumerate(units)) / len(units)
bins = {}
for i, u in enumerate(units):
    p = max(u["subq"].values()); b = min(int(p * 5), 4)
    bins.setdefault(b, []).append((p, tops[i] == truth[u["id"]]))
cal = {f"{b/5:.1f}-{(b+1)/5:.1f}": {"n": len(v), "conf": round(statistics.mean(x[0] for x in v), 3), "acc": round(statistics.mean(x[1] for x in v), 3)} for b, v in sorted(bins.items())}

share = {c: n / len(units) for c, n in MIX}
def cover(ids): return sum(share[c] for c in {truth[i] for i in ids})
def expected(h): return share[h]
est = {h["id"]: statistics.mean(u["subq"][h["id"]] for u in units) for h in HYP}
picks, seen = [], {}
for _ in range(5):
    best, val = None, -1
    for u in units:
        if u["id"] in picks: continue
        gain = sum(p * est[h] * (0.35 ** seen.get(h, 0)) for h, p in u["subq"].items())
        if gain > val: best, val = u, gain
    picks.append(best["id"])
    for h, p in best["subq"].items(): seen[h] = seen.get(h, 0) + p
rr = random.Random(3)
rand = statistics.mean(cover(rr.sample([u["id"] for u in units], 5)) for _ in range(2000))
worst = cover([u["id"] for u in sorted(units, key=lambda u: u["uniformity"])[:5]])

# Toy twin gate. Failure rate of cold starts by rule, against a memorized table.
def build(seed, cold_hour):
    b = random.Random(seed); rows = []
    for _ in range(4000):
        h = b.randint(1, 8); t = b.gauss(18.5, 1) if h == cold_hour else b.gauss(24, 1)
        slow = b.random() < .5
        rows.append((h, slow, t, slow and t < 20.5 and b.random() < .55))
    return rows
n, held = build(21, 1), build(22, 4)
table = {}
for h in range(1, 9):
    for s in (0, 1):
        g = [x for x in n if x[0] == h and x[1] == bool(s)]
        table[(h, s)] = sum(x[3] for x in g) / len(g)
memo = lambda x: table[(x[0], int(x[1]))]
rule = lambda x: .55 if x[1] and x[2] < 20.5 else 0
def score(f, rows):
    groups = {}
    for x in rows: groups.setdefault(x[0], []).append(x)
    err = statistics.mean(abs(sum(f(x) for x in g) - sum(x[3] for x in g)) / len(g) for g in groups.values())
    return round(100 * (1 - err * 4), 1)
sa, ha, sb, hb = score(memo, n), score(memo, held), score(rule, n), score(rule, held)

classes = [c for c, _ in MIX]
pred = {"build": "N", "top": ["assembly_guide", "material_led", "fixture_contact"], "made": "before build N"}
locked = json.dumps(pred, sort_keys=True)
tested = 2400
run = {"contract": 0, "mode": "fixture", "generated_at": datetime.now(timezone.utc).isoformat(), "build": "N",
  "subq_call": {"model": "subq-snap-1.1", "units": len(units), "seconds": round(secs, 2), "input_tokens": res["usage"]["input_tokens"], "top_choice_accuracy": round(acc, 3), "calibration": cal},
  "line": [{"id": f"S{i+1}", "name": n_} for i, n_ in enumerate(["Board in", "Flash", "Ring", "Guide", "Close", "Optical", "Audio", "Pack"])],
  "prediction": {"locked_text": locked, "sha256": hashlib.sha256(locked.encode()).hexdigest(), "top": pred["top"]},
  "actual_pareto": [{"class": c, "units": n_} for c, n_ in MIX],
  "score": {"hit_at_3": len(set(pred["top"]) & set(classes[:3])), "of": 3, "K": 9, "chance_rate": 1.0, "baselines": {}},
  "addressable_share": round(sum(n_ for c, n_ in MIX if c != "firmware_timing") / len(units), 3),
  "hypotheses": [{a: b for a, b in h.items() if a != "text"} for h in HYP], "units": units,
  "mil": [{"id": "MIL-001", "jira_url": None, "failure_name": "Light ring uniformity", "station": "S6", "units_failed": len(units), "units_tested": tested,
    "failure_rate": round(len(units) / tested, 4), "category": "Firmware", "category_history": [{"from": "Material", "to": "Firmware", "reason": "FA: LEDs pass on the bench, registers hold defaults"}],
    "fa_steps": ["Bench the LEDs", "Read back calibration registers", "Retest warm"], "fa_findings": [FIND["firmware_timing"]],
    "root_cause": {"text": HYP[0]["text"], "status": "confirmed"}, "corrective_action": "Twin change B", "etc_ca": "Build N+1", "etc_monitoring": "Build N+1", "status": "closed"}],
  "fa": {"budget": 5, "subq_picks": picks, "baselines": {"random": round(rand, 3), "worst_first": round(worst, 3)}},
  "changes": [
    {"id": "A", "summary": "Memorize build N's failure rate by hour and lot", "diff": "+ rate = BUILD_N_TABLE[hour][lot]", "build_n_score": sa, "heldout_score": ha, "gemini": "The table has no cause in it. Move the cold hour and it fails.", "decision": "rejected"},
    {"id": "B", "summary": "Model the cold start of the slower part", "diff": "+ if part.slow and temp_c < 20.5:\n+     calibration_write = DROPPED", "build_n_score": sb, "heldout_score": hb, "gemini": "Could not refute it on shifted temperatures.", "decision": "adopted"}]}
sealed = {"share": share, "findings": {uid: {"hypothesis": c, "text": FIND[c], "evidence": "observed"} for uid, c in truth.items()}}
json.dump(run, open("data/run.json", "w"), indent=1)
json.dump(sealed, open("data/sealed.json", "w"), indent=1)
print(json.dumps({"secs": round(secs, 2), "acc": round(acc, 3), "cal": cal, "subq_cover": round(cover(picks), 3), "random": round(rand, 3), "worst": round(worst, 3), "A": [sa, ha], "B": [sb, hb]}))
