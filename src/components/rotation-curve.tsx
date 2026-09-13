import { sampleRotationCurve } from "@/lib/galaxy/physics";
import type { GalaxyParams } from "@/lib/galaxy/types";

export function RotationCurve({ params }: { params: GalaxyParams }) {
  const withDm = sampleRotationCurve({ ...params, hasDarkMatter: true });
  const noDm = sampleRotationCurve({ ...params, hasDarkMatter: false });
  const rMax = Math.max(...withDm.map((p) => p.r), 1);
  const vMax = Math.max(...withDm.map((p) => p.v), ...noDm.map((p) => p.v), 1) * 1.08;
  const w = 220;
  const h = 72;
  const pad = { l: 4, r: 4, t: 6, b: 6 };

  const sx = (r: number) => pad.l + (r / rMax) * (w - pad.l - pad.r);
  const sy = (v: number) => h - pad.b - (v / vMax) * (h - pad.t - pad.b);
  const path = (pts: { r: number; v: number }[]) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.r).toFixed(1)},${sy(p.v).toFixed(1)}`).join(" ");

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-xs font-medium tracking-wide text-muted uppercase">
          旋转曲线
        </span>
        <span className="text-[10px] text-subtle">km/s</span>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-14 w-full text-fg"
        aria-hidden="true"
      >
        <path d={path(noDm)} fill="none" stroke="currentColor" strokeOpacity="0.28" strokeWidth="1.2" />
        <path d={path(withDm)} fill="none" stroke="currentColor" strokeOpacity="0.9" strokeWidth="1.4" />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-subtle">
        <span>可见物质</span>
        <span>含暗物质晕</span>
      </div>
    </div>
  );
}
