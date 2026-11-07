"use client";

/* Exploded CAD-style view of the fictional beacon. Procedural three.js, no CAD files.
   Same props as before: fixed = calibrated dome, cold = one LED sector dim.
   Parts carry their station ID from contracts/CONTRACTS.md. Part numbers are fictional. */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

type Part = { id: string; station: string; name: string; spec: string; group: THREE.Object3D; y0: number; dy: number };

const BOM = [
  { id: "cap", station: "S1-shell", name: "Touch cap", spec: "BC-110 · PC, soft-touch" },
  { id: "dome", station: "S6-dome-bond", name: "Dome", spec: "BC-160 · frosted PC, 1.2 mm" },
  { id: "diffuser", station: "S6-dome-bond", name: "Diffuser ring", spec: "BC-161 · opal PMMA" },
  { id: "ledring", station: "S7-flash-cal", name: "LED ring", spec: "BC-170 · 12 RGB LEDs + driver" },
  { id: "screws", station: "S3-screws", name: "Screws ×4", spec: "BC-130 · M2×5 PT" },
  { id: "pcba", station: "S2-pcba", name: "Main PCBA", spec: "BC-120 · SoC, IMU, mics" },
  { id: "audio", station: "S4-speaker-haptic", name: "Speaker + haptic", spec: "BC-140 · 20 mm, ERM" },
  { id: "battery", station: "S5-battery", name: "Battery", spec: "BC-150 · Li-po 1200 mAh" },
  { id: "base", station: "S1-shell", name: "Base housing", spec: "BC-111 · PC/ABS" },
];

function lathe(points: [number, number][], segments = 96) {
  return new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), segments);
}

