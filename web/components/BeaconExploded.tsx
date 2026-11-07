"use client";

/* Exploded view of the fictional beacon. Procedural three.js, no CAD files.
   State comes from the measured demo payload: cold = calibration dropped
   (one dome sector dim), fixed = uniform dome. Integrator owns this file's
   data wiring; UI styling passes happen in the design lane. */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

type Layer = { mesh: THREE.Mesh; y0: number; dy: number; label: string };

export default function BeaconExploded({ fixed: fixedProp, onToggle }: { fixed?: boolean; onToggle?: () => void } = {}) {
  const mount = useRef<HTMLDivElement>(null);
  const layers = useRef<Layer[]>([]);
  const leds = useRef<THREE.MeshStandardMaterial[]>([]);
  const [explode, setExplode] = useState(0.65);
  const [internalFixed, setInternalFixed] = useState(false);
  const fixed = fixedProp ?? internalFixed;
  const setFixed = (v: boolean) => { if (onToggle) onToggle(); else setInternalFixed(v); };
  const explodeRef = useRef(explode);
  explodeRef.current = explode;
  const fixedRef = useRef(fixed);
  fixedRef.current = fixed;

  useEffect(() => {
    if (!mount.current) return;
    const w = mount.current.clientWidth, h = 420;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    mount.current.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 100);
    camera.position.set(4.2, 3.2, 5.2);
    camera.lookAt(0, 0.6, 0);
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xfff2d9, 1.6);
    key.position.set(4, 6, 3);
    scene.add(key);
    const group = new THREE.Group();
    scene.add(group);
    layers.current = []; leds.current = [];
    const add = (mesh: THREE.Mesh, dy: number, label: string) => {
      mesh.position.y += 0; group.add(mesh);
      layers.current.push({ mesh, y0: mesh.position.y, dy, label });
      return mesh;
    };
    const mat = (c: number, r = 0.5, m = 0.1) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
    // base shell
    add(new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.6, 0.35, 48), mat(0x2b2f36, 0.6)), 0, "shell");
    // battery
    const bat = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.28, 40), mat(0x8a6d2f, 0.35, 0.6));
    bat.position.y = 0.32; add(bat, 0.7, "battery");
    // main PCBA
    const pcb = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.1, 48), mat(0x14532d, 0.45, 0.2));
    pcb.position.y = 0.55; add(pcb, 1.4, "pcba");
    const chip = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.55), mat(0x111318, 0.4, 0.3));
    chip.position.y = 0.66; add(chip, 1.55, "chip");
    // LED board: 12 segments in a ring
    const ledY = 0.72;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const lm = new THREE.MeshStandardMaterial({ color: 0x332a12, emissive: 0xffc65c, emissiveIntensity: 1.4, roughness: 0.4 });
      const seg = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.09, 0.2), lm);
      seg.position.set(1.08 * Math.cos(a), ledY, 1.08 * Math.sin(a));
      seg.rotation.y = -a;
      group.add(seg);
      layers.current.push({ mesh: seg, y0: ledY, dy: 2.2, label: `led${i}` });
      leds.current.push(lm);
    }
    // diffuser dome (translucent) + touch cap
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(1.42, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshPhysicalMaterial({ color: 0xf5ead2, roughness: 0.35, transmission: 0.55, thickness: 0.6, transparent: true, opacity: 0.85 }));
    dome.position.y = 0.78; dome.scale.y = 0.62; add(dome, 3.1, "dome");
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.08, 32), mat(0xd8d2c4, 0.35));
    cap.position.y = 1.68; add(cap, 3.9, "cap");

    let raf = 0, t = 0;
    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      t += calm ? 0 : 0.0035;
      group.rotation.y = t;
      const e = explodeRef.current, fx = fixedRef.current;
      for (const l of layers.current) l.mesh.position.y = l.y0 + l.dy * e;
      leds.current.forEach((lm, i) => {
        const dimSector = i >= 3 && i <= 7;
        lm.emissiveIntensity = fx || !dimSector ? 1.5 : 0.12;
        lm.emissive.setHex(fx || !dimSector ? 0xffc65c : 0x7a2d16);
      });
      renderer.render(scene, camera);
    };
    loop();
    return () => { cancelAnimationFrame(raf); renderer.dispose(); mount.current?.removeChild(renderer.domElement); };
  }, []);

  return (
    <section aria-label="Exploded beacon view">
      <div ref={mount} style={{ width: "100%", height: 420 }} />
      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <label>Explode <input type="range" min={0} max={1} step={0.01} value={explode} onChange={(e) => setExplode(+e.target.value)} aria-label="Explode layers" /></label>
        <button onClick={() => setFixed(!fixed)} aria-pressed={fixed}>{fixed ? "Fixed firmware: uniform dome" : "Cold fault: one sector dim"}</button>
      </div>
      <p>{fixed
        ? "Fixed: firmware waits for the LED driver, writes calibration, reads it back. Dome uniform. Known-bad units still fail."
        : "Cold fault: the driver needs 180 ms, firmware writes at 50 ms. Calibration drops. One sector stays dim. The parts test fine."}</p>
    </section>
  );
}
