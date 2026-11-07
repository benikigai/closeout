"use client";

import { useEffect, useMemo, useState } from "react";
import type runData from "@/data/run.json";

type Run = Omit<typeof runData, "fa"> & { fa: Omit<typeof runData.fa, "subq_picks"> };
type Opened = { results: { id: string; hypothesis: string; text: string }[]; causes: string[]; coverage: number };
type Race = { you: Opened; subq: Opened; subq_picks: string[]; baselines: { random: number; worst_first: number } };

const COLORS: Record<string, string> = {
  firmware_timing: "var(--gold)",
  fixture_contact: "#6FA8DC",
  assembly_guide: "#9B8CFF",
  material_led: "var(--red)",
};
const pct = (x: number, d = 0) => `${(x * 100).toFixed(d)}%`;

async function sha256(text: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function Ring({ dim }: { dim: boolean }) {
  return (
    <svg viewBox="0 0 120 120" className="ring" role="img" aria-label={dim ? "Dim light ring" : "Bright light ring"}>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const lit = !dim || i % 3 === 0;
        return <circle key={i} cx={60 + 44 * Math.cos(a)} cy={60 + 44 * Math.sin(a)} r={7} fill={lit ? "var(--gold)" : "#4a3f22"} opacity={lit ? 1 : 0.7} />;
      })}
    </svg>
  );
}

function Step({ n, title, line, children }: { n: string; title: string; line?: string; children: React.ReactNode }) {
  return (
    <section className="step">
      <p className="eyebrow">{n}</p>
      <h2>{title}</h2>
      {line && <p className="lede">{line}</p>}
      {children}
    </section>
  );
}

