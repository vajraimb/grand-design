import { useEffect, useState, type ReactNode } from "react";
import { Eye, EyeOff, Pause, Play, RefreshCw, Rocket, Settings2 } from "lucide-react";
import { FlightHud } from "@/components/flight-hud";
import { RotationCurve } from "@/components/rotation-curve";
import { SliderField } from "@/components/ui/slider";
import { SwitchField } from "@/components/ui/switch";
import { PRESET_LIST } from "@/lib/galaxy/presets";
import { useEngineStats, useGalaxyStore, useLandmarkScreen } from "@/lib/galaxy/store";
import type { LandmarkKind, ScreenLabel } from "@/lib/galaxy/types";
import { cn } from "@/lib/utils";

function formatYear(year: number) {
  const gyr = year / 1e9;
  if (gyr >= 0.1) return `${gyr.toFixed(2)} Gyr`;
  const myr = year / 1e6;
  return `${myr.toFixed(0)} Myr`;
}

function formatRate(v: number) {
  return `${(v / 1e6).toFixed(1)} Myr/s`;
}

function Controls() {
  const preset = useGalaxyStore((s) => s.preset);
  const params = useGalaxyStore((s) => s.params);
  const quality = useGalaxyStore((s) => s.quality);
  const autoRotate = useGalaxyStore((s) => s.autoRotate);
  const showDust = useGalaxyStore((s) => s.showDust);
  const showHii = useGalaxyStore((s) => s.showHii);
  const showLabels = useGalaxyStore((s) => s.showLabels);
  const timeScale = useGalaxyStore((s) => s.timeScale);
  const brightness = useGalaxyStore((s) => s.brightness);
  const flyMode = useGalaxyStore((s) => s.flyMode);
  const setPreset = useGalaxyStore((s) => s.setPreset);
  const patchParams = useGalaxyStore((s) => s.patchParams);
  const setQuality = useGalaxyStore((s) => s.setQuality);
  const setAutoRotate = useGalaxyStore((s) => s.setAutoRotate);
  const setShowDust = useGalaxyStore((s) => s.setShowDust);
  const setShowHii = useGalaxyStore((s) => s.setShowHii);
  const setShowLabels = useGalaxyStore((s) => s.setShowLabels);
  const setTimeScale = useGalaxyStore((s) => s.setTimeScale);
  const setBrightness = useGalaxyStore((s) => s.setBrightness);
  const setFlyMode = useGalaxyStore((s) => s.setFlyMode);
  const meta = PRESET_LIST.find((p) => p.id === preset);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">
          形态
        </p>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_LIST.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPreset(p.id)}
              className={cn(
                "h-8 rounded-md px-2.5 text-xs font-medium transition-colors duration-(--motion-quick) ease-(--ease-out)",
                preset === p.id
                  ? "bg-fg text-accent-fg"
                  : "bg-surface text-muted hover:text-fg",
              )}
            >
              {p.name}
            </button>
          ))}
        </div>
        {meta ? (
          <p className="mt-2 text-xs leading-snug text-pretty text-subtle">
            {meta.hubble} · {meta.blurb}
          </p>
        ) : null}
      </div>

      <SliderField
        label="旋臂缠绕"
        display={params.deltaAng.toFixed(2)}
        min={0.1}
        max={0.55}
        step={0.01}
        value={params.deltaAng}
        onValueChange={(v) => patchParams({ deltaAng: v })}
      />
      <SliderField
        label="椭圆度"
        display={params.ex1.toFixed(2)}
        min={0.5}
        max={0.98}
        step={0.01}
        value={params.ex1}
        onValueChange={(v) => patchParams({ ex1: v })}
      />
      <SliderField
        label="密度波"
        display={params.pertAmp.toFixed(2)}
        min={0}
        max={1.4}
        step={0.02}
        value={params.pertAmp}
        onValueChange={(v) => patchParams({ pertAmp: v })}
      />
      <SliderField
        label="倾角"
        display={`${Math.round(params.inclination)}°`}
        min={0}
        max={90}
        step={1}
        value={params.inclination}
        onValueChange={(v) => patchParams({ inclination: v })}
      />
      <SliderField
        label="时间倍率"
        display={formatRate(timeScale)}
        min={1e6}
        max={4e7}
        step={5e5}
        value={timeScale}
        onValueChange={setTimeScale}
      />
      <SliderField
        label="亮度"
        display={brightness.toFixed(2)}
        min={0.45}
        max={2}
        step={0.05}
        value={brightness}
        onValueChange={setBrightness}
      />

      <div className="h-px bg-border" />

      <SwitchField
        label="暗物质晕"
        checked={params.hasDarkMatter}
        onCheckedChange={(v) => patchParams({ hasDarkMatter: v })}
      />
      <SwitchField label="尘埃带" checked={showDust} onCheckedChange={setShowDust} />
      <SwitchField label="H II 区" checked={showHii} onCheckedChange={setShowHii} />
      <SwitchField label="地标" checked={showLabels} onCheckedChange={setShowLabels} />
      <SwitchField label="驾驶" checked={flyMode} onCheckedChange={setFlyMode} />
      <SwitchField label="自动旋转" checked={autoRotate} onCheckedChange={setAutoRotate} />

      <RotationCurve params={params} />

      <div>
        <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">
          粒子
        </p>
        <div className="flex gap-1.5">
          {(["low", "medium", "high"] as const).map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setQuality(q)}
              className={cn(
                "h-8 flex-1 rounded-md text-xs font-medium transition-colors duration-(--motion-quick) ease-(--ease-out)",
                quality === q
                  ? "bg-fg text-accent-fg"
                  : "bg-surface text-muted hover:text-fg",
              )}
            >
              {q === "low" ? "低" : q === "medium" ? "中" : "高"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Overlay() {
  const paused = useGalaxyStore((s) => s.paused);
  const uiHidden = useGalaxyStore((s) => s.uiHidden);
  const sheetOpen = useGalaxyStore((s) => s.sheetOpen);
  const flyMode = useGalaxyStore((s) => s.flyMode);
  const setPaused = useGalaxyStore((s) => s.setPaused);
  const setUiHidden = useGalaxyStore((s) => s.setUiHidden);
  const setSheetOpen = useGalaxyStore((s) => s.setSheetOpen);
  const setShowLabels = useGalaxyStore((s) => s.setShowLabels);
  const setFlyMode = useGalaxyStore((s) => s.setFlyMode);
  const reshuffle = useGalaxyStore((s) => s.reshuffle);
  const stats = useEngineStats();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.code === "Space") {
        e.preventDefault();
        setPaused(!useGalaxyStore.getState().paused);
      }
      if (e.code === "KeyL") setShowLabels(!useGalaxyStore.getState().showLabels);
      if (e.code === "KeyH") setUiHidden(!useGalaxyStore.getState().uiHidden);
      if (e.code === "KeyR") reshuffle();
      if (e.code === "KeyF") setFlyMode(!useGalaxyStore.getState().flyMode);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reshuffle, setPaused, setUiHidden, setShowLabels, setFlyMode]);

  return (
    <div className="pointer-events-none absolute inset-0 z-20 text-fg">
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-28 bg-linear-to-b from-bg/80 to-transparent transition-opacity duration-(--motion-fast) ease-(--ease-out)",
          uiHidden ? "opacity-0" : "opacity-100",
        )}
      />
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-bg/70 to-transparent transition-opacity duration-(--motion-fast) ease-(--ease-out)",
          uiHidden ? "opacity-0" : "opacity-100",
        )}
      />

      <header
        className={cn(
          "pointer-events-none absolute top-0 left-0 p-4 pt-[max(1rem,env(safe-area-inset-top))] sm:p-6",
          "transition-opacity duration-(--motion-fast) ease-(--ease-out)",
          uiHidden ? "opacity-0" : "opacity-100",
        )}
      >
        <p className="font-display text-balance text-[1.65rem] leading-none tracking-tight sm:text-3xl">
          Grand Design
        </p>
        <p className="mt-1.5 max-w-64 text-pretty text-xs leading-snug text-muted sm:max-w-xs">
          密度波 · 银心 · 旋臂 · 太阳{flyMode ? " · 驾驶" : ""}
        </p>
      </header>

      <LandmarkLayer />
      <FlightHud />

      <div className="pointer-events-auto absolute top-[max(1rem,env(safe-area-inset-top))] right-3 flex gap-1.5 sm:right-6">
        <div
          className={cn(
            "flex gap-1.5 transition-opacity duration-(--motion-fast) ease-(--ease-out)",
            uiHidden ? "pointer-events-none opacity-0" : "opacity-100",
          )}
        >
          <IconBtn
            label={flyMode ? "退出驾驶" : "驾驶"}
            onClick={() => setFlyMode(!flyMode)}
          >
            <Rocket className={cn("size-4", flyMode && "text-fg")} />
          </IconBtn>
          <IconBtn
            label={paused ? "继续" : "暂停"}
            onClick={() => setPaused(!paused)}
          >
            {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
          </IconBtn>
          <IconBtn label="重新抽样" onClick={reshuffle}>
            <RefreshCw className="size-4" />
          </IconBtn>
          <IconBtn
            label="设定"
            className="lg:hidden"
            onClick={() => setSheetOpen(!sheetOpen)}
          >
            <Settings2 className="size-4" />
          </IconBtn>
        </div>
        <IconBtn
          label={uiHidden ? "显示界面" : "隐藏界面"}
          onClick={() => setUiHidden(!uiHidden)}
        >
          {uiHidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
        </IconBtn>
      </div>

      <aside
        className={cn(
          "pointer-events-auto absolute top-24 right-6 bottom-8 hidden w-80 overflow-y-auto rounded-xl bg-elevated/80 p-4 shadow-border lg:block",
          "transition-opacity duration-(--motion-fast) ease-(--ease-out)",
          uiHidden ? "pointer-events-none opacity-0" : "opacity-100",
        )}
      >
        {hydrated ? <Controls /> : null}
      </aside>

      <div
        className={cn(
          "pointer-events-auto absolute inset-x-0 bottom-0 lg:hidden",
          "transition-opacity duration-(--motion-fast) ease-(--ease-out)",
          flyMode || (uiHidden && !sheetOpen) ? "pointer-events-none opacity-0" : "opacity-100",
        )}
      >
        <div className="rounded-t-xl bg-elevated/92 shadow-border">
          <button
            type="button"
            className="flex h-14 w-full items-center justify-between px-4"
            onClick={() => setSheetOpen(!sheetOpen)}
          >
            <span className="text-sm font-medium">设定</span>
            <span className="text-xs text-subtle">{sheetOpen ? "收起" : "展开"}</span>
          </button>
          {sheetOpen ? (
            <div className="sheet-body overflow-y-auto px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              <Controls />
            </div>
          ) : null}
        </div>
      </div>

      <footer
        className={cn(
          "pointer-events-none absolute bottom-3 left-4 hidden font-mono text-xs tabular-nums text-subtle sm:flex sm:gap-4 lg:bottom-6 lg:left-6",
          "transition-opacity duration-(--motion-fast) ease-(--ease-out)",
          uiHidden || flyMode ? "opacity-0" : "opacity-100",
        )}
      >
        <span>{stats.starCount.toLocaleString()} 星</span>
        <span>{stats.dustCount.toLocaleString()} 尘埃</span>
        <span>{Math.round(stats.fps)} fps</span>
        <span>t = {formatYear(stats.year)}</span>
        <span className="hidden xl:inline">拖动轨道 · L 地标 · 空格暂停</span>
      </footer>
    </div>
  );
}

