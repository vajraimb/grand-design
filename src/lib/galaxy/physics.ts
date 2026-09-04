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
  const x = r / Math.max(rd, 0.2);
  return DISK_MASS * (1 - Math.exp(-x) * (1 + x));
}

function massNfw(r: number) {
  const rs = HALO_R200 / HALO_C;
  const x = r / rs;
  const c = HALO_C;
  const norm = Math.log(1 + c) - c / (1 + c);
  const enclosed = Math.log(1 + x) - x / (1 + x);
  return HALO_MASS * (enclosed / Math.max(norm, 1e-6));
}

export function enclosedMass(r: number, p: GalaxyParams) {
  const rr = Math.max(r, 0.05);
  let m = massPlummer(rr, p.radCore) + massExponentialDisk(rr, p.radGalaxy);
  if (p.hasDarkMatter) m += massNfw(rr);
  return m;
}

/** Circular speed km/s. */
export function circularSpeed(r: number, p: GalaxyParams) {
  const rr = Math.max(r, 0.05);
  return Math.sqrt((G_KPC * enclosedMass(rr, p)) / rr);
}

/** Angular rate in radians per year (matches the orbit shader). */
export function orbitalOmega(r: number, p: GalaxyParams) {
  const v = circularSpeed(r, p);
  const omegaPerSec = v / (Math.max(r, 0.05) * KPC_TO_KM);
  return omegaPerSec * SEC_PER_YEAR;
}

export function rotationCurve(p: GalaxyParams, n = 48) {
  const pts: { r: number; v: number; vNoHalo: number }[] = [];
  const pNo = { ...p, hasDarkMatter: false };
  for (let i = 1; i <= n; i++) {
    const r = (p.radGalaxy * 1.35 * i) / n;
    pts.push({ r, v: circularSpeed(r, p), vNoHalo: circularSpeed(r, pNo) });
  }
  return pts;
}
