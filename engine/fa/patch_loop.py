"""Muse patch loop for Cold Dome (Task 4).
Live path: muse-wonder-1.0 (Meta Model API) rewrites firmware.c.
Gate: patched firmware must compile and pass warm/cold/known-bad tests.
Fallback: reference patch, always labeled `replay`. Never silent."""
import json, os, shutil, subprocess, sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import httpx

ROOT = os.path.join(os.path.dirname(__file__), "..")
FW = os.path.join(ROOT, "firmware")
SDK = "/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk"

def _meta_key():
    with open(os.path.join(ROOT, ".env")) as f:
        for line in f:
            if line.startswith("META_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise RuntimeError("META_API_KEY missing")

def ask_claude_to_patch(source):
    prompt = (
        "Fix this embedded C firmware. Bug: calibration write at fixed 50ms is dropped on units whose "
        "LED driver needs 180ms to be ready. Correct behavior: wait until hal_led_driver_ready(), write, "
        "read back with hal_led_read_cal(), retry once if needed. Keep CAL_TARGET 42 and both function "
        "signatures (fw_calibrate, fw_cal_applied). hal.h provides hal_delay_ms, hal_led_driver_ready, "
        "hal_led_write_cal, hal_led_read_cal. Return ONLY the complete corrected firmware.c file.\n\n"
        f"```c\n{source}\n```")
    r = httpx.post("https://api.meta.ai/v1/chat/completions",
                   headers={"Authorization": f"Bearer {_meta_key()}", "Content-Type": "application/json"},
                   json={"model": "muse-wonder-1.0",
                         "messages": [{"role": "user", "content": prompt}]},
                   timeout=120.0)
    r.raise_for_status()
    text = r.json()["choices"][0]["message"]["content"]
    if "```" in text:
        text = text.split("```")[1].removeprefix("c").strip()
    return text

REFERENCE_FIX = '''#include "hal.h"
#define CAL_TARGET 42
int fw_calibrate(void) {
    while (!hal_led_driver_ready()) hal_delay_ms(10);
    if (hal_led_write_cal(CAL_TARGET)) return 1;
    hal_delay_ms(10);
    return hal_led_write_cal(CAL_TARGET);
}
int fw_cal_applied(void) { return hal_led_read_cal() >= 0 ? 1 : 0; }
'''

def build_and_test(workdir):
    env = dict(os.environ, SDKROOT=SDK)
    subprocess.run(["make", "clean"], cwd=workdir, capture_output=True, env=env)
    b = subprocess.run(["make", "unit_sim"], cwd=workdir, capture_output=True, text=True, env=env)
    if b.returncode != 0:
        return False, "compile failed: " + b.stderr[-300:]
    t = subprocess.run(["python3", "test_fixed.py"], cwd=workdir, capture_output=True, text=True, env=env)
    return t.returncode == 0, t.stdout.strip().splitlines()[-1] if t.stdout else t.stderr[-200:]

def main():
    src = open(f"{FW}/firmware.c").read()
    out_dir = os.path.join(ROOT, "firmware_v2")
    if os.path.exists(out_dir): shutil.rmtree(out_dir)
    shutil.copytree(FW, out_dir)
    label, patched = "live", None
    try:
        patched = ask_claude_to_patch(src)
        open(f"{out_dir}/firmware.c", "w").write(patched)
        ok, msg = build_and_test(out_dir)
        if not ok:
            raise RuntimeError(f"live patch rejected by gate: {msg}")
    except Exception as e:
        label, patched = "replay", REFERENCE_FIX
        open(f"{out_dir}/firmware.c", "w").write(patched)
        ok, msg = build_and_test(out_dir)
        print(f"live path failed ({type(e).__name__}); fell back to labeled replay. gate: {msg}")
    print(json.dumps({"patch_label": label, "gate_pass": ok, "gate": msg,
                      "patched_fw_calibrate_present": "hal_led_driver_ready" in patched}))
    with open(f"{ROOT}/fa/cache/patch-result.json", "w") as f:
        json.dump({"label": label, "gate_pass": ok, "gate": msg}, f, indent=1)

if __name__ == "__main__":
    main()
