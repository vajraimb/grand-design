import { diskPoint } from "./orbit";
import type {
  GalaxyParams,
  LandmarkAnchor,
  LandmarkKind,
  PresetId,
  ScreenLabel,
  WorldLandmark,
} from "./types";

export function landmarksFor(preset: PresetId, p: GalaxyParams): WorldLandmark[] {
  const R = p.radGalaxy;
  if (preset === "milkyway") {
    return [
      { id: "center", name: "银心", sub: "Sgr A*", kind: "center", priority: 5, world: { x: 0, y: 0, z: 0 } },
      {
        id: "sun",
        name: "太阳",
        sub: "猎户支 · 8.1 kpc",
        kind: "sun",
        priority: 6,
        world: diskPoint(8.1, 0.42, p, 0.12),
      },
      { id: "scutum", name: "盾牌臂", kind: "arm", priority: 2, world: diskPoint(R * 0.32, 0.2, p) },
      { id: "sgr", name: "人马臂", kind: "arm", priority: 2, world: diskPoint(R * 0.48, Math.PI, p) },
      { id: "perseus", name: "英仙臂", kind: "arm", priority: 2, world: diskPoint(R * 0.72, -1.05, p) },
      { id: "outer", name: "外臂", kind: "arm", priority: 1, world: diskPoint(R * 0.88, Math.PI - 0.35, p) },
      { id: "lmc", name: "大麦哲伦", sub: "伴星系", kind: "companion", priority: 4, world: { x: -9.2, y: -2.4, z: 7.6 } },
      { id: "smc", name: "小麦哲伦", sub: "伴星系", kind: "companion", priority: 3, world: { x: -6.8, y: -3.0, z: 8.4 } },
    ];
  }
  if (preset === "andromeda") {
    return [
      { id: "center", name: "M31 核", kind: "center", priority: 5, world: { x: 0, y: 0, z: 0 } },
      { id: "m32", name: "M32", sub: "伴椭圆", kind: "companion", priority: 4, world: { x: 2.1, y: 0.5, z: 0.8 } },
      { id: "m110", name: "M110", sub: "NGC 205", kind: "companion", priority: 4, world: { x: 5.4, y: -1.4, z: -3.8 } },
      { id: "inner", name: "内盘", kind: "arm", priority: 2, world: diskPoint(R * 0.38, 0, p) },
      { id: "outer-arm", name: "外旋臂", kind: "arm", priority: 2, world: diskPoint(R * 0.72, Math.PI, p) },
    ];
  }
  if (preset === "whirlpool") {
    const companion = diskPoint(R * 1.12, 0.12, p, 1.35);
    return [
      { id: "center", name: "M51 核", kind: "center", priority: 5, world: { x: 0, y: 0, z: 0 } },
      { id: "n5195", name: "NGC 5195", sub: "伴星系", kind: "companion", priority: 5, world: companion },
      { id: "arm-a", name: "主旋臂", kind: "arm", priority: 2, world: diskPoint(R * 0.55, 0, p) },
      { id: "arm-b", name: "次旋臂", kind: "arm", priority: 2, world: diskPoint(R * 0.58, Math.PI, p) },
    ];
  }
  if (preset === "sa") {
    return [
      { id: "center", name: "核球", kind: "center", priority: 5, world: { x: 0, y: 0, z: 0 } },
      { id: "inner", name: "内旋臂", kind: "arm", priority: 2, world: diskPoint(R * 0.42, 0, p) },
      { id: "outer-arm", name: "外盘", kind: "arm", priority: 1, world: diskPoint(R * 0.78, Math.PI, p) },
    ];
  }
  return [
    { id: "center", name: "核", kind: "center", priority: 5, world: { x: 0, y: 0, z: 0 } },
    { id: "arm-a", name: "旋臂", kind: "arm", priority: 2, world: diskPoint(R * 0.5, 0, p) },
    { id: "arm-b", name: "对臂", kind: "arm", priority: 2, world: diskPoint(R * 0.52, Math.PI, p) },
  ];
}

export type CloudSpec = {
  id: string;
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
  n: number;
  color: [number, number, number];
};

