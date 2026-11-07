'use client';

/* Closeout 60-second tour. Every frame is a pure function of t (seconds).
   Play: /tour (real time). Capture: /tour?capture=1 exposes window.__tourSetT(t)
   so a recorder can step exact frames. Numbers come from TourData, which the
   server page reads from the repo data and from the compiled firmware. */
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import TourBeacon from './TourBeacon';
import { clamp, easeInOut, easeOut, fade, lerp, pop, seg, typed } from './motion';

export const DURATION = 60;
export const FPS = 30;

type Unit = { cal_applied: number; uniformity: number; result: 'pass' | 'fail' };
type Cell = { kind: 'cold' | 'warm' | 'defect'; before: 'pass' | 'fail'; fixed: 'pass' | 'fail' };
export type TourData = {
  mil: { id: string; failure: string; station: string; stationName: string; failed: number; tested: number; firstCategory: string; finalCategory: string; reroute: string; findings: string[] };
  theories: { label: string; category: string }[];
  subq: { model: string; units: number; seconds: number };
  wall: { id: string; top: string; score: number; picked: boolean }[];
  tops: { id: string; label: string; count: number }[];
  budget: number;
  pickLabels: string[];
  timing: { writeMs: number; coldReadyMs: number; warmReadyMs: number };
  code: { before: string[]; fixed: string[] };
  coldUnit: { before: Unit; fixed: Unit };
  limit: number; cheatLimit: number; defectFixed: Unit;
  verifier: { verdict: string; claim: string; evidence: { kind: string; text: string }[] };
  heldout: {
    rows: { seed: number; cells: Cell[] }[];
    stats: { scenarios: number; units: number; seedFirst: number; seedLast: number; cold: number; coldBefore: number; coldAfter: number; defects: number; defectsStillFail: number; warmRegressions: number; passed: boolean };
  };
};

type TourWindow = Window & { __tourSetT?: (t: number) => void; __tourReady?: boolean; __tourDone?: boolean; __tourStart?: number; __tourDuration?: number; __tourFps?: number };

const C = { bg: '#101316', ink: '#f0eee7', muted: '#a5adb3', soft: '#6e7b85', line: '#30373d', panel: '#171c20', accent: '#edc577', green: '#acd5b7', red: '#f49283', blue: '#7fa9d6' };
const HUE: Record<string, string> = { firmware_timing: C.accent, assembly_guide: '#8e9eac', fixture_contact: '#6f93b8', material_led: '#c08f6c' };

type Kind = 'compiled' | 'recorded' | 'synthetic';
const CHAPTERS: { a: number; b: number; eyebrow: string; tag: string; kind: Kind }[] = [
  { a: 4, b: 9, eyebrow: 'THE PROBLEM LIST', tag: 'Seeded line data', kind: 'synthetic' },
  { a: 12, b: 19, eyebrow: '01  TRIAGE', tag: 'Recorded SubQ call · seeded units', kind: 'recorded' },
  { a: 19, b: 26, eyebrow: '02  TEARDOWN', tag: 'Seeded FA findings', kind: 'synthetic' },
  { a: 26, b: 34, eyebrow: '03  ROOT CAUSE', tag: 'Simulated timing · fictional part', kind: 'synthetic' },
  { a: 34, b: 40, eyebrow: '04  FIX', tag: 'Compiled C · simulated unit', kind: 'compiled' },
  { a: 40, b: 45, eyebrow: '05  SHORTCUT', tag: 'Compiled C · simulated unit', kind: 'compiled' },
  { a: 45, b: 49, eyebrow: '06  DOUBT', tag: 'Recorded Gemini call · Nov 7', kind: 'recorded' },
  { a: 49, b: 55, eyebrow: '07  PROOF', tag: 'Compiled C · simulated units', kind: 'compiled' },
];
const DOT: Record<Kind, string> = { compiled: C.green, recorded: C.accent, synthetic: C.soft };

/* ---------- primitives ---------- */

function Words({ text, t, at, stagger = 0.045, dur = 0.5, style }: { text: string; t: number; at: number; stagger?: number; dur?: number; style?: CSSProperties }) {
  const words = text.split(' ');
  return (
    <span style={style}>
      {words.map((w, i) => {
        const p = easeOut(seg(t, at + i * stagger, at + i * stagger + dur));
        return <span key={i}><span className="w" style={{ opacity: p, transform: `translateY(${(1 - p) * 0.32}em)` }}>{w}</span>{i < words.length - 1 ? ' ' : ''}</span>;
      })}
    </span>
  );
}

function Abs({ x, y, w, children, style }: { x: number; y: number; w?: number; children: ReactNode; style?: CSSProperties }) {
  return <div style={{ position: 'absolute', left: x, top: y, width: w, ...style }}>{children}</div>;
}

