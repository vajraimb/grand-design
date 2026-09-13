import type { GalaxyParams } from "./types";

/** G in kpc · (km/s)² / M☉ — so r is in kpc, M in solar masses. */
const G_KPC = 4.30091e-6;
const SEC_PER_YEAR = 365.25 * 86400;
const KPC_TO_KM = 3.08567758129e16;

const BULGE_MASS = 1.6e10;
const DISK_MASS = 5.2e10;
const HALO_MASS = 9.0e11;
const HALO_C = 12;
const HALO_R200 = 210;

export function axisRatio(r: number, p: GalaxyParams) {
  const far = p.radGalaxy * 2;
  if (r < p.radCore) {
    return 1 + (r / Math.max(p.radCore, 1e-6)) * (p.ex1 - 1);
  }
  if (r <= p.radGalaxy) {
    const t = (r - p.radCore) / Math.max(p.radGalaxy - p.radCore, 1e-6);
    return p.ex1 + t * (p.ex2 - p.ex1);
  }
  if (r < far) {
    const t = (r - p.radGalaxy) / Math.max(far - p.radGalaxy, 1e-6);
    return p.ex2 + t * (1 - p.ex2);
  }
  return 1;
}

export function angularOffset(r: number, p: GalaxyParams) {
  return r * p.deltaAng;
}

function massPlummer(r: number, core: number) {
  const a = core * 0.42;
  return (BULGE_MASS * r * r * r) / Math.pow(r * r + a * a, 1.5);
}

function massExponentialDisk(r: number, radGalaxy: number) {
  const rd = radGalaxy / 3.1;
  const x = r / rd;
  return DISK_MASS * (1 - (1 + x) * Math.exp(-x));
}

function massNfw(r: number) {
  const rs = HALO_R200 / HALO_C;
  const x = r / rs;
  const gc = Math.log(1 + HALO_C) - HALO_C / (1 + HALO_C);
  return (HALO_MASS * (Math.log(1 + x) - x / (1 + x))) / gc;
}

/** Circular speed in km/s. Plummer bulge + exponential disk + optional NFW halo. */
export function circularSpeed(r: number, p: GalaxyParams) {
  if (r < 0.05) return 0;
  const mVis = massPlummer(r, p.radCore) + massExponentialDisk(r, p.radGalaxy);
  const mHalo = p.hasDarkMatter ? massNfw(r) : 0;
  return Math.sqrt((G_KPC * (mVis + mHalo)) / r);
}

/** Angular speed in radians per year. */
export function orbitalOmega(r: number, p: GalaxyParams) {
  const v = circularSpeed(r, p);
  if (v <= 0 || r < 0.05) return 0;
  const rKm = r * KPC_TO_KM;
  return (v / rKm) * SEC_PER_YEAR;
}

/** Kepler angular speed. `mu` is GM in scene-units³ / second². */
export function keplerOmega(r: number, mu: number) {
  const rr = Math.max(r, 1e-4);
  return Math.sqrt(mu / (rr * rr * rr));
}

/** Snodgrass solar law: equator laps the poles. `lat` in radians. */
export function solarOmega(lat: number, omegaEq: number) {
  const s2 = Math.sin(lat);
  const ss = s2 * s2;
  return omegaEq * (1 - 0.19 * ss - 0.14 * ss * ss);
}

export function sampleRotationCurve(p: GalaxyParams, n = 28) {
  const pts: { r: number; v: number }[] = [];
  const rMax = p.radGalaxy * 1.7;
  for (let i = 0; i < n; i++) {
    const r = 0.18 + (rMax - 0.18) * (i / (n - 1));
    pts.push({ r, v: circularSpeed(r, p) });
  }
  return pts;
}