export function companionClouds(preset: PresetId, p: GalaxyParams, qualityN: number): CloudSpec[] {
  const scale = Math.max(0.45, qualityN / 26000);
  if (preset === "milkyway") {
    return [
      { id: "lmc", x: -9.2, y: -2.4, z: 7.6, rx: 1.55, ry: 0.62, rz: 1.2, n: Math.floor(1400 * scale), color: [0.85, 0.55, 0.42] },
      { id: "smc", x: -6.8, y: -3.0, z: 8.4, rx: 0.88, ry: 0.4, rz: 0.72, n: Math.floor(700 * scale), color: [0.72, 0.64, 0.88] },
    ];
  }
  if (preset === "andromeda") {
    return [
      { id: "m32", x: 2.1, y: 0.5, z: 0.8, rx: 0.55, ry: 0.45, rz: 0.5, n: Math.floor(500 * scale), color: [1, 0.86, 0.62] },
      { id: "m110", x: 5.4, y: -1.4, z: -3.8, rx: 1.5, ry: 0.7, rz: 1.1, n: Math.floor(900 * scale), color: [0.95, 0.78, 0.55] },
    ];
  }
  if (preset === "whirlpool") {
    const c = diskPoint(p.radGalaxy * 1.12, 0.12, p, 1.35);
    return [
      { id: "n5195", x: c.x, y: c.y, z: c.z, rx: 1.15, ry: 0.85, rz: 1.05, n: Math.floor(1100 * scale), color: [1, 0.82, 0.55] },
    ];
  }
  return [];
}

/** Camera-azimuth test: NDC z is useless here (near/far 0.15/400 compresses everything to ~0.98). */
function isFarSideArm(
  kind: LandmarkKind,
  world: { x: number; y: number; z: number },
  cam: { x: number; z: number },
) {
  if (kind !== "arm") return false;
  const camR = Math.hypot(cam.x, cam.z);
  if (camR < 0.8) return false;
  const facing = (world.x * cam.x + world.z * cam.z) / camR;
  return facing < 0.6;
}

export function projectLandmarks(
  marks: WorldLandmark[],
  project: (x: number, y: number, z: number) => { x: number; y: number; z: number } | null,
  view: { w: number; h: number; padL: number; padR: number; padT: number; padB: number },
  cam: { x: number; z: number },
): ScreenLabel[] {
  const placed: { x: number; y: number; pri: number }[] = [];
  const out: ScreenLabel[] = [];
  const sorted = [...marks].sort((a, b) => b.priority - a.priority);
  const minGap = view.w < 640 ? 40 : 50;

  for (const m of sorted) {
    if (isFarSideArm(m.kind, m.world, cam)) continue;

    const ndc = project(m.world.x, m.world.y, m.world.z);
    if (!ndc) continue;
    let sx = (ndc.x * 0.5 + 0.5) * view.w;
    let sy = (-ndc.y * 0.5 + 0.5) * view.h;
    let anchor: LandmarkAnchor = "center";

    const left = view.padL;
    const right = view.w - view.padR;
    const top = view.padT;
    const bottom = view.h - view.padB;
    const inX = sx >= left && sx <= right;
    const inY = sy >= top && sy <= bottom;
    if (!inX || !inY) {
      if (m.priority < 3) continue;
      if (sx > right) {
        sx = right;
        anchor = "end";
      } else if (sx < left) {
        sx = left;
        anchor = "start";
      }
      sy = Math.min(Math.max(sy, top), bottom);
    }

    let clash = false;
    for (const p of placed) {
      if (Math.hypot(p.x - sx, p.y - sy) < minGap) {
        clash = true;
        break;
      }
    }
    if (clash && m.priority < 3) continue;
    if (clash && m.priority >= 3) {
      sy = Math.max(top + 8, sy - 22);
    }

    placed.push({ x: sx, y: sy, pri: m.priority });
    out.push({
      id: m.id,
      name: m.name,
      sub: m.sub,
      kind: m.kind,
      x: sx,
      y: sy,
      depth: ndc.z,
      anchor,
    });
  }
  return out;
}
