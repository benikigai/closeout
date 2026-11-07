# Closeout by N+1 Labs

**Closeout solves complex factory failures, physical or firmware, and closes each one only when the next build proves the fix.**

The MIL says Material. The parts are fine.

Built at the AIE Code Summit Hackathon on 2026-11-07. Everything here was written during the event. All data is synthetic and seeded. This shows the loop, not the physics.

## The problem

Every hardware program runs a Major Issues List (MIL). Each item has a failure, a station, a failure rate, an owner and a suspected cause. Teams test hypotheses, send units to failure analysis (FA), confirm a root cause, ship a corrective action and monitor it.

The hard items cross boundaries:

- **Physical:** a part is off, a process drifted, a fixture wore out.
- **Firmware:** code made an assumption the hardware broke.
- **Both:** a slower second-source part meets a cold start. It shows up as Material, the fix is in firmware, and no single team owns it.

FA time is scarce. Picking the wrong units burns days. Closing an item on a yield bump can hide the defect.

## The loop

**SubQ decides → Muse builds → Gemini checks → MongoDB remembers**

| Step | What happens | Who |
| --- | --- | --- |
| Lock | The twin's top failures are hashed before the build | Code |
| Reveal | The hash verifies and hit@3 is computed | Code |
| Triage | Each failed unit gets a probability for every hypothesis, and each item gets an owner | SubQ Snap 1.1 |
| FA routing | SubQ scores units, then code picks the units to send | SubQ and code |
| Root cause | Only an FA finding can confirm a cause | Sealed FA lab |
| Fix | A versioned change to firmware, a test or the twin | Muse (`muse-wonder-1.0`) |
| Attack | An independent model tries to refute it from the data and the claim | Gemini (`gemini-4-argon`) |
| Gate | A held-out build decides what stays. The rest rolls back | Code |
| Record | MIL item, evidence, versions and rollback | MongoDB Atlas |

**Track:** The System That Gets Better. Each failure becomes a versioned change, and held-out work decides what is adopted.

## Rules

- No model computes a score. Code does.
- `confirmed` needs an FA finding ID.
- An item cannot close before monitoring passes.
- Every value is tagged observed or inferred.
- Live, replay and fixture states stay visible on every screen.

## Plan

| By (PT) | Slice | Owner | Status |
| --- | --- | --- | --- |
| 12:30 | Real SubQ call on seeded logs | Claude Code | Done |
| 12:45 | Site on Vercel, on fixture data | Claude Code | In progress |
| 1:30 | Scaffold line, toy twin, station code, sealed FA lab | Muse Code | Not started |
| 2:30 | Hash lock, hit@3, FA picker, baselines | Muse Code | Not started |
| 3:30 | Muse change, Gemini attack, held-out gate, MongoDB ledger | Muse Code | Not started |
| 4:15 | Site reads the real `run.json`. Feature freeze | Both | Not started |
| 4:45 | One-minute video | Ben | Not started |
| 5:00 | Submit | Ben | Not started |

**Fallback:** if the Muse loop is not working by 3:30 PM, ship lock, reveal, score and the FA race, and show the change as a labeled replay.

## Measured so far

One SubQ Snap 1.1 call on 128 seeded failed units whose causes overlap on purpose (2.54 s):

| Check | Result |
| --- | --- |
| Top choice matched the seeded cause | 41.4% |
| Confidence 0.8 to 1.0 (31 units) | Said 93%, right 71% |
| Causes found with 5 FA units, SubQ picks | 73.4% of failed units explained |
| Random picks, 2,000 trials | 78.6% |
| Lowest uniformity first | 79.7% |

The first picker lost to both baselines. FA routing is unproven, and this is the next problem to solve. The sample is small.

## Repo

```text
web/    Next.js site, deployed on Vercel. FA answers stay on the server.
engine/ Scaffold line, twin, FA lab and agent loop.
docs/   run-contract.md, the JSON the engine writes and the site reads.
```

The site runs on `web/data/run.json`. `web/data/sealed.json` holds the FA answers and is not in this repo. Regenerate both from `web/` with `SUBQ_API_KEY=... python3 scripts/make_fixture.py`.

## Where it goes

N+1 Labs builds the Golden Twin, a twin of the line that builds your product, corrected by every real build. Closeout is the loop that does the correcting. The twin here is a toy behind a small interface.

Prior work: the sealed backtest idea and the Draft, Calibrated, Proven grades come from N+1 Labs. No Golden Twin code is in this repo. Station names are placeholders.