const DOME = 'M62 178C62 84 104 42 160 42s98 42 98 136Z';
function Dome({ uid, lit = 1, fixed = 0 }: { uid: string; lit?: number; fixed?: number }) {
  const cold = lit * (1 - fixed), even = lit * fixed;
  return (
    <svg viewBox="0 0 320 240" style={{ width: '100%', display: 'block', overflow: 'visible' }} aria-hidden>
      <defs>
        <radialGradient id={`${uid}-c`} cx="24%" cy="34%" r="72%"><stop offset="0%" stopColor="#ffe2a0" /><stop offset="100%" stopColor="#3a2d22" /></radialGradient>
        <radialGradient id={`${uid}-f`} cx="50%" cy="34%" r="72%"><stop offset="0%" stopColor="#c9f7d6" /><stop offset="100%" stopColor="#3f6f54" /></radialGradient>
        <filter id={`${uid}-g`} x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="22" /></filter>
      </defs>
      <ellipse cx="130" cy="112" rx="104" ry="86" fill="#e0b978" opacity={0.24 * cold} filter={`url(#${uid}-g)`} />
      <ellipse cx="160" cy="112" rx="116" ry="90" fill="#8dc9a2" opacity={0.22 * even} filter={`url(#${uid}-g)`} />
      <ellipse cx="160" cy="206" rx="108" ry="14" fill="#000" opacity=".4" />
      <path d={DOME} fill="#1b1f23" stroke="#3a4046" strokeWidth="1.5" />
      <path d={DOME} fill={`url(#${uid}-c)`} opacity={cold} stroke="#e0b978" strokeWidth="1.5" />
      <path d={DOME} fill={`url(#${uid}-f)`} opacity={even} stroke="#8dc9a2" strokeWidth="1.5" />
      <path d="M62 178h196v18q-98 22-196 0Z" fill="#23282d" stroke="#596069" />
      <path d="M90 116q16-44 46-52" fill="none" stroke="#fff" opacity={0.08 + 0.16 * lit} strokeWidth="10" strokeLinecap="round" />
      <path d="M188 50q66 57 59 120h-43q10-61-16-120" fill="#14181c" opacity={0.62 * cold} />
    </svg>
  );
}

const Mono = ({ children, size = 16, color = C.soft, style }: { children: ReactNode; size?: number; color?: string; style?: CSSProperties }) =>
  <span className="mono" style={{ fontSize: size, color, ...style }}>{children}</span>;

/* ---------- scenes ---------- */

function ColdOpen({ t, d }: { t: number; d: TourData }) {
  if (t > 4.05) return null;
  const o = 1 - seg(t, 3.7, 4.0);
  const lit = easeOut(seg(t, 0.45, 1.6));
  const s = lerp(0.95, 1.03, easeInOut(seg(t, 0, 4)));
  const label = `${d.mil.station} ${d.mil.stationName.toUpperCase()} TEST · ${d.mil.failure.toUpperCase()} · FAIL`;
  return (
    <div className="scene" style={{ opacity: o }}>
      <Abs x={960 - 360} y={110} w={720} style={{ transform: `scale(${s})`, transformOrigin: '50% 70%' }}><Dome uid="open" lit={lit} /></Abs>
      <Abs x={0} y={700} w={1920} style={{ textAlign: 'center' }}><Mono size={18} color={C.red}>{typed(label, t, 1.25, 48)}</Mono></Abs>
      <Abs x={0} y={752} w={1920} style={{ textAlign: 'center' }}><h1 className="hl"><Words text="The first units of the day fail." t={t} at={1.85} /></h1></Abs>
    </div>
  );
}

function MilScene({ t, d }: { t: number; d: TourData }) {
  if (t < 3.95 || t > 9.05) return null;
  const m = d.mil;
  const cols: [string, string, number][] = [
    ['ID', m.id, 190], ['FAILURE', m.failure, 520], ['STATION', `${m.station} ${m.stationName}`, 290],
    ['FAILED', `${m.failed} of ${m.tested.toLocaleString('en-US')}`, 330], ['CATEGORY', '', 300],
  ];
  const cat = pop(seg(t, 5.55, 5.95));
  return (
    <div className="scene" style={{ opacity: fade(t, 4, 9, 0.3, 0.3) }}>
      <Abs x={120} y={170}><h2 className="hl"><Words text="Three teams." t={t} at={6.05} /><br /><Words text="Three theories." t={t} at={6.35} style={{ color: C.muted }} /></h2></Abs>
      <Abs x={120} y={420} w={1680} style={{ opacity: easeOut(seg(t, 4.1, 4.5)) }}>
        <div className="row-card">
          {cols.map(([k, v, w], i) => (
            <div key={k} style={{ width: w }}>
              <Mono size={16}>{k}</Mono>
              {k === 'CATEGORY'
                ? <div className="pill" style={{ opacity: clamp(cat), transform: `scale(${cat})` }}>{m.firstCategory}</div>
                : <div className="cell-v">{typed(v, t, 4.35 + i * 0.3, 42)}</div>}
            </div>
          ))}
        </div>
      </Abs>
      <Abs x={120} y={650} w={1680} style={{ display: 'flex', gap: 30 }}>
        {d.theories.map((h, i) => {
          const p = easeOut(seg(t, 6.6 + i * 0.22, 7.1 + i * 0.22));
          return (
            <div key={h.label} className="chip" style={{ opacity: p, transform: `translateY(${(1 - p) * 24}px)` }}>
              <Mono size={16} color={C.accent}>{h.category.toUpperCase()} SAYS</Mono>
              <div className="chip-t">{h.label}?</div>
            </div>
          );
        })}
      </Abs>
    </div>
  );
}

