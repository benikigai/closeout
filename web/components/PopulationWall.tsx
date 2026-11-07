"use client";

/* Population wall: one tile per failed unit, shaded by its top SubQ score.
   Data comes from run.json units (seeded fixture, labeled on the page). */
type Unit = { id: string; subq: Record<string, number> };

export default function PopulationWall({ units }: { units: Unit[] }) {
  return (
    <div aria-label="Failed unit population by SubQ score">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(16, 1fr)", gap: 3 }}>
        {units.map((u) => {
          const top = Math.max(...Object.values(u.subq ?? { x: 0 }));
          return <span key={u.id} title={`${u.id} top score ${top.toFixed(2)}`}
            style={{ aspectRatio: "1", background: "#ffc65c", opacity: 0.25 + top * 0.75, borderRadius: 2 }} />;
        })}
      </div>
      <p>{units.length} failed units. One SubQ call scored every unit. Bright tiles hold a strong cause. Dim tiles stay open.</p>
    </div>
  );
}
