export type Quality = "low" | "medium" | "high";

export type PresetId = "milkyway" | "andromeda" | "whirlpool" | "sa" | "sc";

export type GalaxyParams = {
  radGalaxy: number;
  radCore: number;
  /** Radians of orbital tilt per kpc — arm winding. */
  deltaAng: number;
  /** Axis ratio b/a at the core edge. */
  ex1: number;
  /** Axis ratio b/a at the disk edge. */
  ex2: number;
  pertN: number;
  pertAmp: number;
  inclination: number;
  hasDarkMatter: boolean;
  seed: number;
};

export type QualityCounts = {
  stars: number;
  dust: number;
  hii: number;
};

export type ParticleBuffers = {
  a: Float32Array;
  b: Float32Array;
  tilt: Float32Array;
  theta0: Float32Array;
  velTheta: Float32Array;
  z: Float32Array;
  size: Float32Array;
  mag: Float32Array;
  phase: Float32Array;
  color: Float32Array;
  count: number;
};

export type GalaxyBuffers = {
  stars: ParticleBuffers;
  dust: ParticleBuffers;
  hii: ParticleBuffers;
};

export type EngineStats = {
  fps: number;
  year: number;
  starCount: number;
  dustCount: number;
  hiiCount: number;
};

export type LandmarkKind = "center" | "arm" | "sun" | "companion";

export type WorldLandmark = {
  id: string;
  name: string;
  sub?: string;
  kind: LandmarkKind;
  priority: number;
  world: { x: number; y: number; z: number };
};

export type ScreenLabel = {
  id: string;
  name: string;
  sub?: string;
  kind: LandmarkKind;
  x: number;
  y: number;
  depth: number;
  anchor: "center" | "start" | "end";
};
