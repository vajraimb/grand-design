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
  const inner = 1 - Math.min(1, r / p.radGalaxy);
  const bulge = Math.exp((-r * r) / (p.radCore * p.radCore * 0.7));
  if (onArm && rng() < 0.38 + inner * 0.1) {
    return 8200 + rng() * 5000;
  }
  if (bulge > 0.5) {
    return 3000 + rng() * 1600;
  }
  return 3600 + rng() * 2800 + inner * 800;
}

export function generateGalaxy(p: GalaxyParams, counts: QualityCounts): GalaxyBuffers {
  const rng = mulberry32(p.seed >>> 0);
  const stars = alloc(counts.stars);
  const dust = alloc(counts.dust);
  const hii = alloc(counts.hii);

  for (let i = 0; i < counts.stars; i++) {
    const r = sampleRadius(rng, p);
    const theta = sampleTheta(rng, r, p, 0.28);
    const onArm = Math.abs(Math.sin(theta)) < 0.45;
    const hot = onArm && i < counts.stars / 8;
    const giant = i < counts.stars / 160;
    const temp = hot ? 8800 + rng() * 5000 : diskTemp(r, p, rng, onArm);
    const mag = giant
      ? 0.7 + rng() * 0.3
      : hot
        ? 0.38 + rng() * 0.32
        : 0.1 + rng() * 0.28;
    const size = giant ? 7 + rng() * 4 : hot ? 3.6 + rng() * 2.2 : 1.6 + rng() * 1.6;
    writeParticle(stars, i, p, rng, {
      r,
      theta,
      temp,
      mag,
      size,
      zScale: 0.32 + (r / p.radGalaxy) * 0.12,
    });
  }

  const nucleus = Math.min(280, counts.stars);
  for (let i = 0; i < nucleus; i++) {
    const r = Math.pow(rng(), 1.7) * Math.min(1.05, p.radCore * 0.28);
    writeParticle(stars, i, p, rng, {
      r,
      theta: rng() * Math.PI * 2,
      temp: 3200 + rng() * 2000,
      mag: 0.35 + rng() * 0.4,
      size: 2.8 + rng() * 3.2,
      zScale: 0.5,
    });
  }

  for (let i = 0; i < counts.dust; i++) {
    const r = Math.min(Math.max(sampleRadius(rng, p), 0.6), p.radGalaxy * 1.4);
    const theta = sampleTheta(rng, r, p, 0.4);
    const warm = 0.18 + Math.min(r / p.radGalaxy, 1) * 0.22;
    writeParticle(dust, i, p, rng, {
      r,
      theta,
      temp: 2400,
      mag: 0.018 + rng() * 0.03,
      size: 4.5 + rng() * 5.5,
      zScale: 0.16,
      color: [0.42 * warm + 0.12, 0.18 * warm + 0.05, 0.04],
    });
  }

  const filaments = Math.max(18, Math.floor(counts.dust / 220));
  let fi = 0;
  for (let f = 0; f < filaments && fi < counts.dust; f++) {
    let r = p.radCore + rng() * (p.radGalaxy - p.radCore);
    const arm = rng() < 0.5 ? 0 : Math.PI;
    const n = 14 + Math.floor(rng() * 22);
    for (let j = 0; j < n && fi < counts.dust; j++, fi++) {
      r = Math.max(0.8, r + (rng() - 0.5) * 0.9);
      writeParticle(dust, counts.dust - 1 - fi, p, rng, {
        r,
        theta: arm + (rng() - 0.5) * 0.22,
        temp: 2200,
        mag: 0.022 + rng() * 0.03,
        size: 5 + rng() * 5,
        zScale: 0.12,
        color: [0.32, 0.12, 0.04],
      });
    }
  }

  for (let i = 0; i < counts.hii; i++) {
    const r = p.radCore * 0.9 + rng() * p.radGalaxy * 0.85;
    const theta = sampleTheta(rng, r, p, 0.55);
    const pink = rng() > 0.32;
    writeParticle(hii, i, p, rng, {
      r,
      theta,
      temp: 7000,
      mag: 0.12 + rng() * 0.18,
      size: 8 + rng() * 12,
      zScale: 0.14,
      color: pink ? [1.0, 0.32, 0.52] : [0.4, 0.68, 1.0],
    });
  }

  return { stars, dust, hii };
}

export function generateStaticCloud(spec: CloudSpec, seed: number) {
  const rng = mulberry32((seed + spec.id.length * 997) >>> 0);
  const n = spec.n;
  const pos = new Float32Array(n * 3);
  const color = new Float32Array(n * 3);
  const size = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const gx = gaussian(rng);
    const gy = gaussian(rng);
    const gz = gaussian(rng);
    pos[i * 3] = spec.x + gx * spec.rx;
    pos[i * 3 + 1] = spec.y + gy * spec.ry;
    pos[i * 3 + 2] = spec.z + gz * spec.rz;
    const flicker = 0.65 + rng() * 0.45;
    color[i * 3] = spec.color[0] * flicker;
    color[i * 3 + 1] = spec.color[1] * flicker;
    color[i * 3 + 2] = spec.color[2] * flicker;
    size[i] = 0.7 + rng() * 1.6;
  }
  return { pos, color, size, count: n };
}
