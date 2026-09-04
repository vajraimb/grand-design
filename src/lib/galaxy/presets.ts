import type { GalaxyParams, PresetId, Quality, QualityCounts } from "./types";

export const QUALITY_COUNTS: Record<Quality, QualityCounts> = {
  low: { stars: 12000, dust: 4000, hii: 140 },
  medium: { stars: 32000, dust: 9000, hii: 260 },
  high: { stars: 56000, dust: 14000, hii: 380 },
};

export type PresetMeta = {
  id: PresetId;
  name: string;
  hubble: string;
  blurb: string;
  params: GalaxyParams;
};

export const PRESETS: Record<PresetId, PresetMeta> = {
  milkyway: {
    id: "milkyway",
    name: "银河系",
    hubble: "SBbc",
    blurb: "有棒旋涡，中等缠绕，暗物质晕撑起平直旋转曲线。",
    params: {
      radGalaxy: 16,
      radCore: 4.0,
      deltaAng: 0.34,
      ex1: 0.68,
      ex2: 0.9,
      pertN: 2,
      pertAmp: 0.7,
      inclination: 54,
      hasDarkMatter: true,
      seed: 42,
    },
  },
  andromeda: {
    id: "andromeda",
    name: "仙女座",
    hubble: "SA(s)b",
    blurb: "更大的核球，旋臂收得更紧，尘埃带更明显。",
    params: {
      radGalaxy: 20,
      radCore: 6.4,
      deltaAng: 0.42,
      ex1: 0.74,
      ex2: 0.93,
      pertN: 2,
      pertAmp: 0.32,
      inclination: 72,
      hasDarkMatter: true,
      seed: 71,
    },
  },
  whirlpool: {
    id: "whirlpool",
    name: "涡状星系",
    hubble: "SA(s)bc",
    blurb: "经典双臂大设计旋涡，H II 区点亮旋臂。",
    params: {
      radGalaxy: 15,
      radCore: 3.1,
      deltaAng: 0.33,
      ex1: 0.55,
      ex2: 0.86,
      pertN: 2,
      pertAmp: 0.48,
      inclination: 28,
      hasDarkMatter: true,
      seed: 19,
    },
  },
  sa: {
    id: "sa",
    name: "早型 Sa",
    hubble: "Sa",
    blurb: "核球主导，旋臂紧紧缠绕，年轻蓝星较少。",
    params: {
      radGalaxy: 14,
      radCore: 6.0,
      deltaAng: 0.5,
      ex1: 0.8,
      ex2: 0.95,
      pertN: 2,
      pertAmp: 0.2,
      inclination: 50,
      hasDarkMatter: true,
      seed: 8,
    },
  },
  sc: {
    id: "sc",
    name: "晚型 Sc",
    hubble: "Sc",
    blurb: "核球很小，旋臂张开，盘上布满年轻热星。",
    params: {
      radGalaxy: 17,
      radCore: 2.0,
      deltaAng: 0.22,
      ex1: 0.56,
      ex2: 0.84,
      pertN: 2,
      pertAmp: 0.9,
      inclination: 38,
      hasDarkMatter: true,
      seed: 105,
    },
  },
};

export const PRESET_LIST = Object.values(PRESETS);

export function detectQuality(): Quality {
  if (typeof window === "undefined") return "medium";
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const w = window.innerWidth;
  if (coarse || w < 640) return "low";
  if (w < 1100) return "medium";
  return "high";
}
