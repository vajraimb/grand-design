import { useEffect, useRef, useState } from "react";
import { detectQuality } from "@/lib/galaxy/presets";
import { useEngineStats, useGalaxyStore, useLandmarkScreen } from "@/lib/galaxy/store";

export function GalaxyView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [glError, setGlError] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let dead = false;
    let engine: { sync: (force?: boolean) => void; dispose: () => void } | null = null;

    useGalaxyStore.getState().setQuality(detectQuality());

    void import("@/lib/galaxy/engine")
      .then(({ GalaxyEngine }) => {
        if (dead || !canvasRef.current) return;
        try {
          engine = new GalaxyEngine(canvasRef.current);
          window.__galaxy = {
            getFps: () => useEngineStats.getState().fps,
            getLabels: () => useLandmarkScreen.getState().labels.map((l) => l.name),
          };
        } catch (err) {
          console.error(err);
          if (!dead) setGlError(true);
        }
      })
      .catch((err) => {
        console.error(err);
        if (!dead) setGlError(true);
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
    <>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        aria-label="旋涡星系模拟"
      />
      {glError ? (
        <p className="absolute inset-0 z-10 grid place-items-center px-6 text-center text-sm text-muted">
          星图需要 WebGL，当前环境无法启动。
        </p>
      ) : null}
    </>
  );
}

declare global {
  interface Window {
    __galaxy?: { getFps: () => number; getLabels: () => string[] };
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      setKeys?: (codes: string[]) => void;
      setSteer?: (v: number) => void;
      enterFly?: () => void;
    };
  }
}