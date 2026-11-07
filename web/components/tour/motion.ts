// Pure functions of time. The tour renders every frame from t alone, so a
// frame-stepped capture and a real-time playback draw the same picture.
export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
export const easeOut = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
export const easeInOut = (x: number) => {
  const v = clamp(x);
  return v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2;
};
export const lerp = (a: number, b: number, x: number) => a + (b - a) * x;
/** Opacity for a scene that fades in at a and out at b. */
export const fade = (t: number, a: number, b: number, fi = 0.35, fo = 0.3) =>
  Math.min(easeOut(seg(t, a, a + fi)), 1 - seg(t, b - fo, b));
export const typed = (s: string, t: number, at: number, cps = 40) =>
  s.slice(0, Math.max(0, Math.floor((t - at) * cps)));
/** Overshoot pop: 0 -> 1.15 -> 1. */
export const pop = (x: number) => {
  const v = clamp(x);
  return v < 0.6 ? lerp(0, 1.15, easeOut(v / 0.6)) : lerp(1.15, 1, (v - 0.6) / 0.4);
};
