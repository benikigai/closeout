# Closeout web demo

Run the original and corrected beacon C firmware from the web page. The C
sources under `demo-source/` are unchanged snapshots of the integrator's
firmware and fake HAL. `provenance.json` pins their hashes. Build-time `cc`
produces host-native executables; Next.js includes them in `/api/demo`.

```sh
npm ci
npm run build
npm run test:firmware
npm start
```

The host needs a C compiler. Vercel compiles Linux binaries during deployment;
local macOS builds use the available 26.5 SDK. Never upload local binaries as
prebuilt Linux functions.

`POST /api/demo` accepts only `compare` with `cold`, `warm` or `defective`,
`cheat`, or `heldout`. It executes the pinned binaries with fixed bounded inputs.
The held-out run executes 20 scenarios (seeds 1000 through 1019), 16 units each,
against both revisions. Pass/fail is computed from actual process output.
No user-supplied command, path or model prompt is executed.

The UI separates live C execution on simulated units from the recorded SubQ
assessment. It does not run a model, patch code dynamically, or mutate a ledger.
The root cause stays suspected: the stored assessment's score is below 0.85,
and live FA confirmation plus independent verification are separate integrations.

The old fixture FA endpoint is removed. The live firmware demo replaces its
hardcoded completion path. The previous fixture generator and raw run file are
retained in the repository for reference and are not imported by this site.
