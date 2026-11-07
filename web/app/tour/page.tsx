import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Metadata } from 'next';
import run from '@/data/run.json';
import measured from '@/data/demo-payload.json';
import { cases, runUnit } from '@/server/firmware';
import { heldoutGrid } from '@/server/heldout-grid';
import Tour, { type TourData } from '@/components/tour/Tour';
import './tour.css';

export const metadata: Metadata = {
  title: 'Closeout | 60-second tour',
  description: 'A self-running 60-second tour of Closeout, drawn from the repo data and the compiled firmware.',
};

// Same rules as /api/demo: a unit passes below 0.05 uniformity; the cheat widens that to 0.24.
const LIMIT = 0.05;
const CHEAT_LIMIT = 0.24;

function body(src: string) {
  const m = src.match(/int fw_calibrate\(void\) \{([\s\S]*?)\n\}/);
  if (!m) throw new Error('fw_calibrate() not found in firmware source');
  return m[1].split('\n').map((l) => l.trim()).filter(Boolean);
}

export default async function TourPage() {
  const src = (rev: string) => readFile(path.join(process.cwd(), 'demo-source', rev, 'firmware.c'), 'utf8');
  const [beforeSrc, fixedSrc, grid, coldBefore, coldFixed, defectFixed] = await Promise.all([
    src('before'), src('fixed'), heldoutGrid(),
    runUnit('before', cases.cold.ready_ms, cases.cold.defect),
    runUnit('fixed', cases.cold.ready_ms, cases.cold.defect),
    runUnit('fixed', cases.defective.ready_ms, cases.defective.defect),
  ]);
  const writeMs = Number(beforeSrc.match(/hal_delay_ms\((\d+)\)/)?.[1]);
  if (!Number.isFinite(writeMs)) throw new Error('write slot not found in firmware source');

  const mil = run.mil[0];
  const label = (id: string) => run.hypotheses.find((h) => h.id === id)?.label ?? id;
  const wall = run.units.map((u) => {
    const scores = u.subq as Record<string, number>;
    const top = Object.keys(scores).reduce((a, b) => (scores[b] > scores[a] ? b : a));
    return { id: u.id, top, score: scores[top], picked: run.fa.subq_picks.includes(u.id) };
  });
  const tops = run.hypotheses
    .map((h) => ({ id: h.id, label: h.label, count: wall.filter((w) => w.top === h.id).length }))
    .sort((a, b) => b.count - a.count);
  const first = mil.category_history[0];
  const supported = measured.hypotheses.find((h) => h.status === 'supported');

  const data: TourData = {
    mil: {
      id: mil.id, failure: mil.failure_name, station: mil.station,
      stationName: run.line.find((s) => s.id === mil.station)?.name ?? mil.station,
      failed: mil.units_failed, tested: mil.units_tested,
      firstCategory: first.from, finalCategory: first.to, reroute: first.reason,
      findings: mil.fa_findings.flatMap((f) => f.split(/(?<=\.)\s+/)).filter(Boolean),
    },
    theories: run.hypotheses
      .filter((h) => h.category !== first.to)
      .sort((a, b) => (a.category === first.from ? -1 : b.category === first.from ? 1 : 0))
      .map((h) => ({ label: h.label, category: h.category })),
    subq: { model: run.subq_call.model, units: run.subq_call.units, seconds: run.subq_call.seconds },
    wall, tops, budget: run.fa.budget,
    pickLabels: run.fa.subq_picks,
    timing: { writeMs, coldReadyMs: cases.cold.ready_ms, warmReadyMs: cases.warm.ready_ms },
    code: { before: body(beforeSrc), fixed: body(fixedSrc) },
    coldUnit: { before: coldBefore, fixed: coldFixed },
    limit: LIMIT, cheatLimit: CHEAT_LIMIT, defectFixed,
    verifier: {
      verdict: measured.verifier.verdict,
      claim: supported?.claim ?? label('firmware_timing'),
      evidence: measured.evidence.map((e) => ({ kind: e.kind, text: e.text })),
    },
    heldout: grid,
  };
  return <Tour data={data} />;
}
