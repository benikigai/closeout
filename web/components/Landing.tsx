import type source from '@/server/assessment.json';
import Closeout from '@/components/Closeout';
import measured from '@/data/demo-payload.json';

type Heldout = {
  scenarios: number; units_tested: number; cold_units: number; cold_failed_before: number; cold_failed_after: number;
  physical_defects: number; physical_still_fail: number; warm_regressions: number; passed: boolean;
};

const REPO = 'https://github.com/benikigai/closeout';
const VIDEO = process.env.NEXT_PUBLIC_VIDEO_URL;

function HeroDome({ fixed }: { fixed: boolean }) {
  const id = fixed ? 'hero-even' : 'hero-uneven';
  return (
    <svg viewBox="0 0 320 240" className={`hero-dome ${fixed ? 'is-fixed' : 'is-cold'}`} role="img"
      aria-label={fixed ? 'Beacon dome glowing evenly after the fix' : 'Beacon dome glowing unevenly on a cold start'}>
      <defs>
        <radialGradient id={id} cx={fixed ? '50%' : '24%'} cy="34%" r="72%">
          <stop offset="0%" stopColor={fixed ? '#c9f7d6' : '#ffe2a0'} />
          <stop offset="100%" stopColor={fixed ? '#3f6f54' : '#3a2d22'} />
        </radialGradient>
        <filter id={`${id}-glow`} x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="18" /></filter>
      </defs>
      <ellipse cx="160" cy="118" rx="112" ry="92" fill={fixed ? '#8dc9a2' : '#e0b978'} opacity=".18" filter={`url(#${id}-glow)`} className="halo" />
      <ellipse cx="160" cy="206" rx="108" ry="14" fill="#000" opacity=".35" />
      <path d="M62 178C62 84 104 42 160 42s98 42 98 136Z" fill={`url(#${id})`} stroke={fixed ? '#8dc9a2' : '#e0b978'} strokeWidth="1.5" />
      <path d="M62 178h196v18q-98 22-196 0Z" fill="#23282d" stroke="#596069" />
      <path d="M90 116q16-44 46-52" fill="none" stroke="#fff" opacity=".22" strokeWidth="10" strokeLinecap="round" />
      {!fixed && <path d="M188 50q66 57 59 120h-43q10-61-16-120" fill="#14181c" opacity=".45" />}
    </svg>
  );
}

