import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { runUnit } from './firmware';

/* Per-unit held-out results for the 60-second tour. Same binaries, seeds and
   counting rules as verifyHeldout() in firmware.ts, but keeps every unit so the
   tour can draw one square per unit. Nothing here is typed by hand. */
export type GridCell = { kind: 'cold' | 'warm' | 'defect'; before: 'pass' | 'fail'; fixed: 'pass' | 'fail' };
type Scenario = { seed: number; units: { ready_ms: number; defect: number }[] };

export async function heldoutGrid() {
  const raw = await readFile(path.join(process.cwd(), 'demo-source/heldout.json'), 'utf8');
  const scenarios = JSON.parse(raw) as Scenario[];
  const rows: { seed: number; cells: GridCell[] }[] = [];
  for (const scenario of scenarios) {
    const cells: GridCell[] = [];
    for (let i = 0; i < scenario.units.length; i += 4) {
      cells.push(...await Promise.all(scenario.units.slice(i, i + 4).map(async (unit) => {
        const before = await runUnit('before', unit.ready_ms, unit.defect);
        const fixed = await runUnit('fixed', unit.ready_ms, unit.defect);
        const kind: GridCell['kind'] = unit.defect ? 'defect' : unit.ready_ms === 180 ? 'cold' : 'warm';
        return { kind, before: before.result, fixed: fixed.result };
      })));
    }
    rows.push({ seed: scenario.seed, cells });
  }
  const all = rows.flatMap((r) => r.cells);
  const cold = all.filter((c) => c.kind === 'cold');
  const defects = all.filter((c) => c.kind === 'defect');
  const warm = all.filter((c) => c.kind === 'warm');
  const stats = {
    scenarios: rows.length,
    units: all.length,
    seedFirst: rows[0]?.seed ?? 0,
    seedLast: rows[rows.length - 1]?.seed ?? 0,
    cold: cold.length,
    coldBefore: cold.filter((c) => c.before === 'fail').length,
    coldAfter: cold.filter((c) => c.fixed === 'fail').length,
    defects: defects.length,
    defectsStillFail: defects.filter((c) => c.fixed === 'fail').length,
    warmRegressions: warm.filter((c) => c.fixed !== 'pass').length,
  };
  const passed = stats.cold > 0 && stats.coldBefore === stats.cold && stats.coldAfter === 0 &&
    stats.defects > 0 && stats.defectsStillFail === stats.defects && stats.warmRegressions === 0;
  return { rows, stats: { ...stats, passed } };
}
