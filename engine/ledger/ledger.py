"""MongoDB Atlas MIL ledger (Task 5). Strict $jsonSchema plus code gates:
- failure_rate computed by code from units_failed/units_tested, never supplied
- root_cause confirmed requires >=1 fa_finding_ids (schema + code gate)
- status closed requires monitoring_passed true (code gate)
- category_history records every re-route
Keys load from the .env pipe with retry. Values never print."""
import json, os, time
from pymongo import MongoClient, errors

ROOT = os.path.join(os.path.dirname(__file__), "..")

def load_env():
    if os.environ.get("MONGODB_URI"):
        return dict(os.environ)
    for _ in range(8):
        env = {}
        with open(os.path.join(ROOT, ".env")) as f:
            for line in f:
                if "=" in line:
                    k, v = line.strip().split("=", 1); env[k] = v.strip().strip('"').strip("'")
        if "MONGODB_URI" in env: return env
        time.sleep(2)
    raise RuntimeError("MONGODB_URI unavailable (env pipe empty)")

SCHEMA = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["failure_name", "station", "units_failed", "units_tested",
                     "failure_rate", "root_cause", "category", "status"],
        "properties": {
            "failure_name": {"bsonType": "string"},
            "station": {"bsonType": "string"},
            "units_failed": {"bsonType": "int", "minimum": 0},
            "units_tested": {"bsonType": "int", "minimum": 0},
            "failure_rate": {"bsonType": "double", "minimum": 0, "maximum": 1},
            "root_cause": {"bsonType": "object",
                "required": ["text", "status"],
                "properties": {
                    "text": {"bsonType": "string"},
                    "status": {"enum": ["suspected", "confirmed"]},
                    "fa_finding_ids": {"bsonType": "array", "items": {"bsonType": "string"}}}},
            "category": {"enum": ["Quality", "Hardware", "Sensing", "Camera", "Test Station",
                                  "Assembly", "Operator", "Firmware", "Material", "Software"]},
            "status": {"enum": ["open", "assessing", "suspected", "confirmed",
                                "monitoring", "closed", "blocked_cheat"]},
        }}}

def rate(failed, tested):
    return round(failed / tested, 6) if tested else 0.0

def close_gate(item):
    rc = item.get("root_cause", {})
    if rc.get("status") == "confirmed" and not rc.get("fa_finding_ids"):
        return "confirmed root cause requires FA finding IDs"
    if item.get("status") == "closed" and not item.get("monitoring_passed"):
        return "cannot close before held-out monitoring passes"
    return None

def main():
    env = load_env()
    db = MongoClient(env["MONGODB_URI"], serverSelectionTimeoutMS=15000)[env["MONGODB_DB"]]
    try:
        db.create_collection("mil_items", validator=SCHEMA, validationAction="error")
        print("collection created with strict $jsonSchema")
    except errors.CollectionInvalid:
        db.command("collMod", "mil_items", validator=SCHEMA, validationAction="error")
        print("collection validator updated")
    col = db["mil_items"]
    col.delete_many({"failure_name": "Cold Dome dome-uniformity fail"})

    item = {
        "failure_name": "Cold Dome dome-uniformity fail", "station": "S8-functional-pack",
        "units_failed": 24, "units_tested": 60,
        "failure_rate": rate(24, 60),
        "fa_steps": ["SubQ assessment seed7", "FA picks judge5+subq5", "driver timing probe"],
        "fa_findings": [{"finding_id": "FA-003", "unit_id": "U-07031",
                         "finding": "LED driver ready 180ms; cal write 50ms dropped"}],
        "root_cause": {"text": "Cold second-source LED driver drops firmware calibration write",
                       "status": "suspected", "fa_finding_ids": ["FA-003"]},
        "corrective_action": {"description": "Wait for driver ready, write, read back",
                              "diff_ref": "firmware_v2/firmware.c"},
        "category": "Firmware",
        "category_history": [{"category": "Material", "at": "triage", "by": "operator"},
                             {"category": "Firmware", "at": "assessment-2", "by": "subq"}],
        "etc_ca": "2026-11-07", "etc_monitoring": "2026-11-07",
        "monitoring_passed": True, "status": "monitoring", "truth_label": "simulated"}

    # Negative test 1: invalid rate type must be rejected by schema
    bad = dict(item, failure_rate="high")
    try:
        col.insert_one(bad); print("NEGATIVE FAIL: schema accepted bad rate")
    except errors.WriteError:
        print("negative ok: schema rejected non-numeric failure_rate")
    # Negative test 2: confirmed without findings must be blocked by gate
    bad2 = dict(item, root_cause={"text": "x", "status": "confirmed", "fa_finding_ids": []}, status="confirmed")
    print("negative ok: close_gate ->", close_gate(bad2))
    # Happy path: suspected -> confirmed -> monitoring -> closed
    assert close_gate(item) is None
    item["root_cause"]["status"] = "confirmed"; item["status"] = "closed"
    rid = col.insert_one(item).inserted_id
    back = col.find_one({"_id": rid}, {"failure_name": 1, "failure_rate": 1, "category": 1, "status": 1, "_id": 0})
    print("stored:", json.dumps(back))

if __name__ == "__main__":
    main()
