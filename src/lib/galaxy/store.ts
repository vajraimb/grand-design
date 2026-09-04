import { create } from "zustand";
import { PRESETS } from "./presets";
import type { EngineStats, GalaxyParams, PresetId, Quality, ScreenLabel } from "./types";

type GalaxyStore = {
  preset: PresetId;
  params: GalaxyParams;
  quality: Quality;
  paused: boolean;
  autoRotate: boolean;
  showDust: boolean;
  showHii: boolean;
  showLabels: boolean;
  timeScale: number;
  brightness: number;
  uiHidden: boolean;
  sheetOpen: boolean;
  setPreset: (id: PresetId) => void;
  patchParams: (patch: Partial<GalaxyParams>) => void;
  setQuality: (q: Quality) => void;
  setPaused: (v: boolean) => void;
  setAutoRotate: (v: boolean) => void;
  setShowDust: (v: boolean) => void;
  setShowHii: (v: boolean) => void;
  setShowLabels: (v: boolean) => void;
  setTimeScale: (v: number) => void;
  setBrightness: (v: number) => void;
  setUiHidden: (v: boolean) => void;
  setSheetOpen: (v: boolean) => void;
  reshuffle: () => void;
};

const initialPreset: PresetId = "milkyway";

export const useGalaxyStore = create<GalaxyStore>((set, get) => ({
  preset: initialPreset,
  params: { ...PRESETS[initialPreset].params },
  quality: "medium",
  paused: false,
  autoRotate: true,
  showDust: true,
  showHii: true,
  showLabels: true,
  timeScale: 9e6,
  brightness: 1.05,
  uiHidden: false,
  sheetOpen: false,
  setPreset: (id) =>
    set({
      preset: id,
      params: { ...PRESETS[id].params, seed: get().params.seed },
    }),
  patchParams: (patch) => set({ params: { ...get().params, ...patch } }),
  setQuality: (q) => set({ quality: q }),
  setPaused: (v) => set({ paused: v }),
  setAutoRotate: (v) => set({ autoRotate: v }),
  setShowDust: (v) => set({ showDust: v }),
  setShowHii: (v) => set({ showHii: v }),
  setShowLabels: (v) => set({ showLabels: v }),
  setTimeScale: (v) => set({ timeScale: v }),
  setBrightness: (v) => set({ brightness: v }),
  setUiHidden: (v) => set({ uiHidden: v }),
  setSheetOpen: (v) => set({ sheetOpen: v }),
  reshuffle: () =>
    set({
      params: {
        ...get().params,
        seed: (Math.random() * 0x7fffffff) | 0,
      },
    }),
}));

export const useEngineStats = create<EngineStats>(() => ({
  fps: 0,
  year: 0,
  starCount: 0,
  dustCount: 0,
  hiiCount: 0,
}));

export const useLandmarkScreen = create<{ labels: ScreenLabel[] }>(() => ({
  labels: [],
}));
