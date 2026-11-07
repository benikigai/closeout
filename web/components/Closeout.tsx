'use client';

import { useState } from 'react';
import type source from '@/server/assessment.json';

type Unit = { cal_applied: number; uniformity: number; result: 'pass' | 'fail' };
type Comparison = { before: Unit; fixed: Unit; unit: { ready_ms: number; defect: number; name: string } };
type Heldout = { scenarios: number; units_tested: number; cold_units: number; cold_failed_before: number; cold_failed_after: number; physical_defects: number; physical_still_fail: number; warm_regressions: number; passed: boolean };
type CaseName = 'cold' | 'warm' | 'defective';
const steps = ['Reproduce', 'Investigate', 'Reject shortcut', 'Run correction', 'Verify held-out'];

function Dome({ uniformity = .02, label }: { uniformity?: number; label: string }) {
  const uneven = uniformity >= .05;
  return <svg viewBox="0 0 320 230" className="dome" role="img" aria-label={label}>
    <defs><radialGradient id={uneven ? 'uneven' : 'even'} cx={uneven ? '26%' : '50%'} cy="35%" r="70%"><stop offset="0%" stopColor={uneven ? '#ffdf97' : '#bbf5ce'} /><stop offset="100%" stopColor={uneven ? '#3d3026' : '#44765b'} /></radialGradient></defs>
    <ellipse cx="160" cy="197" rx="104" ry="14" fill="#000" opacity=".3" />
    <path d="M64 171C64 80 104 40 160 40s96 40 96 131Z" fill={`url(#${uneven ? 'uneven' : 'even'})`} stroke={uneven ? '#e0b978' : '#8dc9a2'} strokeWidth="1.5" />
    <path d="M64 171h192v17q-96 21-192 0Z" fill="#272c31" stroke="#596069" />
    <path d="M91 112q16-42 45-49" fill="none" stroke="#fff" opacity=".23" strokeWidth="10" strokeLinecap="round" />
    {uneven && <path d="M186 48q65 55 58 116h-42q10-59-16-116" fill="#171c22" opacity=".42" />}
  </svg>;
}

