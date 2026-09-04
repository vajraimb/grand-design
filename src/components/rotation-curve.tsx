import { rotationCurve } from "@/lib/galaxy/physics";
import type { GalaxyParams } from "@/lib/galaxy/types";

export function RotationCurve({ params }: { params: GalaxyParams }) {
  const pts = rotationCurve(params, 40);
  const w = 288;
  const h = 92;
  const pad = { l: 28, r: 8, t: 8, b: 20 };
  const maxR = pts[pts.length - 1]?.r || 1;
  const maxV = Math.max(220, ...pts.flatMap((p) => [p.v, p.vNoHalo]));
  const x = (r: number) => pad.l + ((w - pad.l - pad.r) * r) / maxR;
  const y = (v: number) => h - pad.b - ((h - pad.t - pad.b) * v) / maxV;
  const line = (key: "v" | "vNoHalo") =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.r).toFixed(1)} ${y(p[key]).toFixed(1)}`).join(" ");

  return (
    <div>
      <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">旋转曲线</p>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full text-fg" aria-hidden="true">
        <path d={line("vNoHalo")} fill="none" stroke="currentColor" strokeOpacity="0.28" strokeWidth="1.2" />
        <path d={line("v")} fill="none" stroke="currentColor" strokeOpacity="0.85" strokeWidth="1.4" />
        <text x={pad.l} y={h - 4} className="fill-subtle" fontSize="9">
          0
        </text>
        <text x={w - 36} y={h - 4} className="fill-subtle" fontSize="9">
          {maxR.toFixed(0)} kpc
        </text>
        <text x={2} y={pad.t + 8} className="fill-subtle" fontSize="9">
          {Math.round(maxV)} km/s
        </text>
      </svg>
    </div>
  );
}
