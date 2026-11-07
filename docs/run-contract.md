# Closeout run contract v0

The engine writes one file, `run.json`. The site reads it and computes nothing a model should not compute. Fields can be added, but do not rename them without a note in `STATUS.md`.

`mode` must be one of `live`, `replay`, `fixture`. The site shows it on every screen.

```json
{
  "contract": 0,
  "mode": "fixture",
  "generated_at": "ISO 8601",
  "build": "N",
  "line": [{"id": "S1", "name": "station name"}],
  "prediction": {"locked_text": "exact string that was hashed", "sha256": "hex", "top": ["class id, ranked"]},
  "actual_pareto": [{"class": "class id", "units": 0}],
  "score": {"hit_at_3": 0, "of": 3, "chance_rate": 0, "baselines": {"name": 0}},
  "addressable_share": 0,
  "hypotheses": [{"id": "h id", "label": "text", "category": "owner team"}],
  "units": [{"id": "U0001", "station": "S1", "lot": "A", "fixture": 1, "hour_of_shift": 1, "temp_c": 25.0,
             "subq": {"h id": 0.0}}],
  "mil": [{"id": "MIL-001", "jira_url": null, "failure_name": "", "station": "S1", "units_failed": 0, "units_tested": 0,
           "failure_rate": 0, "category": "", "category_history": [{"from": "", "to": "", "reason": ""}],
           "fa_steps": [], "fa_findings": [], "root_cause": {"text": "", "status": "suspected"},
           "corrective_action": "", "etc_ca": null, "etc_monitoring": null, "status": "open"}],
  "fa": {"budget": 5, "subq_picks": ["U0001"]},
  "changes": [{"id": "A", "summary": "", "diff": "", "build_n_score": 0, "heldout_score": 0,
               "gemini": "what the attack found", "decision": "rejected"}]
}
```

Sealed file, served only by the server and never sent whole to the browser:

```json
{"findings": {"U0001": {"hypothesis": "h id", "text": "FA finding", "evidence": "observed"}}}
```