export default function Closeout({ assessment }: { assessment: typeof source }) {
  const [stage, setStage] = useState(0);
  const [selected, setSelected] = useState<CaseName>('cold');
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [heldout, setHeldout] = useState<Heldout | null>(null);
  const [cheat, setCheat] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function call(body: object) {
    const response = await fetch('/api/demo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? 'The run failed.');
    return data;
  }
  async function advance() {
    setBusy(true); setError('');
    try {
      if (stage === 0) { setComparison(await call({ action: 'compare', case: selected })); setStage(1); }
      else if (stage === 1) setStage(2);
      else if (stage === 2) { const result = await call({ action: 'cheat' }); setCheat(result.decision === 'blocked_cheat'); setStage(3); }
      else if (stage === 3) { setComparison(await call({ action: 'compare', case: selected })); setStage(4); }
      else { setHeldout(await call({ action: 'heldout' })); setStage(5); }
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Run failed'); }
    finally { setBusy(false); }
  }
  function reset(next: CaseName = selected) { setSelected(next); setStage(0); setComparison(null); setHeldout(null); setCheat(null); setError(''); }
  const result = comparison?.before;
  const showFixed = stage >= 4;
  const action = ['Reproduce the failure', 'Inspect the evidence', 'Test the shortcut', 'Run the corrected firmware', 'Run 20 held-out builds'][stage];

  return <main>
    <header className="topbar"><a href="#" className="wordmark">closeout<span>.</span></a><div className="run-label"><span className="live-dot" />Live C execution <span className="divider">/</span> Synthetic factory</div><a className="repo" href="https://github.com/benikigai/closeout" target="_blank" rel="noreferrer">Source ↗</a></header>
    <section className="intro"><p className="eyebrow">AIE CODE SUMMIT · NOV 07, 2026</p><h1>The parts are fine.<br /><span>The firmware is early.</span></h1><p className="lede">A cold driver drops a calibration write. Find the cause, block the shortcut, and let the next build judge the correction.</p></section>
    <nav className="steps" aria-label="Demo progress">{steps.map((step, i) => <span key={step} className={stage > i ? 'done' : stage === i ? 'active' : ''}><b>{stage > i ? '✓' : String(i + 1).padStart(2, '0')}</b>{step}</span>)}</nav>
    <section className="bench">
      <div className="bench-head"><div><p className="eyebrow">THE VIRTUAL TEST BENCH</p><h2>{selected === 'cold' ? 'Cold Dome' : selected === 'warm' ? 'Warm control' : 'Physical defect control'}</h2></div><span className="tag">S8 · FUNCTIONAL TEST</span></div>
      <div className="case-picker" aria-label="Unit conditions">{([['cold', 'Cold start'], ['warm', 'Warm control'], ['defective', 'Known-bad dome']] as const).map(([id, name]) => <button key={id} disabled={busy} className={selected === id ? 'selected' : ''} onClick={() => reset(id)}>{name}</button>)}</div>
      <div className="bench-grid"><article className="beacon-panel"><div className="panel-title"><span>As shipped</span><span className="tag">{result ? 'LIVE RESULT' : 'PREVIEW'}</span></div><Dome uniformity={result?.uniformity ?? (selected === 'warm' ? .02 : .18)} label="Beacon running the original firmware" /><div className="result-line"><strong className={result?.result === 'fail' ? 'red' : result ? 'green' : ''}>{result ? result.result.toUpperCase() : 'READY'}</strong><span>Uniformity error <b>{result ? result.uniformity.toFixed(2) : '—'}</b></span></div><p className="small">{comparison ? `Driver ready at ${comparison.unit.ready_ms} ms. Calibration ${result?.cal_applied ? 'applied' : 'missing'}.` : 'Run the test to measure this unit.'}</p></article>
      <article className="beacon-panel fixed"><div className="panel-title"><span>After correction</span><span className="tag">{showFixed ? 'LIVE RESULT' : 'WAITING'}</span></div><Dome uniformity={showFixed ? comparison?.fixed.uniformity : .02} label="Beacon running the corrected firmware" /><div className="result-line"><strong className={showFixed ? comparison?.fixed.result === 'pass' ? 'green' : 'red' : ''}>{showFixed ? comparison?.fixed.result.toUpperCase() : 'NOT SHOWN'}</strong><span>Uniformity error <b>{showFixed ? comparison?.fixed.uniformity.toFixed(2) : '—'}</b></span></div><p className="small">{showFixed ? 'Same unit. Same test limit. Different compiled firmware.' : 'A passing result must come from running the correction.'}</p></article></div>
      <div className="action-bar"><p>{busy ? 'Running on the server. No model decides the result.' : stage === 5 ? heldout?.passed ? 'Held-out checks passed. Evidence is below.' : 'Held-out checks failed. The correction is not accepted.' : ['Start with a measured failure.', 'Trace the timing before blaming the lot.', 'A wider limit can hide a real defect.', 'Wait for the driver, then write calibration.', 'Fresh seeds. Physical controls. The same limit.'][stage]}</p>{stage < 5 ? <button className="primary" disabled={busy} onClick={advance}>{busy ? 'Running…' : action}<span>→</span></button> : <button className="primary" onClick={() => reset()}>Run again <span>↺</span></button>}</div>
      {error && <p role="alert" className="error">{error}</p>}
    </section>
    <div className="evidence-grid">
    <section className="evidence-panel"><div className="section-head"><p className="eyebrow">01 / ASSESSMENT</p><span className="tag replay">REPLAY</span></div><h2>Scores suggest.<br />Evidence decides.</h2><p className="small">Recorded SubQ assessment: {assessment.units_failed} failed units out of {assessment.units_tested}. These are ranking scores, not calibrated probabilities.</p><div className="score-wall">{assessment.scores.map(h => <div key={h.id} className="score-row"><div><span>{h.claim.replace(/ \(.+\)/, '')}</span><b>{h.score.toFixed(3)}</b></div><i><em style={{ width: `${h.score * 100}%` }} /></i></div>)}</div><p className="small">Top score is below the 0.85 confirmation threshold. This screen does not mark a root cause confirmed.</p></section>
    <section className="evidence-panel"><div className="section-head"><p className="eyebrow">02 / OBSERVATIONS</p><span className="tag">{stage >= 2 ? 'RECORDED TRACE' : 'WAITING'}</span></div><h2>What we know.<br />What we infer.</h2>{stage >= 2 ? <ul className="evidence"><li><span className="observed">OBSERVED · SIMULATED</span>Cold driver ready at 180 ms. Original write scheduled at 50 ms. Calibration readback is empty.</li><li><span className="inferred">INFERRED</span>The driver was not ready when the firmware wrote calibration.</li><li><span className="observed">CONTROL</span>Warm driver ready at 20 ms. The original firmware passes the same optical limit.</li></ul> : <p className="small placeholder">Run the unit, then inspect the saved engine trace.</p>}</section>
    </div>
    {stage >= 3 && <section className="gate-panel"><div className="section-head"><p className="eyebrow">03 / THE SHORTCUT</p><span className="tag">LIVE C RESULT + CODE CHECK</span></div><h2 className={cheat ? 'red' : ''}>{cheat ? 'The shortcut passes the wrong unit.' : 'The shortcut check did not block.'}</h2><p>Raise the optical limit from 0.05 to 0.24 and a physically defective dome measuring 0.22 passes. The negative control blocks that change.</p><pre><code><span className="red">− uniformity &lt; 0.24  // hides a physical defect</span>{'\n'}+ uniformity &lt; 0.05  // original limit retained</code></pre><p className="small">This is the demo’s measured negative-control check. No production ledger mutation is performed.</p></section>}
    {stage >= 4 && <section className="gate-panel"><div className="section-head"><p className="eyebrow">04 / THE CORRECTION</p><span className="tag">REAL COMPILED C</span></div><h2>Change the timing.<br />Keep the standard.</h2><pre><code>{'while (!hal_led_driver_ready()) hal_delay_ms(10);\nif (hal_led_write_cal(CAL_TARGET)) return 1;\nhal_delay_ms(10);\nreturn hal_led_write_cal(CAL_TARGET);'}</code></pre><p className="small">An unchanged snapshot of Muse’s correction, compiled on the deployment builder. Both revisions execute against the same synthetic HAL.</p></section>}
    {heldout && <section className={`heldout ${heldout.passed ? 'passed' : 'failed'}`}><div className="section-head"><p className="eyebrow">05 / HELD-OUT VERIFICATION</p><span className="tag">LIVE C EXECUTION</span></div><h2>{heldout.passed ? 'The next builds hold.' : 'The correction failed verification.'}</h2><div className="metrics"><div><strong>{heldout.scenarios}</strong><span>fresh scenario seeds</span></div><div><strong>{heldout.cold_failed_before} → {heldout.cold_failed_after}</strong><span>cold-unit failures</span></div><div><strong>{heldout.physical_still_fail}/{heldout.physical_defects}</strong><span>physical defects still rejected</span></div></div><p className="small">{heldout.units_tested} virtual units ran through both binaries. Warm-control regressions: {heldout.warm_regressions}. This verifies the firmware correction, not physical-world yield.</p><p className="limit-note">MIL state: suspected. Live FA confirmation, independent verification, and the MongoDB closeout gate are still separate integrations.</p></section>}
    <footer><strong>Failure in. Evidence out.</strong><p>Standalone hackathon prototype. Fictional beacon, synthetic measurements.<br />Live C execution · SubQ assessment replay · No live model calls or customer data.</p><a href="https://github.com/benikigai/closeout" target="_blank" rel="noreferrer">Inspect the source ↗</a></footer>
  </main>;
}
