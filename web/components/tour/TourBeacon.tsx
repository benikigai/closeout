'use client';

/* Deterministic exploded beacon for the 60-second tour. Geometry follows the
   landing's BeaconExploded (procedural three.js, fictional part numbers), but
   there is no animation loop or orbit control: each render is a pure function
   of the props, so frame-stepped capture is exact. */
import { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export type BeaconPose = { explode: number; angle: number; fixed: boolean; label: number };
type Props = BeaconPose & { visible: boolean; width: number; height: number; readyMs: number };

const lathe = (points: [number, number][], segments = 96) =>
  new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), segments);

export default function TourBeacon({ visible, width, height, readyMs, ...pose }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const tag = useRef<HTMLDivElement>(null);
  const draw = useRef<((p: BeaconPose) => void) | null>(null);

  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const envTarget = pmrem.fromScene(room, 0.04);
    room.dispose();
    scene.environment = envTarget.texture;
    const camera = new THREE.PerspectiveCamera(32.5, width / height, 0.1, 100);
    const key = new THREE.DirectionalLight(0xfff4e0, 1.1); key.position.set(5, 9, 4); scene.add(key);
    const rim = new THREE.DirectionalLight(0x9fc4ff, 0.5); rim.position.set(-6, 4, -5); scene.add(rim);

    const sc = document.createElement('canvas'); sc.width = sc.height = 128;
    const c2 = sc.getContext('2d')!;
    const grad = c2.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, 'rgba(0,0,0,0.55)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    c2.fillStyle = grad; c2.fillRect(0, 0, 128, 128);
    const shadowTex = new THREE.CanvasTexture(sc);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = -0.01; scene.add(shadow);

    const plastic = (c: number, r = 0.55) => new THREE.MeshPhysicalMaterial({ color: c, roughness: r, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.6 });
    const metal = (c: number, r = 0.3) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 1 });
    const parts: { group: THREE.Group; y0: number; dy: number }[] = [];
    const part = (y0: number, dy: number, build: (g: THREE.Group) => void) => {
      const g = new THREE.Group(); build(g); g.position.y = y0; scene.add(g); parts.push({ group: g, y0, dy }); return g;
    };

    part(0, 0, (g) => {
      g.add(new THREE.Mesh(lathe([[0, 0], [1.48, 0], [1.62, 0.12], [1.66, 0.62], [1.56, 0.66], [1.52, 0.2], [0, 0.2]]), plastic(0x2a2e33, 0.62)));
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + (i * Math.PI) / 2;
        const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.42, 20), plastic(0x2a2e33, 0.62));
        boss.position.set(1.22 * Math.cos(a), 0.4, 1.22 * Math.sin(a)); g.add(boss);
      }
    });
    part(0.24, 0.55, (g) => {
      g.add(new THREE.Mesh(new RoundedBoxGeometry(1.7, 0.22, 1.15, 4, 0.08), metal(0xc9ccd1, 0.42)));
      const label = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.7), plastic(0x2f6fb5, 0.7));
      label.rotation.x = -Math.PI / 2; label.position.y = 0.112; g.add(label);
    });
    part(0.46, 1.05, (g) => {
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.16, 40), metal(0x50555c, 0.4));
      can.position.set(-0.55, 0, 0.2); g.add(can);
      const erm = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 28), metal(0xb8a46a, 0.35));
      erm.position.set(0.7, 0, -0.35); g.add(erm);
    });
    part(0.7, 1.6, (g) => {
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.06, 96), new THREE.MeshPhysicalMaterial({ color: 0x0f4d2e, roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.25 })));
      const shield = new THREE.Mesh(new RoundedBoxGeometry(0.78, 0.14, 0.62, 2, 0.02), metal(0xd9dde2, 0.22));
      shield.position.set(0.15, 0.1, -0.1); g.add(shield);
      const soc = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.34), plastic(0x15171a, 0.4));
      soc.position.set(-0.55, 0.06, 0.35); g.add(soc);
      let s = 7; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 38; i++) {
        const a = r() * Math.PI * 2, rad = 0.35 + r() * 0.95;
        const x = rad * Math.cos(a), z = rad * Math.sin(a);
        if (Math.abs(x - 0.15) < 0.45 && Math.abs(z + 0.1) < 0.38) continue;
        const c = new THREE.Mesh(new THREE.BoxGeometry(0.07 + r() * 0.06, 0.04, 0.04), r() > 0.5 ? plastic(0x6b5a3a, 0.5) : plastic(0x1d1f22, 0.5));
        c.position.set(x, 0.05, z); c.rotation.y = r() * Math.PI; g.add(c);
      }
    });
    part(0.92, 2.15, (g) => {
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + (i * Math.PI) / 2;
        const head = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 24), metal(0xb0b5ba, 0.25));
        head.position.set(1.22 * Math.cos(a), 0, 1.22 * Math.sin(a)); g.add(head);
      }
    });
    const ledMats: THREE.MeshStandardMaterial[] = [];
    const ledLights: THREE.PointLight[] = [];
    const ledRing = part(1.12, 2.7, (g) => {
      g.add(new THREE.Mesh(new THREE.RingGeometry(0.95, 1.38, 96).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0xf1f1ee, roughness: 0.55, side: THREE.DoubleSide })));
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const x = 1.16 * Math.cos(a), z = 1.16 * Math.sin(a);
        const pkg = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.06, 0.16, 2, 0.02), plastic(0xf6f6f2, 0.4));
        pkg.position.set(x, 0.03, z); pkg.rotation.y = -a;
        const lm = new THREE.MeshStandardMaterial({ color: 0x302410, emissive: 0xffc65c, emissiveIntensity: 2.2, roughness: 0.3 });
        const die = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 16), lm);
        die.position.set(x, 0.065, z);
        const pl = new THREE.PointLight(0xffc65c, 1.2, 2.4, 2); pl.position.set(x * 0.92, 0.35, z * 0.92);
        g.add(pkg, die, pl); ledMats.push(lm); ledLights.push(pl);
      }
      const driver = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.07, 0.26, 2, 0.02), plastic(0x15171a, 0.4));
      driver.position.set(1.0, 0.04, 0.55); g.add(driver);
    });
    part(1.22, 3.15, (g) => {
      g.add(new THREE.Mesh(lathe([[1.0, 0], [1.42, 0], [1.42, 0.08], [1.0, 0.08]]), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.9, transmission: 0.6, thickness: 0.2, transparent: true, opacity: 0.9 })));
    });
    part(1.28, 3.75, (g) => {
      const pts: [number, number][] = [];
      for (let i = 0; i <= 24; i++) { const a = (i / 24) * (Math.PI / 2); pts.push([1.5 * Math.cos(a), 1.05 * Math.sin(a)]); }
      const inner = pts.slice().reverse().map(([x, y]) => [x * 0.94, y * 0.93] as [number, number]);
      g.add(new THREE.Mesh(lathe([...pts, ...inner]), new THREE.MeshPhysicalMaterial({ color: 0xfff6e6, roughness: 0.55, transmission: 0.88, thickness: 0.35, ior: 1.5, transparent: true, opacity: 0.96, side: THREE.DoubleSide })));
    });
    part(2.36, 4.25, (g) => {
      g.add(new THREE.Mesh(lathe([[0, 0], [0.5, 0], [0.56, 0.05], [0.52, 0.12], [0, 0.14]], 64), plastic(0xdcd6ca, 0.45)));
    });

    const anchor = new THREE.Vector3();
    const a0 = Math.atan2(9.8, 8.2), radius = Math.hypot(8.2, 9.8);
    draw.current = (p) => {
      const e = Math.min(1, Math.max(0, p.explode)), ease = e * e * (3 - 2 * e);
      for (const q of parts) q.group.position.y = q.y0 + q.dy * ease;
      camera.position.set(radius * Math.cos(a0 + p.angle), 5.4, radius * Math.sin(a0 + p.angle));
      camera.lookAt(0, 3.25, 0);
      ledMats.forEach((lm, i) => {
        const dim = !p.fixed && i >= 3 && i <= 7;
        lm.emissiveIntensity = dim ? 0.08 : 2.2;
        lm.emissive.setHex(dim ? 0x6b2a14 : 0xffc65c);
        ledLights[i].intensity = dim ? 0.02 : 1.2;
      });
      scene.updateMatrixWorld();
      renderer.render(scene, camera);
      const t = tag.current;
      if (t) {
        anchor.set(1.0, 0.04, 0.55).applyMatrix4(ledRing.matrixWorld).project(camera);
        const x = (anchor.x * 0.5 + 0.5) * width, y = (-anchor.y * 0.5 + 0.5) * height;
        t.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
        t.style.opacity = String(p.label);
      }
    };
    return () => {
      draw.current = null;
      scene.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        o.geometry.dispose();
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      });
      shadowTex.dispose(); envTarget.dispose(); pmrem.dispose(); renderer.dispose();
      if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement);
    };
  }, [width, height]);

  useLayoutEffect(() => {
    if (visible) draw.current?.(pose);
  });

  return (
    <div className="tb" style={{ width, height }}>
      <div ref={host} className="tb-canvas" />
      <div ref={tag} className="tb-tag" style={{ opacity: 0 }}>
        <i />
        <span><b>LED driver</b> second-source part<em>cold start · ready at {readyMs} ms</em></span>
      </div>
    </div>
  );
}
