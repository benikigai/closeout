# Failure library

Twenty-four fictional failure scenarios. Only Cold Dome, Ghost Hold and Hot
Queue are seeded in the beacon generator. The camera scenarios are unseeded
accessory packs, not additional hardware in the beacon demo.

`failure-library.json` is an array. Validate each entry against the integrator's
`contracts/failure-library.schema.json`. IDs stay stable across generator seeds.
There are at least two entries in each true category and each initial category.
Initial ownership is a triage suspicion, not a confirmed cause.

The seeded entries use the exact timing, readings and physical negative control
in `contracts/CONTRACTS.md`. Other entries are descriptive data only: they do not
claim new test IDs, hardware behavior, observed findings or implemented fixes.

This file contains hidden causes and expected fixes for fixture construction.
Do not provide it to the assessment model, corrective-action model or browser.
Use the per-test log records as assessment inputs instead.

Run the library checks from the repository root:

```sh
uv run --with-requirements tests/requirements.txt python -m unittest discover -s tests -p 'test_library.py' -v
```
