import 'server-only';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execute = promisify(execFile);
export type UnitResult = { cal_applied: number; uniformity: number; result: 'pass' | 'fail' };
export const cases = {
  cold: { ready_ms: 180, defect: 0, name: 'Cold second-source unit' },
  warm: { ready_ms: 20, defect: 0, name: 'Warm control' },
  defective: { ready_ms: 180, defect: 1, name: 'Physical dome defect' },
} as const;
export type CaseName = keyof typeof cases;

export async function runUnit(revision: 'before' | 'fixed', ready: number, defect: number): Promise<UnitResult> {
  const binary = path.join(process.cwd(), 'demo-bin', revision);
  const { stdout } = await execute(binary, [String(ready), String(defect)], { timeout: 3000, maxBuffer: 4096 });
  const row = JSON.parse(stdout) as UnitResult;
  if (![0, 1].includes(row.cal_applied) || !Number.isFinite(row.uniformity) ||
      !['pass', 'fail'].includes(row.result) || row.result !== (row.uniformity < .05 ? 'pass' : 'fail')) {
    throw new Error('Firmware returned an invalid measurement');
  }
  return row;
}

export async function compare(name: CaseName) {
  const unit = cases[name];
  const [before, fixed] = await Promise.all([
    runUnit('before', unit.ready_ms, unit.defect), runUnit('fixed', unit.ready_ms, unit.defect),
  ]);
  return { truth_label: 'live', data_origin: 'simulated', case: name, unit, before, fixed };
}

type Scenario = { seed: number; units: { ready_ms: number; defect: number }[] };
// The held-out run is deterministic: the same binaries and the same seeds give the same result.
// Run it at most once per server instance, and let concurrent callers share that one run.
let heldoutRun: ReturnType<typeof runHeldout> | null = null;
export function verifyHeldout() {
  if (!heldoutRun) heldoutRun = runHeldout().catch((error) => { heldoutRun = null; throw error; });
  return heldoutRun;
}

async function runHeldout() {
  const raw = await readFile(path.join(process.cwd(), 'demo-source/heldout.json'), 'utf8');
  const scenarios = JSON.parse(raw) as Scenario[];
  let tested = 0, cold = 0, coldFailedBefore = 0, coldFailedAfter = 0, physical = 0, physicalStillFail = 0, warmRegressions = 0;
  for (const scenario of scenarios) {
    // Small batches bound child-process concurrency inside the function.
    for (let i = 0; i < scenario.units.length; i += 4) {
      const rows = await Promise.all(scenario.units.slice(i, i + 4).map(async unit => {
        const before = await runUnit('before', unit.ready_ms, unit.defect);
        const fixed = await runUnit('fixed', unit.ready_ms, unit.defect);
        return { unit, before, fixed };
      }));
      for (const { unit, before, fixed } of rows) {
        tested++;
        if (unit.defect) { physical++; if (fixed.result === 'fail') physicalStillFail++; }
        else if (unit.ready_ms === 180) {
          cold++;
          if (before.result === 'fail') coldFailedBefore++;
          if (fixed.result === 'fail') coldFailedAfter++;
        } else if (fixed.result !== 'pass') warmRegressions++;
      }
    }
  }
  return {
    truth_label: 'live', data_origin: 'simulated', scenarios: scenarios.length, units_tested: tested,
    cold_units: cold, cold_failed_before: coldFailedBefore, cold_failed_after: coldFailedAfter,
    physical_defects: physical, physical_still_fail: physicalStillFail, warm_regressions: warmRegressions,
    passed: cold > 0 && coldFailedBefore === cold && coldFailedAfter === 0 && physical > 0 && physicalStillFail === physical && warmRegressions === 0,
  };
}