export default function BeaconExploded({ fixed: fixedProp, onToggle }: { fixed?: boolean; onToggle?: () => void } = {}) {
  const mount = useRef<HTMLDivElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const [explode, setExplode] = useState(0.7);
  const [internalFixed, setInternalFixed] = useState(false);
  const fixed = fixedProp ?? internalFixed;
  const setFixed = (v: boolean) => { if (onToggle) onToggle(); else setInternalFixed(v); };
  const explodeRef = useRef(explode); explodeRef.current = explode;
  const fixedRef = useRef(fixed); fixedRef.current = fixed;

  useEffect(() => {
    const host = mount.current, labelHost = labels.current;
    if (!host || !labelHost) return;
    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = host.clientWidth, h = host.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;

    const camera = new THREE.PerspectiveCamera(32, w / h, 0.1, 100);
    camera.position.set(8.2, 5.6, 9.8);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 2.75, 0);
    controls.enableDamping = true; controls.enableZoom = false; controls.enablePan = false;
    controls.minPolarAngle = 0.5; controls.maxPolarAngle = 1.45;
    controls.autoRotate = !calm; controls.autoRotateSpeed = 0.6;

    const key = new THREE.DirectionalLight(0xfff4e0, 1.1); key.position.set(5, 9, 4); scene.add(key);
    const rim = new THREE.DirectionalLight(0x9fc4ff, 0.5); rim.position.set(-6, 4, -5); scene.add(rim);

    // Contact shadow
    const shadowCanvas = document.createElement("canvas"); shadowCanvas.width = shadowCanvas.height = 128;
    const sc = shadowCanvas.getContext("2d")!;
    const grad = sc.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, "rgba(0,0,0,0.55)"); grad.addColorStop(1, "rgba(0,0,0,0)");
    sc.fillStyle = grad; sc.fillRect(0, 0, 128, 128);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = -0.01; scene.add(shadow);

    const plastic = (c: number, r = 0.55) => new THREE.MeshPhysicalMaterial({ color: c, roughness: r, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.6 });
    const metal = (c: number, r = 0.3) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 1 });

    const root = new THREE.Group(); scene.add(root);
    const parts: Part[] = [];
    const part = (id: string, y0: number, dy: number, build: (g: THREE.Group) => void) => {
      const g = new THREE.Group(); build(g); g.position.y = y0; root.add(g);
      const b = BOM.find((p) => p.id === id)!;
      parts.push({ ...b, group: g, y0, dy });
    };

    // Base housing: lathe profile with a lip, plus four screw bosses inside.
    part("base", 0, 0, (g) => {
      g.add(new THREE.Mesh(lathe([[0, 0], [1.48, 0], [1.62, 0.12], [1.66, 0.62], [1.56, 0.66], [1.52, 0.2], [0, 0.2]]), plastic(0x2a2e33, 0.62)));
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + (i * Math.PI) / 2;
        const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.42, 20), plastic(0x2a2e33, 0.62));
        boss.position.set(1.22 * Math.cos(a), 0.4, 1.22 * Math.sin(a)); g.add(boss);
      }
      const port = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.14, 0.1, 3, 0.05), metal(0x9aa0a6, 0.35));
      port.position.set(0, 0.36, 1.63); g.add(port);
    });

    // Battery: rounded pouch with a label.
    part("battery", 0.24, 0.55, (g) => {
      const cell = new THREE.Mesh(new RoundedBoxGeometry(1.7, 0.22, 1.15, 4, 0.08), metal(0xc9ccd1, 0.42));
      g.add(cell);
      const label = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.7), plastic(0x2f6fb5, 0.7));
      label.rotation.x = -Math.PI / 2; label.position.y = 0.112; g.add(label);
    });

    // Speaker and haptic motor.
    part("audio", 0.46, 1.05, (g) => {
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.16, 40), metal(0x50555c, 0.4));
      can.position.set(-0.55, 0, 0.2); g.add(can);
      const cone = new THREE.Mesh(lathe([[0, 0.02], [0.12, 0.04], [0.36, 0.1], [0.4, 0.1]], 40), plastic(0x1b1d20, 0.8));
      cone.position.set(-0.55, 0.06, 0.2); g.add(cone);
      const erm = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 28), metal(0xb8a46a, 0.35));
      erm.position.set(0.7, 0, -0.35); g.add(erm);
    });

    // Main PCBA: FR4 disc with SoC, shield can, mics and passives.
    part("pcba", 0.7, 1.6, (g) => {
      const board = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.06, 96), new THREE.MeshPhysicalMaterial({ color: 0x0f4d2e, roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.25 }));
      g.add(board);
      const shield = new THREE.Mesh(new RoundedBoxGeometry(0.78, 0.14, 0.62, 2, 0.02), metal(0xd9dde2, 0.22));
      shield.position.set(0.15, 0.1, -0.1); g.add(shield);
      const soc = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.34), plastic(0x15171a, 0.4));
      soc.position.set(-0.55, 0.06, 0.35); g.add(soc);
      const rng = (s: number) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
      const r = rng(7);
      for (let i = 0; i < 38; i++) {
        const a = r() * Math.PI * 2, rad = 0.35 + r() * 0.95;
        const x = rad * Math.cos(a), z = rad * Math.sin(a);
        if (Math.abs(x - 0.15) < 0.45 && Math.abs(z + 0.1) < 0.38) continue;
        const c = new THREE.Mesh(new THREE.BoxGeometry(0.07 + r() * 0.06, 0.04, 0.04), r() > 0.5 ? plastic(0x6b5a3a, 0.5) : plastic(0x1d1f22, 0.5));
        c.position.set(x, 0.05, z); c.rotation.y = r() * Math.PI; g.add(c);
      }
      for (let i = 0; i < 2; i++) {
        const mic = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 20), metal(0xe5e7ea, 0.25));
        mic.position.set(i ? 1.05 : -1.05, 0.05, 0.3); g.add(mic);
      }
    });

    // Screws: four, they rise above the board.
    part("screws", 0.92, 2.15, (g) => {
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + (i * Math.PI) / 2;
        const s = new THREE.Group();
        const head = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 24), metal(0xb0b5ba, 0.25));
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.36, 12), metal(0x9a9fa5, 0.3));
        shaft.position.y = -0.2; s.add(head, shaft);
        s.position.set(1.22 * Math.cos(a), 0, 1.22 * Math.sin(a)); g.add(s);
      }
    });

    // LED ring: thin board with 12 LED packages that light the dome.
    const ledMats: THREE.MeshStandardMaterial[] = [];
    const ledLights: THREE.PointLight[] = [];
    part("ledring", 1.12, 2.7, (g) => {
      g.add(new THREE.Mesh(new THREE.RingGeometry(0.95, 1.38, 96).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0xf1f1ee, roughness: 0.55, side: THREE.DoubleSide })));
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const pkg = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.06, 0.16, 2, 0.02), plastic(0xf6f6f2, 0.4));
        const lm = new THREE.MeshStandardMaterial({ color: 0x302410, emissive: 0xffc65c, emissiveIntensity: 2.2, roughness: 0.3 });
        const die = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 16), lm);
        const x = 1.16 * Math.cos(a), z = 1.16 * Math.sin(a);
        pkg.position.set(x, 0.03, z); die.position.set(x, 0.065, z); pkg.rotation.y = -a;
        g.add(pkg, die); ledMats.push(lm);
        const pl = new THREE.PointLight(0xffc65c, 1.2, 2.4, 2); pl.position.set(x * 0.92, 0.35, z * 0.92);
        g.add(pl); ledLights.push(pl);
      }
    });

    // Diffuser ring.
    part("diffuser", 1.22, 3.15, (g) => {
      g.add(new THREE.Mesh(lathe([[1.0, 0], [1.42, 0], [1.42, 0.08], [1.0, 0.08]]), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.9, transmission: 0.6, thickness: 0.2, transparent: true, opacity: 0.9 })));
    });

    // Dome: frosted, transmissive shell.
    part("dome", 1.28, 3.75, (g) => {
      const pts: [number, number][] = [];
      for (let i = 0; i <= 24; i++) { const t = (i / 24) * (Math.PI / 2); pts.push([1.5 * Math.cos(t), 1.05 * Math.sin(t)]); }
      const inner = pts.slice().reverse().map(([x, y]) => [x * 0.94, y * 0.93] as [number, number]);
      g.add(new THREE.Mesh(lathe([...pts, ...inner]), new THREE.MeshPhysicalMaterial({ color: 0xfff6e6, roughness: 0.55, transmission: 0.88, thickness: 0.35, ior: 1.5, transparent: true, opacity: 0.96, side: THREE.DoubleSide })));
    });

    // Touch cap.
    part("cap", 2.36, 4.25, (g) => {
      g.add(new THREE.Mesh(lathe([[0, 0], [0.5, 0], [0.56, 0.05], [0.52, 0.12], [0, 0.14]], 64), plastic(0xdcd6ca, 0.45)));
    });

    // Leader labels, positioned each frame by projecting anchors to the screen.
    labelHost.innerHTML = "";
    const tags = parts.map((p) => {
      const el = document.createElement("div");
      el.className = "bx-tag";
      el.innerHTML = `<b>${p.station.split("-")[0]}</b><span>${p.name}</span><i>${p.spec}</i>`;
      labelHost.appendChild(el);
      return el;
    });
    const anchor = new THREE.Vector3();

    let explodeNow = calm ? explodeRef.current : 0;
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      controls.update();
      explodeNow += (explodeRef.current - explodeNow) * (calm ? 1 : 0.06);
      const e = explodeNow, ease = e * e * (3 - 2 * e);
      for (const p of parts) p.group.position.y = p.y0 + p.dy * ease;
      const fx = fixedRef.current;
      ledMats.forEach((lm, i) => {
        const dim = !fx && i >= 3 && i <= 7;
        lm.emissiveIntensity = dim ? 0.08 : 2.2;
        lm.emissive.setHex(dim ? 0x6b2a14 : 0xffc65c);
        ledLights[i].intensity = dim ? 0.02 : 1.2;
      });
      renderer.render(scene, camera);
      const show = e > 0.3;
      parts.forEach((p, i) => {
        anchor.set(1.75, 0.12, 0).applyMatrix4(p.group.matrixWorld);
        anchor.project(camera);
        const x = (anchor.x * 0.5 + 0.5) * w, y = (-anchor.y * 0.5 + 0.5) * h;
        const el = tags[i];
        el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
        el.style.opacity = show && anchor.z < 1 ? String(Math.min(1, (e - 0.3) * 3)) : "0";
      });
    };
    loop();

    const ro = new ResizeObserver(() => {
      w = host.clientWidth; h = host.clientHeight;
      renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
    });
    ro.observe(host);

    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); controls.dispose();
      envTex.dispose(); pmrem.dispose(); renderer.dispose();
      scene.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); } });
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
      labelHost.innerHTML = "";
    };
  }, []);

  return (
    <section aria-label="Exploded beacon view" className="bx">
      <div className="bx-stage">
        <div ref={mount} className="bx-canvas" />
        <div ref={labels} className="bx-labels" aria-hidden />
        <p className="bx-hint">Drag to rotate</p>
      </div>
      <div className="bx-controls">
        <label>Explode <input type="range" min={0} max={1} step={0.01} value={explode} onChange={(e) => setExplode(+e.target.value)} aria-label="Explode layers" /></label>
        <button onClick={() => setFixed(!fixed)} aria-pressed={fixed}>{fixed ? "Fixed firmware: uniform dome" : "Cold fault: one sector dim"}</button>
      </div>
      <p>{fixed
        ? "Fixed: firmware waits for the LED driver, writes calibration, reads it back. Dome uniform. Known-bad units still fail."
        : "Cold fault: the driver needs 180 ms, firmware writes at 50 ms. Calibration drops. One sector stays dim. The parts test fine."}</p>
      <table className="bx-bom">
        <thead><tr><th>Station</th><th>Part</th><th>Spec (fictional)</th></tr></thead>
        <tbody>{BOM.map((b) => <tr key={b.id} className={b.id === "ledring" ? "hot" : ""}><td>{b.station}</td><td>{b.name}</td><td>{b.spec}</td></tr>)}</tbody>
      </table>
    </section>
  );
}
