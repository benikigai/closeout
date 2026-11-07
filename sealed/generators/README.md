# Deterministic beacon log generator

This is a synthetic observation generator, not the firmware runner or FA lab.
It models only the three seeded faults from `contracts/CONTRACTS.md`, plus the
mandatory physical dome negative control. It does not apply corrective patches.

From the repository root, generate two isolated build directories:

```sh
python3 sealed/generators/generate.py --seed 7 --output /tmp/closeout-demo
python3 sealed/generators/generate.py --seed 29 --output /tmp/closeout-heldout
uv run --with-requirements tests/requirements.txt python harness/check_logs.py /tmp/closeout-demo
uv run --with-requirements tests/requirements.txt python harness/check_logs.py /tmp/closeout-heldout
```

Each directory is a build root:

- `logs.jsonl`: six contracted S8 test observations per unit. Calibration belongs
  to S7; these are its downstream functional observations. No cause labels,
  known-bad flags, HAL timing or FA findings are emitted into this file.
- `sealed/hal.json`: per-unit deterministic driver-ready delay, nest settling,
  temperature and physical defect parameters. For the integrator's HAL adapter;
  never send to an assessment model, patch model or browser.
- `sealed/known-bad.json`: two persistent physical controls in the published
  format. The path is relative to each build root; this avoids one build
  overwriting another build's controls. Treat this file as sealed too.
- `build.json`: seed, unit count, record count, firmware-version label, simulated
  truth label, generator version and the log SHA-256.

The default build is 128 units. Six anchor cases include two defective domes,
all three faults and a nominal unit. Remaining fault assignment and unit order
are seeded; no wall clock, global PRNG, environment hash seed or network enters
serialization. Timestamps start at a fixed epoch. Repeating a seed and arguments
produces identical bytes in every output file. A different build refuses to
replace existing output; an identical rerun is allowed.

`nest_closed_at_ms=0` is the start of the closure event. The hidden
`nest_settle_ms` is its completion delay. Normal units settle in 20 ms; slow
units use the contracted 120 ms. Baseline capture is evaluated at 40 ms.
Nonfaulted driver readiness is 20 ms. Cold units use 180 ms and 18 C, hot units
52 C, and others 24 C. The latter nominal choices are fixture inputs, not claims
about a physical product. Warm units can share the cold units' lot ID.

The checker recomputes rates from measurements using independent pass rules,
checks schemas, duplicate/missing tests, finite values, the digest and physical
negative controls. Counts are reported by actual execution, not asserted here.
The `calibration_applied` override on `expected_measurements` exists only to test
that a physically bad dome remains bad under either readback state. A firmware
version argument labels records; it does not select a real firmware binary.