export default function Landing({ assessment, heldout }: { assessment: typeof source; heldout: Heldout | null }) {
  const top = [...assessment.scores].sort((a, b) => b.score - a.score)[0];
  const proof = heldout ? [
    { k: `${heldout.units_tested}`, v: `held-out units across ${heldout.scenarios} builds` },
    { k: `${heldout.cold_failed_before} → ${heldout.cold_failed_after}`, v: `cold units failing, before and after the fix (of ${heldout.cold_units})` },
    { k: `${heldout.physical_still_fail} of ${heldout.physical_defects}`, v: 'known-bad domes still fail, as they should' },
    { k: `${heldout.warm_regressions}`, v: 'warm units broken by the fix' },
  ] : [];

  return (
    <div className="landing">
      <nav className="nav">
        <a href="#top" className="wordmark">closeout<span>.</span></a>
        <div className="nav-links">
          <a href="#problem">Problem</a><a href="#how">How it works</a><a href="#bench">Demo</a><a href="#measured">Results</a><a href="#rules">Rules</a>
          <a href={REPO} target="_blank" rel="noreferrer">GitHub</a>
        </div>
        <a href="#bench" className="nav-cta">Run the bench</a>
      </nav>

      <header className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">Factory failure analysis, closed with proof</p>
          <h1>The parts are fine.<br /><span>The firmware is early.</span></h1>
          <p className="lede">Closeout solves complex factory failures, physical or firmware, and closes each one only when a held-out build proves the fix.</p>
          <div className="ctas">
            <a href="#bench" className="btn primary">Run the bench <span aria-hidden>→</span></a>
            {VIDEO && <a href={VIDEO} className="btn" target="_blank" rel="noreferrer">Watch 60s</a>}
            <a href={REPO} className="btn" target="_blank" rel="noreferrer">Read the source</a>
          </div>
        </div>
        <figure className="hero-art">
          <div className="hero-pair">
            <div><HeroDome fixed={false} /><figcaption>Cold start. Calibration write dropped.</figcaption></div>
            <div><HeroDome fixed /><figcaption>Same unit. Firmware waits for the driver.</figcaption></div>
          </div>
          <p className="hero-chip"><span className="live-dot" />Cold Dome · S8 functional test · fictional beacon</p>
        </figure>
      </header>

      {heldout && (
        <section className="proof" aria-label="Measured results">
          {proof.map((p) => <div key={p.v}><strong>{p.k}</strong><span>{p.v}</span></div>)}
          <p className="proof-note">Computed when this page was built, by running the compiled C firmware on synthetic units. Not hand typed.</p>
        </section>
      )}

      <section className="band" id="problem">
        <p className="eyebrow">The problem</p>
        <h2>The MIL says Material.<br /><span>FA says otherwise.</span></h2>
        <p className="lede">Hardware launches slip when root cause needs physical units, FA time runs out, and three teams blame each other. Items close on a yield bump, and the defect comes back.</p>
        <div className="cards">
          <article><p className="eyebrow">Physical</p><h3>A dome is bonded off position.</h3><p>Only FA can see it. A process change closes it, and the next build has to hold.</p></article>
          <article><p className="eyebrow">Firmware</p><h3>A calibration write gets dropped.</h3><p>It only shows on some units. An agent patches real code, and the next build has to hold.</p></article>
          <article><p className="eyebrow">Both</p><h3>A slow part meets a cold start.</h3><p>It looks like Material. The fix is in firmware. No single team owns the miss.</p></article>
        </div>
      </section>

      <section className="band" id="how">
        <p className="eyebrow">How it works</p>
        <h2>Scores suggest.<br /><span>Evidence decides.</span></h2>
        <ol className="loop">
          <li><b>01</b><h3>Triage</h3><p>SubQ Snap 1.1 scores every failed unit and routes the owner, up to 128 decisions in one call.</p><em>Sponsor · Subquadratic</em><i>On this page: recorded call</i></li>
          <li><b>02</b><h3>Pick FA units</h3><p>Code spends the FA budget where it splits the open causes. The lab returns physical findings.</p><em>Code</em><i>Engine</i></li>
          <li><b>03</b><h3>Fix</h3><p>Muse Wonder patches real firmware. A fix is code, so it can be run and checked.</p><em>Sponsor · Meta Model API</em><i>On this page: patch shown, C runs live</i></li>
          <li><b>04</b><h3>Doubt</h3><p>Gemini tries to break the root cause from the evidence alone. It never sees the fixer's reasoning.</p><em>Sponsor · Google DeepMind</em><i>Engine</i></li>
          <li><b>05</b><h3>Gate and record</h3><p>Known-bad units must still fail. Held-out builds must pass. MongoDB keeps the MIL and refuses an early close.</p><em>Code · MongoDB Atlas</em><i>On this page: held-out run, live C</i></li>
        </ol>
        <p className="small">Top recorded SubQ score: {top.claim}, {top.score.toFixed(2)}. A score routes the next test. It never confirms a cause.</p>
      </section>

      <section className="band" id="bench">
        <p className="eyebrow">Try it</p>
        <h2>Run the firmware.<br /><span>Try to cheat.</span></h2>
        <p className="lede">Every result below comes from compiled C running on the server against a synthetic unit. Widen the limit and watch a known-bad dome slip through.</p>
        <Closeout assessment={assessment} embedded />
      </section>

      <section className="band" id="measured">
        <p className="eyebrow">Measured on the full loop</p>
        <h2>Real calls.<br /><span>Cached honestly.</span></h2>
        <p className="lede">The engine ran SubQ, Gemini, the firmware and MongoDB Atlas on 2026-11-07. This section replays that run, and says so.</p>
        <div className="measured">
          <div>
            <p className="eyebrow">FA investigations to root cause</p>
            <dl className="bars">
              {([['Closeout', measured.metric_summary.subq_mean], ['Random', measured.metric_summary.random_mean], ['Worst first', measured.metric_summary.worst_first_mean]] as const).map(([name, v]) => (
                <div key={name}><dt>{name}</dt><dd><i style={{ width: `${(v / measured.metric_summary.worst_first_mean) * 100}%` }} /><b>{v}</b></dd></div>
              ))}
            </dl>
            <p className="small">Mean across {measured.metric_summary.scenarios} sealed scenarios. Lower is better. Closeout and random are close here, so this is a small edge, not a rout.</p>
          </div>
          <div>
            <p className="eyebrow">Gemini blind verdict · {measured.verifier.label}</p>
            <p className="verdict">{measured.verifier.verdict === 'holds' ? 'The root cause holds.' : measured.verifier.verdict}</p>
            <p className="small">{measured.verifier.reason}</p>
            <p className="eyebrow" style={{ marginTop: 22 }}>Gates</p>
            <ul className="gates">
              <li><strong>{measured.gates.cheat.gate === 'blocked_cheat' ? 'Blocked' : 'Allowed'}</strong> {measured.gates.cheat.attempted_fix}, which let {measured.gates.cheat.known_bad_escaped.length} known-bad unit escape</li>
              <li><strong>{measured.gates.heldout.cold_fail_before} → {measured.gates.heldout.cold_fail_after_fix}</strong> cold failures across {measured.gates.heldout.seeds} held-out seeds</li>
              <li><strong>{measured.gates.heldout.known_bad_still_fail}</strong> known-bad units still fail</li>
            </ul>
          </div>
        </div>
        <p className="small">MIL {measured.mil_id} · {measured.lifecycle} · category {measured.category_history.map((c) => c.category).join(' → ')} · state {measured.truth_label}</p>
      </section>

      <section className="band" id="rules">
        <p className="eyebrow">What Closeout refuses to do</p>
        <h2>No agent can<br /><span>talk an item shut.</span></h2>
        <ul className="rules">
          <li><strong>No model writes a score.</strong> Rates, gates and pass or fail come from code.</li>
          <li><strong>No confirmed cause without FA.</strong> A score only picks the next test.</li>
          <li><strong>No fix that frees a known-bad unit.</strong> Whatever it does to yield.</li>
          <li><strong>No close before a held-out build.</strong> The next build is the judge.</li>
          <li><strong>No hidden fallback.</strong> Every result says live, replay or simulated.</li>
        </ul>
      </section>

      <section className="built">
        <p className="eyebrow">Built with</p>
        <div className="logos"><span>Subquadratic</span><span>Meta Model API</span><span>Google DeepMind</span><span>MongoDB Atlas</span></div>
      </section>

      <footer className="foot">
        <strong>Failure in. Evidence out.</strong>
        <p>Built in one day at AIE Code Summit, Nov 7, 2026. Fictional beacon, synthetic measurements, no customer data. Compiled C runs live. The SubQ assessment is a recorded call.</p>
        <a href={REPO} target="_blank" rel="noreferrer">Inspect the source ↗</a>
      </footer>
    </div>
  );
}
