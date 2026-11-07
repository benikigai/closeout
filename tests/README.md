# Offline checks

From the repository root, run all tests with one command:

```sh
uv run --with-requirements tests/requirements.txt python -m unittest discover -s tests -v
```

Python 3.9 or later is required. `uv` prepares an isolated environment with the
pinned JSON Schema validator. Once dependencies are cached, add `--offline` to
run without network. No sponsor keys or external services are used.

The suite checks the library against the unchanged 2020-12 schema, category and
station coverage, seeded fault definitions, cross-process byte reproducibility,
40 generated seeds, known-bad physical controls under both calibration states,
strict pass-rule boundaries, corruption rejection and idempotent output.

These are fixture and generator checks. They do not verify the integrator's
firmware, live FA service, selection algorithm, ledger or sponsor integrations.