export default function Closeout({ run }: { run: Run }) {
  const [stage, setStage] = useState(0);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [wall, setWall] = useState(0);
  const [picks, setPicks] = useState<string[]>([]);
  const [race, setRace] = useState<Race | null>(null);
  const [error, setError] = useState("");
  const [gate, setGate] = useState(0);

  const hyp = useMemo(() => Object.fromEntries(run.hypotheses.map((h) => [h.id, h])), [run]);
  const top = (subq: Record<string, number>) => Object.entries(subq).sort((a, b) => b[1] - a[1])[0];
  const item = run.mil[0];
  const history = item.category_history[0];
  const flipped = !!race;
  const closed = gate >= 2;

  useEffect(() => {
    if (stage < 2 || wall >= run.units.length) return;
    const t = setTimeout(() => setWall((w) => Math.min(w + 6, run.units.length)), 30);
    return () => clearTimeout(t);
  }, [stage, wall, run.units.length]);

  async function reveal() {
    setVerified((await sha256(run.prediction.locked_text)) === run.prediction.sha256);
    setStage(1);
  }

  async function send() {
    setError("");
    const res = await fetch("/api/fa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ picks }) });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setRace(data);
    setStage(4);
  }

  const toggle = (id: string) =>
    setPicks((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < run.fa.budget ? [...p, id] : p));

  return (
    <main>
      <header className="bar">
        <span className="brand">N<b>+</b>1 Labs</span>
        <span className={`badge ${run.mode}`}>{run.mode}. Synthetic data</span>
      </header>

      <section className="hero">
        <p className="eyebrow">Closeout by N+1 Labs</p>
        <h1>The MIL says Material. The parts are fine.</h1>
        <p className="lede">Closeout solves complex factory failures, physical or firmware, and closes each one only when the next build proves the fix.</p>
        <ol className="line" aria-label="Production line">
          {run.line.map((s) => (
            <li key={s.id} className={stage >= 1 && s.id === item.station ? "hot" : ""}>
              <span>{s.id}</span>{s.name}
            </li>
          ))}
        </ol>
        <div className="kinds">
          <div><p className="eyebrow">Physical</p><p>A light guide sits out of position. FA finds it. A process change closes it.</p></div>
          <div><p className="eyebrow">Firmware</p><p>A calibration write gets dropped. An agent patches the code. A held-out build proves it.</p></div>
          <div><p className="eyebrow">Both</p><p>A slower part meets a cold start. Firmware assumes it is ready. No single team owns the miss.</p></div>
        </div>
      </section>

      <Step n="01 Lock" title="The twin commits first." line="Its top failures are hashed before the build runs.">
        <ol className="rank">{run.prediction.top.map((c) => <li key={c}>{hyp[c]?.label ?? c}</li>)}</ol>
        <p className="hash">SHA-256 {run.prediction.sha256}</p>
        {stage === 0 && <button onClick={reveal}>Run build {run.build}</button>}
      </Step>

      {stage >= 1 && (
        <Step n="02 Reveal" title={`${run.score.hit_at_3} of ${run.score.of}. It missed the one that hurt most.`}>
          <p className="check">{verified ? "Hash verified in your browser." : "Hash mismatch."}</p>
          <div className="pareto">
            {run.actual_pareto.map((p) => {
              const hit = run.prediction.top.includes(p.class);
              return (
                <div key={p.class} className="row">
                  <span>{hyp[p.class]?.label}</span>
                  <i style={{ width: `${(p.units / run.units.length) * 100}%`, background: COLORS[p.class] }} />
                  <em>{p.units} {hit ? "predicted" : "missed"}</em>
                </div>
              );
            })}
          </div>
          <p className="note">Chance on {run.score.K} classes is {run.score.chance_rate} of {run.score.of}. Twin covers {pct(run.addressable_share)} of these units.</p>
          {stage === 1 && <button onClick={() => setStage(2)}>Fill the MIL</button>}
        </Step>
      )}

      {stage >= 2 && (
        <Step n="03 MIL" title={`${run.subq_call.units} questions. One call.`} line={`SubQ Snap read every failed unit in ${run.subq_call.seconds} seconds.`}>
          <div className="wall" aria-label="SubQ scores by unit">
            {run.units.map((u, i) => {
              const [h, p] = top(u.subq);
              return <b key={u.id} title={`${u.id} ${hyp[h].label} ${pct(p)}`} style={{ background: i < wall ? COLORS[h] : "var(--bg-3)", opacity: i < wall ? 0.3 + p * 0.7 : 1 }} />;
            })}
          </div>
          <div className="legend">{run.hypotheses.map((h) => <span key={h.id}><i style={{ background: COLORS[h.id] }} />{h.label}</span>)}</div>
          <table className="mil">
            <thead><tr><th>ID</th><th>Failure</th><th>Station</th><th>Fail / tested</th><th>Rate</th><th>Category</th><th>Root cause</th><th>Status</th></tr></thead>
            <tbody><tr>
              <td>{item.id}</td><td>{item.failure_name}</td><td>{item.station}</td>
              <td>{item.units_failed} / {item.units_tested}</td><td>{pct(item.failure_rate, 1)}</td>
              <td className={flipped ? "flip" : ""}>{flipped ? history.to : history.from}</td>
              <td>{flipped ? "Confirmed" : "Suspected"}</td><td>{closed ? "Closed" : "Open"}</td>
            </tr></tbody>
          </table>
          <p className="note">Real SubQ call on seeded logs built to overlap. Top choice matched the seeded cause on {pct(run.subq_call.top_choice_accuracy)} of units. That is why FA still decides.</p>
          {stage === 2 && <button onClick={() => setStage(3)}>Open the FA queue</button>}
        </Step>
      )}

      {stage >= 3 && (
        <Step n="04 FA" title={`${run.fa.budget} units. You pick. SubQ picks.`} line="FA time is the scarce thing. Spend it.">
          <div className="units">
            {run.units.map((u) => (
              <button key={u.id} disabled={!!race} className={picks.includes(u.id) ? "unit on" : race?.subq_picks.includes(u.id) ? "unit sq" : "unit"} onClick={() => toggle(u.id)}>
                <strong>{u.id}</strong>
                <span>Lot {u.lot} F{u.fixture} H{u.hour_of_shift}</span>
                <span>{u.temp_c}C</span>
              </button>
            ))}
          </div>
          {!race && <button onClick={send} disabled={picks.length !== run.fa.budget}>Send {picks.length} of {run.fa.budget} to FA</button>}
          {error && <p className="check">{error}</p>}
          {race && (
            <div className="race">
              {([["You", race.you], ["SubQ", race.subq]] as const).map(([name, r]) => (
                <div key={name}>
                  <p className="eyebrow">{name}</p>
                  <p className="big">{pct(r.coverage)}</p>
                  <p className="note">of failed units explained by causes found</p>
                  {r.results.map((f) => <p key={f.id} className="finding"><b style={{ background: COLORS[f.hypothesis] }} />{f.id} {hyp[f.hypothesis].label}</p>)}
                </div>
              ))}
              <p className="note wide">Same budget. Random picks average {pct(race.baselines.random)}. Worst uniformity first gets {pct(race.baselines.worst_first)}.</p>
            </div>
          )}
        </Step>
      )}

      {stage >= 4 && (
        <Step n="05 Truth" title="The parts were fine." line={history.reason}>
          <div className="rings"><Ring dim /><span>Cold</span><Ring dim={false} /><span>Warm</span></div>
          <p className="note">Category moved from {history.from} to {history.to}. Root cause confirmed by FA, never by a model.</p>
          {stage === 4 && <button onClick={() => setStage(5)}>Change the twin</button>}
        </Step>
      )}

      {stage >= 5 && (
        <Step n="06 Gate" title="A perfect score on the last build means nothing." line="Muse writes the change. Gemini attacks it. A build it never saw decides.">
          {run.changes.slice(0, gate + 1).map((c) => (
            <article key={c.id} className={`change ${c.decision}`}>
              <h3>Change {c.id}. {c.summary}</h3>
              <pre>{c.diff}</pre>
              <dl>
                <div><dt>Build N</dt><dd>{c.build_n_score}</dd></div>
                <div><dt>Held out</dt><dd>{c.heldout_score}</dd></div>
                <div><dt>Decision</dt><dd>{c.decision}</dd></div>
              </dl>
              <p className="note">Gemini. {c.gemini}</p>
            </article>
          ))}
          {run.mode === "fixture" && <p className="note">Fixture. Scores are computed on seeded builds. Change text and the Gemini note are placeholders until the engine run lands.</p>}
          {gate < 2 && <button onClick={() => setGate(gate + 1)}>{gate === 0 ? "Try the next change" : "Close the item"}</button>}
        </Step>
      )}

      {closed && (
        <Step n="07 Closed" title={`${item.id} closed.`} line="Firmware. Confirmed by FA. Held on a build it never saw.">
          <p className="law">Close it on the next build.</p>
          <p className="note">All data here is synthetic and seeded. This shows the loop, not the physics. Station names are placeholders.</p>
        </Step>
      )}
    </main>
  );
}
