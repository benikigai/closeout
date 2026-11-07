# Engine

Integrator-owned FA engine. Sponsors call live APIs only through these modules.
Keys come from the environment (never commit `.env`).

- `firmware/` — small C beacon firmware (buggy v1) + fake HAL + deterministic tests.
  Build: `SDKROOT=/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk make -C firmware test`
  (the MacOSX27 SDK fails to link on this MBP; see firmware/README.md).
- `firmware_v2/` — patched firmware produced by the patch loop (label in cache).
- `fa/` — SubQ assessment (`assess`), FA pickers + offline metric (`metric`),
  patch loop (`patch_loop`), gates: cheat / held-out / Gemini blind (`gates`),
  demo payload assembly (`demo_payload` -> `fa/cache/demo-payload.json`).
  Run with the project venv: `python -m fa.metric`, `python -m fa.assess`,
  `python -m fa.gates`, `python -m fa.demo_payload`.
- `ledger/` — MongoDB Atlas MIL ledger with strict `$jsonSchema` and close gates.
  Run: `python -m ledger.ledger` with `MONGODB_URI` and `MONGODB_DB` set.

Measured claims policy: every number in `web/data/demo-payload.json` comes
from a run of these modules. SubQ outputs are called scores (calibration gate
Brier 0.159 > 0.15), never calibrated probabilities.