function TitleScene({ t }: { t: number }) {
  if (t < 8.95 || t > 12.05) return null;
  const p = easeOut(seg(t, 9.1, 9.9));
  const dot = pop(seg(t, 9.75, 10.2));
  return (
    <div className="scene" style={{ opacity: fade(t, 9, 12, 0.2, 0.3) }}>
      <Abs x={0} y={300} w={1920} style={{ textAlign: 'center' }}>
        <div className="mark" style={{ opacity: p, transform: `translateY(${(1 - p) * 30}px)`, letterSpacing: `${lerp(0.02, -0.055, p)}em` }}>
          closeout<span style={{ display: 'inline-block', transform: `scale(${dot})`, opacity: clamp(dot) }}>.</span>
        </div>
      </Abs>
      <Abs x={0} y={600} w={1920} style={{ textAlign: 'center' }}>
        <div className="tag-l"><Words text="Failure in." t={t} at={10.2} /> <Words text="Proven fix out." t={t} at={10.45} style={{ color: C.muted }} /></div>
      </Abs>
      <Abs x={0} y={720} w={1920} style={{ textAlign: 'center', opacity: easeOut(seg(t, 10.9, 11.3)) }}><Mono size={17} style={{ letterSpacing: '0.18em' }}>FACTORY FAILURE ANALYSIS · CLOSED WITH PROOF</Mono></Abs>
    </div>
  );
}

