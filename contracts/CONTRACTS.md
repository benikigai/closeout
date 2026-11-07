# Closeout contracts (canonical, integrator-owned)

Schema dialect: JSON Schema 2020-12 for every `.schema.json` in this folder.
Canonical checkout for all sessions: this folder. Copy files into the repo
`contracts/` unchanged; do not edit copies. Conflicts resolve here.

Owned paths (final): Codex owns `sealed/generators/` (plural), `library/`,
`harness/`, `ui/`, `tests/`. Integrator owns `contracts/`, `fa/`, `ledger/`,
`firmware/`. Spruce lane (optional) owns `sealed/world/` and `verifier/`.

## Stations (stable IDs, use exactly these)

| ID | Station |
|---|---|
| S1-shell | Top shell sub-assembly |
| S2-pcba | Place main board |
| S3-screws | Drive screws |
| S4-speaker-haptic | Speaker and haptic (adhesive) |
| S5-battery | Battery fit |
| S6-dome-bond | Dome bond and diffuser seat |
| S7-flash-cal | Flash, provision, calibrate |
| S8-functional-pack | Functional test, mark, pack |

## Tests and measured fields (log `measured` object)

| test_id | Station | measured keys (units) | Pass rule (checker computes) |
|---|---|---|---|
| T-OPT-01 | S8-functional-pack | `uniformity` (0-1), `cal_applied` (0/1) | uniformity < 0.05 |
| T-TCH-01 | S8-functional-pack | `baseline_drift` (counts), `nest_closed_at_ms` | baseline_drift < 30 |
| T-AUD-01 | S8-functional-pack | `snr_db` (dB), `unit_temp_c` | snr_db > 18 |
| T-IMU-01 | S8-functional-pack | `bias_dps` | bias_dps < 0.5 |
| T-BLE-01 | S8-functional-pack | `rssi_dbm` | rssi_dbm > -75 |
| T-PWR-01 | S8-functional-pack | `rail_mv` (mV) | 3250 <= rail_mv <= 3350 |

Calibration happens at S7-flash-cal; functional results land at S8. A unit
record is one JSONL line per test, validated by `log-record.schema.json`.

## Deterministic HAL / fault parameters (seeded, never wall-clock)

- Cold Dome (Firmware, initially blamed Material): `driver_ready_ms` is 180
  for cold second-source units, 20 for warm units. Buggy firmware writes
  calibration at t=50 ms with no ready-wait and no readback. Cold units drop
  the write (`cal_applied=0`, uniformity 0.18, fail). Warm units pass
  (uniformity 0.02). Real fix: wait until ready, write, read back, retry once.
- Ghost Hold (Firmware/Test Station): `nest_settle_ms` 120 on slow units.
  Buggy firmware captures touch baseline at t=40 ms, before nest settle.
  Slow units show `baseline_drift` 85 (fail); normal units 8 (pass).
- Hot Queue (Firmware/Material red herring): mic table valid to 45 C.
  Units arriving warm at 52 C produce `snr_db` 11 (fail); cool units 24 (pass).
- Known-bad (physical, unfixable by firmware): `dome_defect=1` units measure
  uniformity 0.22 regardless of calibration. They must fail in every build.
- Known-bad file format (`sealed/known-bad.json`):
  `{"unit_ids": ["U-0001"], "reason": "dome_defect"}`. One file per build.

## FA lab interface (spruce/integrator implement; Codex consumes the stub)

- `POST /fa/investigate` body `{"unit_id": "...", "scenario_seed": 7}`
  returns `{"finding_id": "FA-001", "unit_id": "...", "finding": "...",
  "supports": ["H-..."], "refutes": ["H-..."]}`. Only the FA lab writes
  findings. A finding reveals the unit's physical slice of ground truth.
- Budget: one scenario run allows 10 investigations by default
  (demo beat: 5 judge picks + 5 SubQ picks counts against the same budget).
  Budget resets per scenario seed. Over-budget returns HTTP 429
  `{"error": "fa_budget_exceeded"}`.
- Stopping criterion (integrator picker): stop when the top hypothesis
  SubQ score >= 0.85 AND at least one FA finding supports it AND no FA
  finding refutes it; else continue until budget ends. Root cause may be
  marked `confirmed` in the MIL only with >=1 supporting finding ID.
- Picker comparison interface (harness): a picker is a callable
  `pick(candidates, hypotheses, k, history) -> [unit_id, ...]` where
  `candidates` are failing unit records, `hypotheses` carries current
  scores, `history` lists investigated unit IDs. Random and worst-first
  baselines implement the same signature. Metric: investigations until
  the stopping criterion first holds, over >=20 scenario seeds.

## UI input contract

UI consumes one assessment JSON validated by `ui-input.schema.json`.
Example: `ui-fixture.example.json` in this folder. Lifecycle states:
`open -> assessing -> suspected -> confirmed -> monitoring -> closed`,
plus `blocked_cheat`. Every payload carries `truth_label`:
`live | fixture | replay | simulated`. Verifier dissent sets
`verifier: {"verdict": "dissent", "reason": "..."}` and lifecycle stays
`suspected`. Metric summary carries scenario count, means, and variance;
single-run numbers must be labeled illustration, never the headline.

## Cheat-fix fixture contract

Validated by `cheat-fixture.schema.json`. A fixture names an attempted
limit-widening fix, the known-bad results under that fix, and the expected
gate outcome `blocked_cheat`. Tests exercise supplied outcomes only;
gate implementation belongs to the integrator (`ledger/`).
