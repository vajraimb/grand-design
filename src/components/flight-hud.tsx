import { useRef, type PointerEvent } from "react";
import { landmarksFor } from "@/lib/galaxy/landmarks";
import { flightInput } from "@/lib/galaxy/flight";
import { useFlightHud, useGalaxyStore } from "@/lib/galaxy/store";
import { cn } from "@/lib/utils";

export function FlightHud() {
  const flying = useGalaxyStore((s) => s.flyMode);
  const targetId = useGalaxyStore((s) => s.targetId);
  const preset = useGalaxyStore((s) => s.preset);
  const params = useGalaxyStore((s) => s.params);
  const uiHidden = useGalaxyStore((s) => s.uiHidden);
  const approach = useGalaxyStore((s) => s.approach);
  const hud = useFlightHud();
  if (!flying || uiHidden) return null;
  const marks = landmarksFor(preset, params);

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      <div className="pointer-events-none absolute top-[max(4.5rem,calc(env(safe-area-inset-top)+3.6rem))] left-4 max-w-56 sm:left-6">
        <p className="font-mono text-xs tabular-nums text-fg">
          航速 {hud.speed.toFixed(2)}
        </p>
        {hud.targetName ? (
          <p className="mt-1 text-xs leading-snug text-muted">
            {hud.arrived ? "抵达 " : "前往 "}
            <span className="text-fg">{hud.targetName}</span>
            {hud.dist > 0 ? (
              <span className="font-mono text-subtle"> · {hud.dist.toFixed(1)} kpc</span>
            ) : null}
          </p>
        ) : (
          <p className="mt-1 text-xs text-subtle">点地标锁定航向 · W 加速 · A/D 转向</p>
        )}
      </div>

      <div className="pointer-events-auto absolute inset-x-0 bottom-[4.6rem] flex gap-1.5 overflow-x-auto px-3 pb-1 lg:bottom-8 lg:left-6 lg:right-auto lg:max-w-[min(36rem,calc(100%-24rem))] lg:px-0">
        {marks.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => approach(m.id)}
            className={cn(
              "h-9 shrink-0 rounded-md px-2.5 text-xs font-medium shadow-border",
              "transition-colors duration-(--motion-quick) ease-(--ease-out)",
              targetId === m.id ? "bg-fg text-accent-fg" : "bg-elevated/85 text-muted hover:text-fg",
            )}
          >
            {m.name}
          </button>
        ))}
      </div>

      <TouchRig />
    </div>
  );
}

function TouchRig() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[8.5rem] flex items-end justify-between px-3 lg:hidden">
      <Stick
        onChange={(x, y) => {
          flightInput.touchYaw = -x;
          flightInput.touchPitch = y;
        }}
      />
      <Throttle />
    </div>
  );
}

function Stick({ onChange }: { onChange: (x: number, y: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const pid = useRef<number | null>(null);

  const read = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = -(((e.clientY - r.top) / r.height) * 2 - 1);
    const m = Math.hypot(nx, ny);
    const s = m > 1 ? 1 / m : 1;
    onChange(nx * s, ny * s);
  };

  return (
    <div
      ref={ref}
      className="pointer-events-auto size-[7.25rem] touch-none rounded-full bg-elevated/55 shadow-border"
      onPointerDown={(e) => {
        pid.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        read(e);
      }}
      onPointerMove={(e) => {
        if (pid.current !== e.pointerId) return;
        read(e);
      }}
      onPointerUp={(e) => {
        if (pid.current !== e.pointerId) return;
        pid.current = null;
        onChange(0, 0);
      }}
      onPointerCancel={() => {
        pid.current = null;
        onChange(0, 0);
      }}
      aria-label="转向"
    />
  );
}

function Throttle() {
  const hold = (v: number) => {
    flightInput.touchThrottle = v;
  };
  return (
    <div className="pointer-events-auto flex flex-col gap-2">
      <button
        type="button"
        className="h-12 min-w-16 rounded-md bg-elevated/85 px-3 text-xs font-medium text-fg shadow-border active:bg-surface"
        onPointerDown={() => hold(1)}
        onPointerUp={() => hold(0)}
        onPointerCancel={() => hold(0)}
      >
        加速
      </button>
      <button
        type="button"
        className="h-12 min-w-16 rounded-md bg-elevated/85 px-3 text-xs font-medium text-muted shadow-border active:bg-surface"
        onPointerDown={() => hold(-1)}
        onPointerUp={() => hold(0)}
        onPointerCancel={() => hold(0)}
      >
        减速
      </button>
    </div>
  );
}
