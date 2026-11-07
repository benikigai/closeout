"use client";

/* Judge-driven stage (integrator wiring). Buttons move one shared state:
   inject cold fault -> patch firmware -> try the cheat (blocked).
   Design lane owns placement and styling of this section. */
import { useState } from "react";
import BeaconExploded from "./BeaconExploded";
import TimingRace from "./TimingRace";
import PopulationWall from "./PopulationWall";
import run from "@/data/run.json";

export default function DemoStage() {
  const [phase, setPhase] = useState<"cold" | "fixed" | "cheat">("cold");
  const fixed = phase === "fixed";
  return (
    <section aria-label="Judge driven beacon demo">
      <h2>Drive it yourself.</h2>
      <p>One fictional beacon. One cold morning on its line. Three buttons run the whole story.</p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button onClick={() => setPhase("cold")} aria-pressed={phase === "cold"}>1. Inject cold fault</button>
        <button onClick={() => setPhase("fixed")} aria-pressed={fixed}>2. Apply firmware patch</button>
        <button onClick={() => setPhase("cheat")} aria-pressed={phase === "cheat"}>3. Try the cheat fix</button>
      </div>
      {phase === "cheat" && (
        <p role="alert"><strong>Blocked.</strong> Widening the limit would pass known-bad unit U-07010. The item stays open. (Atlas gate, Task 4 record.)</p>
      )}
      <BeaconExploded fixed={fixed} onToggle={() => setPhase(fixed ? "cold" : "fixed")} />
      <TimingRace fixed={fixed} />
      <PopulationWall units={run.units as { id: string; subq: Record<string, number> }[]} />
    </section>
  );
}
