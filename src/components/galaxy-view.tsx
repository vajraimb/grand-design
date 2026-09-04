import { useEffect, useRef } from "react";
import { detectQuality } from "@/lib/galaxy/presets";
import { useEngineStats, useGalaxyStore, useLandmarkScreen } from "@/lib/galaxy/store";

export function GalaxyView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let dead = false;
    let engine: { sync: (force?: boolean) => void; dispose: () => void } | null = null;

    useGalaxyStore.getState().setQuality(detectQuality());

    void import("@/lib/galaxy/engine").then(({ GalaxyEngine }) => {
      if (dead || !canvasRef.current) return;
      engine = new GalaxyEngine(canvasRef.current);
      window.__galaxy = {
        getFps: () => useEngineStats.getState().fps,
        getLabels: () => useLandmarkScreen.getState().labels.map((l) => l.name),
      };
    });

    const unsub = useGalaxyStore.subscribe(() => {
      engine?.sync();
    });

    return () => {
      dead = true;
      unsub();
      engine?.dispose();
      delete window.__galaxy;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full touch-none"
      aria-label="旋涡星系模拟"
    />
  );
}

declare global {
  interface Window {
    __galaxy?: { getFps: () => number; getLabels: () => string[] };
  }
}
