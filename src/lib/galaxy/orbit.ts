import type { GalaxyParams } from "./types";
import { angularOffset, axisRatio } from "./physics";

/** Standing spiral apside — matches the vertex shader at a given orbital phase. */
export function diskPoint(
  r: number,
  theta: number,
  p: GalaxyParams,
  z = 0,
): { x: number; y: number; z: number } {
  const a = r;
  const b = r * axisRatio(r, p);
  const tilt = angularOffset(r, p);
  const x = a * Math.cos(theta);
  const ye = b * Math.sin(theta);
  let px = x * Math.cos(tilt) - ye * Math.sin(tilt);
  let py = x * Math.sin(tilt) + ye * Math.cos(tilt);
  if (p.pertAmp > 0.001 && p.pertN > 0.5) {
    const ang = Math.atan2(py, px);
    const pr = p.pertAmp * (0.35 + 0.65 * Math.min(Math.max(a / 16, 0), 1.4));
    px += pr * Math.sin(p.pertN * ang);
    py += pr * Math.cos(p.pertN * ang);
  }
  return { x: px, y: z, z: py };
}
