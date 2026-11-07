# Beacon firmware (fictional, built 2026-11-07)

Small C firmware + fake HAL + per-unit simulator for the Closeout demo.

- `firmware.c` — v1 buggy calibration: fixed 50 ms boot-time write, no
  ready-wait, no readback. Cold units (driver ready at 180 ms) drop the
  write and fail dome uniformity. Warm units (20 ms) pass.
- `hal.c/hal.h` — deterministic virtual time and per-unit parameters.
  Known-bad units (`dome_defect=1`) fail regardless of calibration.
- `main.c` — `unit_sim <driver_ready_ms> <dome_defect>` prints one JSON
  result for test T-OPT-01.
- `test_firmware.py` — warm pass, cold fail, known-bad fail, determinism.

Build/test: `make test`

Machine note (this MBP): the default MacOSX27 SDK fails to link
(`arm64e.x1` unknown to the installed linker). Use the older SDK:
`SDKROOT=/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk make test`
All four checks pass under that SDK (RUN, 2026-11-07).