const COLS = 16, TILE = 44, GAP = 8, WX = 964, WY = 262;
const TRAY = { x: 120, y: 560, size: 92, gap: 20 };
function WallScene({ t, d }: { t: number; d: TourData }) {
  if (t < 11.95 || t > 26.05) return null;
  const a = 1 - seg(t, 18.55, 18.95);           // phase A text
  const pickedOrder = d.pickLabels;
  const sweep = easeOut(seg(t, 12.5, 14.1));
  const dim = lerp(1, 0.1, seg(t, 19.0, 19.6)) * (1 - seg(t, 22.4, 23.0));
  const rows = Math.ceil(d.wall.length / COLS);
  const reroute = t > 23.2;
  const strike = easeOut(seg(t, 23.9, 24.3));
  const fw = pop(seg(t, 24.35, 24.8));
  return (
    <div className="scene" style={{ opacity: fade(t, 12, 26, 0.3, 0.3) }}>
      {/* Phase A: triage */}
      {t < 19 && <>
        <Abs x={120} y={WY - 8} w={800} style={{ opacity: a }}>
          <h2 className="hl"><Words text="One call scores" t={t} at={12.3} /><br /><Words text="every failed unit." t={t} at={12.55} /></h2>
        </Abs>
        <Abs x={120} y={500} w={700} style={{ opacity: a }}>
          <p className="sub"><Words text="The scores split four ways. A score picks the next test. It never names the cause." t={t} at={15.7} stagger={0.03} /></p>
        </Abs>
        <Abs x={WX} y={WY - 52} style={{ opacity: a * easeOut(seg(t, 12.4, 12.7)) }}>
          <Mono size={19} color={C.muted}>{d.subq.model.toUpperCase()} · <b style={{ color: C.ink }}>{Math.round(d.subq.units * sweep)}</b> UNITS · 1 CALL · <b style={{ color: C.ink }}>{(d.subq.seconds * sweep).toFixed(2)} S</b></Mono>
        </Abs>
        <Abs x={WX} y={WY + rows * (TILE + GAP) + 26} w={830} style={{ opacity: a }}>
          <Mono size={16}>TOP-SCORED CAUSE, PER UNIT</Mono>
          {d.tops.map((h, i) => {
            const p = easeOut(seg(t, 14.9 + i * 0.15, 15.7 + i * 0.15));
            return (
              <div key={h.id} className="leg" style={{ opacity: easeOut(seg(t, 14.8 + i * 0.15, 15.1 + i * 0.15)) }}>
                <i style={{ background: HUE[h.id] }} />
                <span>{h.label}</span>
                <em><s style={{ width: `${(h.count / d.wall.length) * 100 * p * 2.2}%`, background: HUE[h.id] }} /></em>
                <b>{Math.round(h.count * p)}</b>
              </div>
            );
          })}
        </Abs>
      </>}

      {/* Phase B: teardown */}
      {t >= 18.9 && <>
        <Abs x={120} y={WY - 8} w={820}>
          <h2 className="hl"><Words text="Five teardowns." t={t} at={19.15} /><br /><Words text="The parts are fine." t={t} at={21.7} style={{ color: C.muted }} /></h2>
        </Abs>
        <Abs x={TRAY.x} y={TRAY.y - 40} style={{ opacity: easeOut(seg(t, 19.6, 19.9)) }}><Mono size={17} color={C.accent}>FA BUDGET · {d.budget} UNITS · PICKED TO SPLIT THE CAUSES</Mono></Abs>
        {pickedOrder.map((id, k) => {
          const on = easeOut(seg(t, 20.85 + k * 0.12, 21.15 + k * 0.12));
          return <Abs key={id} x={TRAY.x + k * (TRAY.size + TRAY.gap)} y={TRAY.y + TRAY.size + 10} w={TRAY.size} style={{ opacity: on, textAlign: 'center' }}><Mono size={16} color={C.muted}>{id}</Mono></Abs>;
        })}
        <Abs x={120} y={730} w={820}>
          {d.mil.findings.map((f, i) => {
            const at = 21.5 + i * 0.5;
            return (
              <div key={f} className="finding" style={{ opacity: easeOut(seg(t, at, at + 0.2)) }}>
                <Mono size={15} color={C.green}>OBSERVED</Mono><span>{typed(f, t, at, 55)}</span>
              </div>
            );
          })}
        </Abs>
        {reroute && (
          <Abs x={1080} y={300} w={720} style={{ opacity: easeOut(seg(t, 23.2, 23.5)) }}>
            <Mono size={17} color={C.muted}>OWNER CATEGORY</Mono>
            <div className="cat" style={{ color: C.muted, position: 'relative', display: 'inline-block', marginTop: 10 }}>
              {d.mil.firstCategory}
              <i className="strike" style={{ width: `${strike * 104}%` }} />
            </div>
            <div className="cat" style={{ color: C.accent, opacity: clamp(fw), transform: `scale(${fw})`, transformOrigin: 'left center' }}>{d.mil.finalCategory}</div>
            <div style={{ marginTop: 26, opacity: easeOut(seg(t, 24.9, 25.2)) }}><Mono size={17}>RE-ROUTED BY FA EVIDENCE, NOT BY A SCORE</Mono></div>
          </Abs>
        )}
      </>}

      {/* The wall, shared by both phases */}
      {d.wall.map((u, i) => {
        const cx = i % COLS, cy = Math.floor(i / COLS);
        const at = 12.5 + ((cx + cy) / (COLS - 1 + rows - 1)) * 1.6;
        const p = easeOut(seg(t, at, at + 0.35));
        let x = WX + cx * (TILE + GAP), y = WY + cy * (TILE + GAP), size = TILE * lerp(0.4, 1, p);
        let opacity = p * (0.35 + 0.65 * u.score);
        let ring = 0;
        const k = pickedOrder.indexOf(u.id);
        if (k >= 0) {
          ring = easeOut(seg(t, 19.1, 19.5));
          const f = easeInOut(seg(t, 19.8 + k * 0.12, 20.75 + k * 0.12));
          x = lerp(x, TRAY.x + k * (TRAY.size + TRAY.gap), f);
          y = lerp(y, TRAY.y, f);
          size = lerp(size, TRAY.size, f);
          opacity = lerp(opacity, 1, Math.max(ring, f));
        } else {
          opacity *= dim;
        }
        if (opacity < 0.01) return null;
        const off = k >= 0 ? 0 : (TILE - size) / 2;
        return <span key={u.id} className="tile" style={{ left: x + off, top: y + off, width: size, height: size, opacity, background: HUE[u.top], boxShadow: ring ? `0 0 0 ${3 * ring}px ${C.bg}, 0 0 0 ${5 * ring}px ${C.ink}` : undefined }} />;
      })}
    </div>
  );
}

