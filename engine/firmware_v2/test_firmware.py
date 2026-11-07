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

warm = run_unit(20, 0)
check("warm unit passes (cal applied)", warm["cal_applied"] == 1 and warm["result"] == "pass")
cold = run_unit(180, 0)
check("cold unit fails (write dropped)", cold["cal_applied"] == 0 and cold["result"] == "fail")
bad = run_unit(20, 1)
check("known-bad unit fails even when warm", bad["result"] == "fail")
check("deterministic rerun", run_unit(180, 0) == cold)
print("ALL PASS" if fails == 0 else f"{fails} FAILURES")
sys.exit(1 if fails else 0)
