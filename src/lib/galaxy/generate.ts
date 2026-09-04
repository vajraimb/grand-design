import { blackbodyRgb } from "./blackbody";
import type { CloudSpec } from "./landmarks";
import { angularOffset, axisRatio, orbitalOmega } from "./physics";
import { gaussian, mulberry32 } from "./rng";
import type { GalaxyBuffers, GalaxyParams, ParticleBuffers, QualityCounts } from "./types";

function alloc(n: number): ParticleBuffers {
  return {
    a: new Float32Array(n),
    b: new Float32Array(n),
    tilt: new Float32Array(n),
    theta0: new Float32Array(n),
    velTheta: new Float32Array(n),
    z: new Float32Array(n),
    size: new Float32Array(n),
    mag: new Float32Array(n),
    phase: new Float32Array(n),
    color: new Float32Array(n * 3),
    count: n,
  };
}

function writeParticle(
  buf: ParticleBuffers,
  i: number,
  p: GalaxyParams,
  rng: () => number,
  spec: {
    r: number;
    theta: number;
    temp: number;
    mag: number;
    size: number;
    zScale: number;
    color?: [number, number, number];
  },
) {
  const r = spec.r;
  const ratio = axisRatio(r, p);
  buf.a[i] = r;
  buf.b[i] = r * ratio;
  buf.tilt[i] = angularOffset(r, p);
  buf.theta0[i] = spec.theta;
  buf.velTheta[i] = orbitalOmega(Math.max(r, 0.2), p);
  const bulge = Math.exp((-r * r) / (p.radCore * p.radCore * 0.55));
  buf.z[i] = gaussian(rng) * spec.zScale * (0.22 + 0.78 * bulge);
  buf.size[i] = spec.size;
  buf.mag[i] = spec.mag;
  buf.phase[i] = rng();
  const [cr, cg, cb] = spec.color ?? blackbodyRgb(spec.temp);
  buf.color[i * 3] = cr;
  buf.color[i * 3 + 1] = cg;
  buf.color[i * 3 + 2] = cb;
}

function sampleRadius(rng: () => number, p: GalaxyParams) {
  const far = p.radGalaxy * 1.85;
  const u = rng();
  if (u < 0.16) {
    return p.radCore * Math.pow(rng(), 0.5);
  }
  if (u < 0.94) {
    const rd = p.radGalaxy / 3.2;
    const r = -rd * (Math.log(rng() + 1e-8) + Math.log(rng() + 1e-8));
    return Math.min(Math.max(r, 0.15), far);
  }
  return p.radGalaxy + rng() * (far - p.radGalaxy);
}

/** Nested ellipses overdensity sits at the apsides; pull disk particles there. */
function sampleTheta(rng: () => number, r: number, p: GalaxyParams, tight: number) {
  if (r < p.radCore * 0.72 || rng() > tight) {
    return rng() * Math.PI * 2;
  }
  const arm = rng() < 0.5 ? 0 : Math.PI;
  const spread = (rng() + rng() + rng() - 1.5) * 0.55;
  return arm + spread;
}

function diskTemp(r: number, p: GalaxyParams, rng: () => number, onArm: boolean) {
  const inner = Math.exp((-r * r) / (p.radCore * p.radCore * 1.8));
  let t = 3200 + inner * 2200 + rng() * 900;
  if (onArm) t += 1800 + rng() * 4200;
  if (r > p.radGalaxy * 0.85) t -= 400;
  return t;
}

export function generateGalaxy(params: GalaxyParams, counts: QualityCounts): GalaxyBuffers {
  const rng = mulberry32(params.seed);
  const stars = alloc(counts.stars);
  for (let i = 0; i < counts.stars; i++) {
    const r = sampleRadius(rng, params);
    const onArm = r > params.radCore * 0.7 && rng() < 0.62;
    const theta = sampleTheta(rng, r, params, onArm ? 0.78 : 0.18);
    const hot = onArm && rng() < 0.22;
    writeParticle(stars, i, params, rng, {
      r,
      theta,
      temp: diskTemp(r, params, rng, onArm),
      mag: hot ? 0.55 + rng() * 0.5 : 0.18 + rng() * 0.45,
      size: hot ? 0.085 + rng() * 0.05 : 0.035 + rng() * 0.04,
      zScale: 0.18 + (1 - r / (params.radGalaxy * 1.6)) * 0.22,
    });
  }

  const dust = alloc(counts.dust);
  for (let i = 0; i < counts.dust; i++) {
    const r = 0.8 + rng() * params.radGalaxy * 1.05;
    const theta = sampleTheta(rng, r, params, 0.84);
    writeParticle(dust, i, params, rng, {
      r,
      theta,
      temp: 1800,
      mag: 0.08 + rng() * 0.12,
      size: 0.09 + rng() * 0.08,
      zScale: 0.07,
      color: [0.42 + rng() * 0.12, 0.22 + rng() * 0.08, 0.12 + rng() * 0.05],
    });
  }

  const hii = alloc(counts.hii);
  for (let i = 0; i < counts.hii; i++) {
    const r = params.radCore * 0.9 + rng() * params.radGalaxy * 0.85;
    const theta = sampleTheta(rng, r, params, 0.92);
    writeParticle(hii, i, params, rng, {
      r,
      theta,
      temp: 9000 + rng() * 6000,
      mag: 0.7 + rng() * 0.35,
      size: 0.16 + rng() * 0.1,
      zScale: 0.05,
      color: [1, 0.38 + rng() * 0.22, 0.62 + rng() * 0.2],
    });
  }

  return { stars, dust, hii };
}

export function generateStaticCloud(spec: CloudSpec, seed: number) {
  const rng = mulberry32((seed ^ spec.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) >>> 0);
  const pos = new Float32Array(spec.n * 3);
  const color = new Float32Array(spec.n * 3);
  for (let i = 0; i < spec.n; i++) {
    const gx = gaussian(rng);
    const gy = gaussian(rng);
    const gz = gaussian(rng);
    pos[i * 3] = spec.x + gx * spec.rx;
    pos[i * 3 + 1] = spec.y + gy * spec.ry;
    pos[i * 3 + 2] = spec.z + gz * spec.rz;
    const k = 0.55 + rng() * 0.45;
    color[i * 3] = spec.color[0] * k;
    color[i * 3 + 1] = spec.color[1] * k;
    color[i * 3 + 2] = spec.color[2] * k;
  }
  return { pos, color };
}