function BugScene({ t, d }: { t: number; d: TourData }) {
  const visible = t > 25.6 && t < 34.4;
  const o = fade(t, 26, 34, 0.4, 0.3);
  const { writeMs, coldReadyMs, warmReadyMs } = d.timing;
  const ms = 200 * seg(t, 28.6, 31.6);
  const X = (v: number) => 30 + (v / 200) * 640;
  const write = pop(seg(t, 28.6 + (writeMs / 200) * 3, 28.95 + (writeMs / 200) * 3));
  const ready = pop(seg(t, 28.6 + (coldReadyMs / 200) * 3, 28.95 + (coldReadyMs / 200) * 3));
  const warm = easeOut(seg(t, 31.8, 32.2));
  return (
    <div className="scene" style={{ opacity: o, visibility: visible ? 'visible' : 'hidden' }}>
      <Abs x={40} y={20}>
        <TourBeacon visible={visible} width={1060} height={1040} readyMs={coldReadyMs}
          explode={lerp(0.12, 0.72, easeInOut(seg(t, 26.3, 28.8)))} angle={-0.45 + (t - 26) * 0.06} fixed={false} label={easeOut(seg(t, 28.9, 29.3))} />
      </Abs>
      {visible && <>
        <Abs x={1110} y={150} w={720}>
          <h2 className="hl" style={{ fontSize: 74 }}>
            <Words text="Firmware writes" t={t} at={26.5} /><br />
            <Words text={`at ${writeMs} ms.`} t={t} at={26.65} /><br />
            <Words text="The cold driver" t={t} at={31.2} style={{ color: C.muted }} /><br />
            <Words text={`wakes at ${coldReadyMs}.`} t={t} at={31.35} style={{ color: C.muted }} />
          </h2>
        </Abs>
        <Abs x={1100} y={560} w={720} style={{ opacity: easeOut(seg(t, 28.2, 28.6)) }}>
          <svg viewBox="0 0 720 230" width={720} height={230} aria-hidden>
            <line x1={X(0)} y1={120} x2={X(200)} y2={120} stroke={C.line} strokeWidth={3} />
            <line x1={X(0)} y1={120} x2={X(ms)} y2={120} stroke={C.ink} strokeWidth={3} />
            {[0, 50, 100, 150, 200].map((v) => <g key={v}><line x1={X(v)} y1={112} x2={X(v)} y2={128} stroke={C.soft} /><text x={X(v)} y={158} textAnchor="middle" fontSize={19} fill={C.soft} className="mono">{v} ms</text></g>)}
            <g opacity={warm}><circle cx={X(warmReadyMs)} cy={120} r={7} fill={C.green} /><text x={X(warmReadyMs)} y={196} textAnchor="middle" fontSize={19} fill={C.green} className="mono">warm ready</text></g>
            <g opacity={clamp(write)} transform={`translate(${X(writeMs)} 120) scale(${write || 0.001})`}>
              <circle r={11} fill={C.red} />
              <text y={-58} textAnchor="middle" fontSize={20} fill={C.ink} className="mono">calibration write</text>
              <text y={-30} textAnchor="middle" fontSize={20} fill={C.red} className="mono">DROPPED</text>
            </g>
            <g opacity={clamp(ready)}>
              <line x1={X(coldReadyMs)} y1={50} x2={X(coldReadyMs)} y2={140} stroke={C.blue} strokeWidth={3} strokeDasharray="7 6" />
              <text x={X(coldReadyMs) + 10} y={34} textAnchor="end" fontSize={20} fill={C.blue} className="mono">cold driver ready</text>
            </g>
          </svg>
        </Abs>
        <Abs x={1110} y={830} w={720}><Mono size={19} color={C.muted}>{typed(`Warm drivers are ready by ${warmReadyMs} ms, so warm units pass.`, t, 32.0, 60)}</Mono></Abs>
      </>}
    </div>
  );
}

function FixScene({ t, d }: { t: number; d: TourData }) {
  if (t < 33.95 || t > 40.05) return null;
  const removed = d.code.before, added = d.code.fixed;
  const flip = easeInOut(seg(t, 37.25, 38.0));
  const u = flip < 0.5 ? d.coldUnit.before : d.coldUnit.fixed;
  const ok = u.result === 'pass';
  return (
    <div className="scene" style={{ opacity: fade(t, 34, 40, 0.3, 0.3) }}>
      <Abs x={120} y={170}><h2 className="hl"><Words text="Muse patches the real C." t={t} at={34.25} /><br /><Words text="Then it runs." t={t} at={37.3} style={{ color: C.muted }} /></h2></Abs>
      <Abs x={120} y={430} w={1010} style={{ opacity: easeOut(seg(t, 34.5, 34.8)) }}>
        <div className="code">
          <Mono size={16}>firmware.c · fw_calibrate() · Muse engine snapshot</Mono>
          <pre>
            <span className="ctx">{'int fw_calibrate(void) {'}</span>
            {removed.map((l, i) => <span key={`r${i}`} className="del" style={{ opacity: easeOut(seg(t, 34.7 + i * 0.12, 35.0 + i * 0.12)) }}>{'-   ' + l}</span>)}
            {added.map((l, i) => {
              const at = 35.5 + i * 0.4;
              return <span key={`a${i}`} className="add" style={{ opacity: easeOut(seg(t, at, at + 0.15)) }}>{'+   ' + typed(l, t, at, 90)}</span>;
            })}
            <span className="ctx">{'}'}</span>
          </pre>
        </div>
      </Abs>
      <Abs x={1240} y={420} w={560} style={{ opacity: easeOut(seg(t, 34.6, 35.0)) }}>
        <Mono size={17}>COLD UNIT · DRIVER READY AT {d.timing.coldReadyMs} MS</Mono>
        <div style={{ width: 460, margin: '18px auto 0' }}><Dome uid="fix" fixed={flip} /></div>
        <div className="result" style={{ color: ok ? C.green : C.red }}>
          <span>uniformity {u.uniformity.toFixed(2)}</span><b>{ok ? 'PASS' : 'FAIL'}</b>
        </div>
        <Mono size={16}>{flip < 0.5 ? 'FIRMWARE v1' : 'PATCHED FIRMWARE'} · PASS BELOW {d.limit.toFixed(2)}</Mono>
      </Abs>
    </div>
  );
}

