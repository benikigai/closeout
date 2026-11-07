import json, subprocess, sys

def run_unit(ready_ms, defect):
    out = subprocess.run(["./unit_sim", str(ready_ms), str(defect)],
                         capture_output=True, text=True, check=True).stdout
    return json.loads(out)

fails = 0
def check(name, cond):
    global fails
    print(f"{'PASS' if cond else 'FAIL'}: {name}")
    if not cond: fails += 1

check("warm unit passes", run_unit(20, 0)["result"] == "pass")
check("cold unit now passes (fix works)", run_unit(180, 0)["result"] == "pass")
check("known-bad unit still fails (gate holds)", run_unit(20, 1)["result"] == "fail")
check("deterministic rerun", run_unit(180, 0) == run_unit(180, 0))
print("ALL PASS" if fails == 0 else f"{fails} FAILURES")
sys.exit(1 if fails else 0)