function LandmarkLayer() {
  const labels = useLandmarkScreen((s) => s.labels);
  const show = useGalaxyStore((s) => s.showLabels);
  const targetId = useGalaxyStore((s) => s.targetId);
  const approach = useGalaxyStore((s) => s.approach);
  if (!show || labels.length === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {labels.map((lab) => (
        <button
          key={lab.id}
          type="button"
          data-landmark={lab.id}
          onClick={() => approach(lab.id)}
          className={cn(
            "landmark",
            kindClass(lab.kind),
            anchorClass(lab.anchor),
            targetId === lab.id && "landmark-locked",
          )}
          style={{ left: lab.x, top: lab.y }}
        >
          <span className="landmark-copy">
            <span className="landmark-name">{lab.name}</span>
            {lab.sub ? <span className="landmark-sub">{lab.sub}</span> : null}
          </span>
          <span className="landmark-dot" />
        </button>
      ))}
    </div>
  );
}

function kindClass(kind: LandmarkKind) {
  if (kind === "sun") return "landmark-sun";
  if (kind === "center") return "landmark-center";
  if (kind === "companion") return "landmark-companion";
  return "landmark-arm";
}

function anchorClass(anchor: ScreenLabel["anchor"]) {
  if (anchor === "end") return "landmark-end";
  if (anchor === "start") return "landmark-start";
  return "";
}

function IconBtn({
  label,
  onClick,
  children,
  className,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "flex size-11 items-center justify-center rounded-lg bg-elevated/80 text-fg shadow-border",
        "transition-[transform,background-color] duration-(--motion-quick) ease-(--ease-out)",
        "hover:bg-surface active:scale-[0.98]",
        className,
      )}
    >
      {children}
    </button>
  );
}