function CheatScene({ t, d }: { t: number; d: TourData }) {
  if (t < 39.95 || t > 45.05) return null;
  const X0 = 140, X1 = 1680, MAX = 0.3;
  const X = (v: number) => X0 + (v / MAX) * (X1 - X0);
  const v = lerp(d.limit, d.cheatLimit, easeInOut(seg(t, 40.9, 42.1)));
  const bad = d.defectFixed.uniformity;
  const escapes = v > bad;
  const stamp = easeOut(seg(t, 42.55, 42.85));
  const blocked = bad < d.cheatLimit;
  return (
    <div className="scene" style={{ opacity: fade(t, 40, 45, 0.3, 0.3) }}>
      <Abs x={120} y={170}><h2 className="hl"><Words text="Widen the limit?" t={t} at={40.25} /><br /><Words text={blocked ? 'Blocked.' : 'Allowed.'} t={t} at={42.75} style={{ color: C.red }} /></h2></Abs>
      {blocked && <Abs x={1080} y={190} style={{ opacity: stamp, transform: `rotate(-5deg) scale(${lerp(1.5, 1, stamp)})`, transformOrigin: 'center' }}>
        <div className="stamp">BLOCKED</div>
      </Abs>}
      <Abs x={0} y={500} w={1920} style={{ opacity: easeOut(seg(t, 40.4, 40.8)) }}>
        <svg viewBox="0 0 1920 260" width={1920} height={260} aria-hidden>
          <rect x={X0} y={128} width={X(v) - X0} height={16} fill={C.green} opacity={0.22} />
          <line x1={X0} y1={136} x2={X1} y2={136} stroke={C.line} strokeWidth={3} />
          {[0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3].map((k) => <g key={k}><line x1={X(k)} y1={128} x2={X(k)} y2={144} stroke={C.soft} /><text x={X(k)} y={178} textAnchor="middle" fontSize={19} fill={C.soft} className="mono">{k.toFixed(2)}</text></g>)}
          <text x={X0} y={230} fontSize={17} fill={C.soft} className="mono">DOME UNIFORMITY ERROR · LOWER IS BETTER · UNITS LEFT OF THE LIMIT PASS</text>
          <g transform={`translate(${X(v)} 0)`}>
            <line y1={34} y2={160} stroke={C.accent} strokeWidth={4} />
            <text x={14} y={50} fontSize={21} fill={C.accent} className="mono">pass limit {v.toFixed(2)}</text>
          </g>
          <g transform={`translate(${X(bad)} 136)`}>
            <circle r={13} fill={escapes ? C.accent : C.red} />
            <text x={-24} y={-52} textAnchor="end" fontSize={21} fill={C.ink} className="mono">known-bad dome · {bad.toFixed(2)}</text>
            <text x={-24} y={-22} textAnchor="end" fontSize={21} fill={escapes ? C.accent : C.red} className="mono">{escapes ? 'WOULD PASS' : 'FAILS'}</text>
          </g>
        </svg>
      </Abs>
      <Abs x={120} y={800} w={1600} style={{ opacity: easeOut(seg(t, 43.1, 43.4)) }}><p className="sub">Known-bad units must still fail, whatever the fix does to yield. The item stays open.</p></Abs>
    </div>
  );
}

function DoubtScene({ t, d }: { t: number; d: TourData }) {
  if (t < 44.95 || t > 49.05) return null;
  const v = pop(seg(t, 47.3, 47.7));
  const holds = d.verifier.verdict === 'holds';
  return (
    <div className="scene" style={{ opacity: fade(t, 45, 49, 0.3, 0.3) }}>
      <Abs x={120} y={170}><h2 className="hl"><Words text="A second model tries to break it." t={t} at={45.2} /><br /><Words text={holds ? 'It holds.' : 'It breaks.'} t={t} at={47.45} style={{ color: holds ? C.green : C.red }} /></h2></Abs>
      <Abs x={120} y={440} w={620} style={{ opacity: easeOut(seg(t, 45.4, 45.7)) }}>
        <div className="card dim">
          <Mono size={16}>FIXER · MUSE</Mono>
          <div className="card-t" style={{ color: C.soft }}>Its reasoning</div>
          {[92, 74, 86, 58, 80, 66].map((w, i) => <i key={i} className="redact" style={{ width: `${w}%` }} />)}
          <Mono size={16} color={C.muted}>HIDDEN FROM THE VERIFIER</Mono>
        </div>
      </Abs>
      <Abs x={800} y={440} w={1000} style={{ opacity: easeOut(seg(t, 45.5, 45.8)) }}>
        <div className="card">
          <Mono size={16} color={C.accent}>VERIFIER · GEMINI 4 ARGON · BLIND</Mono>
          <div className="card-k"><Mono size={15}>CLAIM</Mono><span>{typed(d.verifier.claim, t, 45.7, 70)}</span></div>
          <div className="card-k"><Mono size={15}>EVIDENCE</Mono>
            {d.verifier.evidence.map((e, i) => (
              <div key={i} className="ev" style={{ opacity: easeOut(seg(t, 46.1 + i * 0.3, 46.3 + i * 0.3)) }}>
                <Mono size={14} color={e.kind === 'observed' ? C.green : C.accent}>{e.kind.toUpperCase()}</Mono><span>{e.text}</span>
              </div>
            ))}
          </div>
          <div className="verdict" style={{ opacity: clamp(v), transform: `scale(${v || 0.001})` }}>
            <Mono size={15}>VERDICT</Mono><b style={{ color: holds ? C.green : C.red }}>{holds ? 'Holds' : d.verifier.verdict}</b>
          </div>
        </div>
      </Abs>
    </div>
  );
}

const CELL = 26, CGAP = 6, GX = 1210, GY = 250;
function ProofScene({ t, d }: { t: number; d: TourData }) {
  if (t < 48.95 || t > 55.05) return null;
  const s = d.heldout.stats;
  const after = (r: number) => seg(t, 50.9 + r * 0.075, 51.1 + r * 0.075);
  const flipped = t > 50.9 + d.heldout.rows.length * 0.075;
  const down = easeOut(seg(t, 52.5, 53.2));
  const stats: [ReactNode, string][] = [
    [<>{s.coldBefore} → <span style={{ color: C.green }}>{Math.round(lerp(s.coldBefore, s.coldAfter, down))}</span></>, `cold units failing (of ${s.cold})`],
    [<>{s.defectsStillFail} of {s.defects}</>, 'known-bad domes still fail'],
    [<>{s.warmRegressions}</>, 'warm units broken by the fix'],
  ];
  const stamp = easeOut(seg(t, 53.7, 54.0));
  return (
    <div className="scene" style={{ opacity: fade(t, 49, 55, 0.3, 0.3) }}>
      <Abs x={120} y={170} w={1000}><h2 className="hl"><Words text="Closed only when" t={t} at={49.2} /><br /><Words text="a fresh build holds." t={t} at={49.45} style={{ color: C.muted }} /></h2></Abs>
      <Abs x={120} y={470} w={1040} style={{ display: 'flex', gap: 60 }}>
        {stats.map(([k, label], i) => {
          const p = easeOut(seg(t, 52.3 + i * 0.22, 52.7 + i * 0.22));
          return <div key={label} className="stat" style={{ opacity: p, transform: `translateY(${(1 - p) * 20}px)` }}><strong>{k}</strong><span>{label}</span></div>;
        })}
      </Abs>
      <Abs x={120} y={700} style={{ opacity: stamp, transform: `scale(${lerp(1.25, 1, stamp)})`, transformOrigin: 'left center' }}>
        <div className="pass" style={{ borderColor: s.passed ? C.green : C.red, color: s.passed ? C.green : C.red }}>HELD-OUT BUILD · {s.passed ? 'PASS' : 'FAIL'}</div>
      </Abs>
      <Abs x={GX} y={GY - 50} style={{ opacity: easeOut(seg(t, 49.3, 49.6)) }}>
        <Mono size={17} color={C.muted}>{s.scenarios} HELD-OUT BUILDS · SEEDS {s.seedFirst}–{s.seedLast} · {s.units} UNITS</Mono>
      </Abs>
      {d.heldout.rows.map((row, r) => {
        const show = easeOut(seg(t, 49.35 + r * 0.04, 49.6 + r * 0.04));
        const f = after(r);
        return row.cells.map((c, k) => {
          const res = f > 0.5 ? c.fixed : c.before;
          const fill = res === 'fail' ? C.red : C.green;
          const op = c.kind === 'warm' ? 0.26 : 1;
          const pulse = c.kind === 'cold' ? 1 + Math.sin(Math.PI * f) * 0.25 : 1;
          return <span key={`${r}-${k}`} className="gc" style={{ left: GX + k * (CELL + CGAP), top: GY + r * (CELL + CGAP), opacity: show * op, background: fill, transform: `scale(${pulse})` }}>{c.kind === 'defect' && <i />}</span>;
        });
      })}
      <Abs x={GX} y={GY + d.heldout.rows.length * (CELL + CGAP) + 8} w={600} style={{ opacity: easeOut(seg(t, 49.6, 49.9)), display: 'flex', justifyContent: 'space-between' }}>
        <Mono size={17} color={C.accent}>{flipped ? 'PATCHED FIRMWARE' : 'FIRMWARE v1'}</Mono>
        <Mono size={15}><span style={{ color: C.red }}>■</span> fail  <span style={{ color: C.green }}>■</span> pass  ▪ physical defect</Mono>
      </Abs>
    </div>
  );
}

function EndScene({ t }: { t: number }) {
  if (t < 54.95) return null;
  const p = (a: number) => easeOut(seg(t, a, a + 0.45));
  const up = (a: number): CSSProperties => ({ opacity: p(a), transform: `translateY(${(1 - p(a)) * 22}px)` });
  return (
    <div className="scene" style={{ opacity: easeOut(seg(t, 55, 55.35)) }}>
      <Abs x={0} y={250} w={1920} style={{ textAlign: 'center', ...up(55.15) }}><div className="mark" style={{ fontSize: 150 }}>closeout<span>.</span></div></Abs>
      <Abs x={0} y={470} w={1920} style={{ textAlign: 'center', ...up(55.45) }}><div className="tag-l">Failure in. <span style={{ color: C.muted }}>Proven fix out.</span></div></Abs>
      <Abs x={0} y={600} w={1920} style={{ textAlign: 'center', ...up(55.9) }}><Mono size={26} color={C.ink}>closeout-web.vercel.app   ·   github.com/benikigai/closeout</Mono></Abs>
      <Abs x={0} y={700} w={1920} style={{ ...up(56.3), display: 'flex', justifyContent: 'center', gap: 14 }}>
        {['Subquadratic', 'Meta Model API', 'Google DeepMind', 'MongoDB Atlas'].map((n) => <span key={n} className="logo">{n}</span>)}
      </Abs>
      <Abs x={0} y={860} w={1920} style={{ textAlign: 'center', ...up(56.7) }}><Mono size={17}>AIE CODE SUMMIT HACKATHON · NOV 7, 2026 · FICTIONAL BEACON · SYNTHETIC DATA · COMPILED C</Mono></Abs>
    </div>
  );
}

function Chrome({ t }: { t: number }) {
  const ch = CHAPTERS.find((c) => t >= c.a && t < c.b);
  const chromeOn = (t > 0.9 && t < 8.85) || (t > 12.15 && t < 54.85) ? 1 : 0;
  const o = ch ? fade(t, ch.a, ch.b, 0.3, 0.25) : 0;
  const markOn = t >= 4 && t < 55 && !(t >= 9 && t < 12) ? fade(t, t < 12 ? 4 : 12, t < 12 ? 9 : 55, 0.3, 0.3) : 0;
  return (
    <>
      {ch && <Abs x={120} y={84} style={{ opacity: o }}><Mono size={18} color={C.accent} style={{ letterSpacing: '0.2em' }}>{ch.eyebrow}</Mono></Abs>}
      <Abs x={120} y={994} style={{ opacity: markOn }}><span className="mark" style={{ fontSize: 30 }}>closeout<span>.</span></span></Abs>
      <div className="truth" style={{ opacity: chromeOn * easeOut(seg(t, 0.9, 1.4)) }}>
        {ch && <div style={{ opacity: o }}><i style={{ background: DOT[ch.kind] }} />{ch.tag}</div>}
        <div className="fict">Fictional beacon · synthetic data</div>
      </div>
    </>
  );
}

export default function Tour({ data }: { data: TourData }) {
  const [t, setT] = useState(0);
  const [fit, setFit] = useState({ s: 1, x: 0, y: 0 });

  useEffect(() => {
    const w = window as TourWindow;
    const q = new URLSearchParams(location.search);
    const capture = q.has('capture');
    const from = clamp(Number(q.get('t') ?? 0) || 0, 0, DURATION);
    const resize = () => {
      const s = Math.min(innerWidth / 1920, innerHeight / 1080);
      setFit({ s, x: (innerWidth - 1920 * s) / 2, y: (innerHeight - 1080 * s) / 2 });
    };
    resize(); addEventListener('resize', resize);
    // Fresh flags for every mount, so a remount never reports the previous run as ready or done.
    w.__tourReady = false; w.__tourDone = false;
    w.__tourDuration = DURATION; w.__tourFps = FPS;
    w.__tourSetT = (x: number) => flushSync(() => setT(clamp(x, 0, DURATION)));
    let raf = 0, dead = false;
    document.fonts.ready
      .then(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))))
      .then(() => {
        if (dead) return;
        w.__tourSetT?.(from);
        w.__tourReady = true;
        if (capture) return;
        const t0 = performance.now() - from * 1000;
        w.__tourStart = performance.now();
        const loop = (now: number) => {
          const x = (now - t0) / 1000;
          if (x >= DURATION) { setT(DURATION); w.__tourDone = true; return; }
          setT(x); raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      });
    return () => {
      dead = true; cancelAnimationFrame(raf); removeEventListener('resize', resize);
      delete w.__tourSetT; delete w.__tourReady; delete w.__tourDone; delete w.__tourStart;
      delete w.__tourDuration; delete w.__tourFps;
    };
  }, []);

  return (
    <div className="tour">
      <div className="stage" style={{ transform: `translate(${fit.x}px, ${fit.y}px) scale(${fit.s})` }}>
        <ColdOpen t={t} d={data} />
        <MilScene t={t} d={data} />
        <TitleScene t={t} />
        <WallScene t={t} d={data} />
        <BugScene t={t} d={data} />
        <FixScene t={t} d={data} />
        <CheatScene t={t} d={data} />
        <DoubtScene t={t} d={data} />
        <ProofScene t={t} d={data} />
        <EndScene t={t} />
        <Chrome t={t} />
      </div>
    </div>
  );
}
