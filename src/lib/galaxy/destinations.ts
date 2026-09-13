import * as THREE from "three";
import { blackbodyRgb } from "./blackbody";
import { landmarksFor } from "./landmarks";
import { keplerOmega, solarOmega } from "./physics";
import { gaussian, mulberry32 } from "./rng";
import { LOCAL_FRAG, PHYS_VERT } from "./shaders";
import type { GalaxyParams, PresetId, Quality, WorldLandmark } from "./types";

const SHARED_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
varying vec3 vObj;
varying vec2 vUv;
void main() {
  vObj = position;
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vV = cameraPosition - wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const NOISE = /* glsl */ `
float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
float vnoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = hash13(i);
  float n100 = hash13(i + vec3(1,0,0));
  float n010 = hash13(i + vec3(0,1,0));
  float n110 = hash13(i + vec3(1,1,0));
  float n001 = hash13(i + vec3(0,0,1));
  float n101 = hash13(i + vec3(1,0,1));
  float n011 = hash13(i + vec3(0,1,1));
  float n111 = hash13(i + vec3(1,1,1));
  float nx00 = mix(n000, n100, f.x);
  float nx10 = mix(n010, n110, f.x);
  float nx01 = mix(n001, n101, f.x);
  float nx11 = mix(n011, n111, f.x);
  return mix(mix(nx00, nx10, f.y), mix(nx01, nx11, f.y), f.z);
}
float fbm(vec3 p) {
  float a = 0.5 * vnoise(p);
  a += 0.25 * vnoise(p * 2.07);
  a += 0.125 * vnoise(p * 4.13);
  a += 0.0625 * vnoise(p * 8.21);
  a += 0.03125 * vnoise(p * 16.43);
  return a;
}
float ridge(vec3 p) {
  return 1.0 - abs(2.0 * fbm(p) - 1.0);
}
vec3 warp(vec3 p) {
  return p + 0.42 * vec3(fbm(p), fbm(p + 17.2), fbm(p + 31.8));
}
`;

const SUN_VERT = /* glsl */ `
uniform float uTime;
uniform float uLod;
varying vec3 vN;
varying vec3 vV;
varying vec3 vObj;
varying vec2 vUv;
${NOISE}
void main() {
  vUv = uv;
  vec3 n = normalize(position);
  vObj = n;
  float h = (fbm(warp(n * mix(5.5, 14.0, uLod)) + uTime * 0.035) - 0.42);
  h *= mix(0.01, 0.032, uLod);
  vec3 pos = position + normalize(normal) * h;
  vec4 wp = modelMatrix * vec4(pos, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vV = cameraPosition - wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const SUN_FRAG = /* glsl */ `
uniform float uTime;
uniform float uLod;
varying vec3 vN;
varying vec3 vV;
varying vec3 vObj;
${NOISE}
void main() {
  vec3 n = normalize(vObj);
  vec3 v = normalize(vV);
  float mu = max(dot(normalize(vN), v), 0.0);
  float limb = pow(mu, mix(0.42, 0.7, uLod));

  float s2 = n.y * n.y;
  float om = 0.036 * (1.0 - 0.19 * s2 - 0.14 * s2 * s2);
  float ca = cos(om * uTime);
  float sa = sin(om * uTime);
  vec3 p = n;
  p.xz = mat2(ca, -sa, sa, ca) * p.xz;
  vec3 q = warp(p * mix(3.4, 9.5, uLod));
  q += 0.22 * vec3(fbm(q + uTime * 0.05), fbm(q + 9.0), fbm(q + 19.0));

  float flow = pow(ridge(q * 1.15), mix(1.4, 2.4, uLod));
  float moss = fbm(q * mix(2.8, 7.5, uLod) + vec3(uTime * 0.06));
  float lane = smoothstep(0.38, 0.62, fbm(q * mix(1.6, 4.2, uLod) + 4.1));
  float hot = pow(max(flow * moss, 0.0), mix(1.2, 2.1, uLod));
  float loop = pow(ridge(warp(p * mix(8.0, 22.0, uLod)) + uTime * 0.04), 3.2);

  vec3 dark = vec3(0.07, 0.01, 0.0);
  vec3 ember = vec3(0.72, 0.14, 0.01);
  vec3 fire = vec3(1.0, 0.32, 0.03);
  vec3 gold = vec3(1.0, 0.62, 0.12);
  vec3 white = vec3(1.0, 0.93, 0.72);

  vec3 col = mix(ember, fire, moss);
  col = mix(col, gold, flow * 0.75);
  col = mix(col, dark, lane * mix(0.45, 0.72, uLod));
  col = mix(col, white, hot * 0.55);
  col += gold * loop * mix(0.12, 0.35, uLod);
  col *= 0.55 + limb * 0.7;
  float rim = pow(1.0 - mu, mix(2.8, 3.6, uLod));
  col += vec3(1.0, 0.55, 0.12) * rim * 0.85;
  col += vec3(1.0, 0.9, 0.55) * pow(mu, 10.0) * mix(0.12, 0.04, uLod);
  gl_FragColor = vec4(col, 1.0);
}
`;

const SPICULE_FRAG = /* glsl */ `
uniform float uAlpha;
uniform float uTime;
uniform float uLod;
varying vec3 vN;
varying vec3 vV;
varying vec3 vObj;
${NOISE}
void main() {
  vec3 n = normalize(vObj);
  vec3 v = normalize(vV);
  float mu = max(dot(normalize(vN), v), 0.0);
  float edge = pow(1.0 - mu, mix(2.2, 3.4, uLod));
  float spike = pow(max(ridge(warp(n * mix(18.0, 42.0, uLod)) + vec3(0.0, uTime * 0.15, 0.0)) - 0.42, 0.0), 1.6);
  float a = edge * spike * uAlpha * 2.2;
  if (a < 0.02) discard;
  vec3 col = mix(vec3(1.0, 0.28, 0.02), vec3(1.0, 0.82, 0.35), spike) * a;
  gl_FragColor = vec4(col, a);
}
`;

const CORONA_FRAG = /* glsl */ `
uniform float uAlpha;
uniform float uTime;
uniform float uLod;
varying vec3 vN;
varying vec3 vV;
varying vec3 vObj;
${NOISE}
void main() {
  vec3 n = normalize(vObj);
  vec3 v = normalize(vV);
  float mu = max(dot(normalize(vN), v), 0.0);
  float stream = ridge(warp(n * mix(4.0, 14.0, uLod)) + vec3(0.0, uTime * 0.1, 0.0));
  float a = pow(1.0 - mu, 1.15) * uAlpha * pow(max(stream, 0.001), 1.4);
  if (a < 0.015) discard;
  vec3 col = mix(vec3(1.0, 0.35, 0.05), vec3(1.0, 0.78, 0.32), stream) * a;
  gl_FragColor = vec4(col, a);
}
`;

const PROM_FRAG = /* glsl */ `
uniform float uTime;
uniform float uAlpha;
varying vec3 vN;
varying vec3 vV;
varying vec2 vUv;
${NOISE}
void main() {
  float flow = fbm(vec3(vUv.x * 8.0, vUv.y * 12.0 - uTime * 0.55, 0.2));
  float core = 1.0 - abs(vUv.x - 0.5) * 2.0;
  float a = uAlpha * (0.25 + flow * 0.75) * pow(max(core, 0.0), 1.2);
  if (a < 0.02) discard;
  vec3 col = mix(vec3(1.0, 0.22, 0.02), vec3(1.0, 0.85, 0.4), flow);
  gl_FragColor = vec4(col * a * 1.6, a);
}
`;

const NEBULA_VERT = /* glsl */ `
uniform float uTime;
uniform float uLod;
varying vec3 vN;
varying vec3 vV;
varying vec3 vObj;
varying vec2 vUv;
${NOISE}
void main() {
  vUv = uv;
  vec3 n = normalize(position);
  float h = (fbm(n * 5.0 + uTime * 0.04) - 0.4) * mix(0.08, 0.22, uLod);
  vec3 pos = position + n * h;
  vObj = n;
  vec4 wp = modelMatrix * vec4(pos, 1.0);
  vN = normalize(mat3(modelMatrix) * n);
  vV = cameraPosition - wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const NEBULA_FRAG = /* glsl */ `
uniform float uTime;
uniform float uAlpha;
uniform float uLod;
uniform vec3 uHot;
uniform vec3 uMid;
uniform vec3 uCool;
varying vec3 vN;
varying vec3 vV;
varying vec3 vObj;
${NOISE}
void main() {
  vec3 n = normalize(vObj);
  vec3 v = normalize(vV);
  float mu = max(dot(normalize(vN), v), 0.0);
  vec3 q = warp(n * mix(3.0, 8.5, uLod) + uTime * 0.03);
  float dens = fbm(q);
  float fil = pow(ridge(q * 1.6), 2.0);
  float a = uAlpha * (0.22 + dens * 0.55 + fil * 0.4) * (0.35 + mu * 0.65);
  if (a < 0.02) discard;
  vec3 col = mix(uCool, mix(uMid, uHot, fil), dens);
  gl_FragColor = vec4(col * a * 1.5, a);
}
`;

const DISK_FRAG = /* glsl */ `
uniform float uTime;
uniform float uAlpha;
uniform float uLod;
varying vec3 vN;
varying vec3 vV;
varying vec2 vUv;
${NOISE}
void main() {
  float r = vUv.y;
  float theta = vUv.x * 6.2831853;
  float kepler = uTime * 0.48 / (0.12 + r * r);
  float a = theta - kepler;
  float freq = mix(1.2, 3.2, uLod);
  vec3 q = vec3(cos(a) * (0.45 + r), r * 2.4, sin(a) * (0.45 + r)) * freq;
  float turb = fbm(warp(q));
  float fil = pow(ridge(q * 1.25), 1.6);
  float dens = smoothstep(0.0, 0.1, r) * smoothstep(1.0, 0.78, r);
  dens *= 0.4 + 0.45 * turb + 0.28 * fil;
  float arm = 0.72 + 0.28 * sin(a * 2.0 + r * 2.4);
  dens *= arm;
  float temp = 1.0 - r * 0.85;
  vec3 hot = vec3(1.0, 0.93, 0.72);
  vec3 mid = vec3(1.0, 0.52, 0.2);
  vec3 cool = vec3(0.42, 0.1, 0.08);
  vec3 col = mix(cool, mix(mid, hot, temp * temp), temp);
  float doppler = 1.0 + 0.4 * sin(theta) * (1.0 - r * 0.4);
  col *= doppler;
  col = mix(col, vec3(0.62, 0.8, 1.0), clamp(doppler - 1.18, 0.0, 1.0) * 0.55);
  float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
  col += vec3(1.0, 0.82, 0.5) * rim * 0.28;
  float ao = dens * uAlpha;
  if (ao < 0.015) discard;
  gl_FragColor = vec4(col * ao * 1.7, ao);
}
`;

const TORUS_FRAG = /* glsl */ `
uniform float uTime;
uniform float uAlpha;
uniform float uLod;
uniform vec3 uHot;
uniform vec3 uMid;
uniform vec3 uCool;
varying vec3 vN;
varying vec3 vV;
varying vec3 vObj;
${NOISE}
void main() {
  float r = length(vObj.xz);
  float theta = atan(vObj.z, vObj.x);
  float kepler = uTime * 0.42 / (0.14 + r * r);
  float a = theta - kepler;
  vec3 q = vec3(cos(a) * r, vObj.y * 2.8, sin(a) * r);
  q = warp(q * mix(1.6, 3.8, uLod));
  float turb = fbm(q);
  float fil = pow(ridge(q * 1.3), 1.7);
  float arm = 0.7 + 0.3 * sin(a * 2.0 + r * 2.2);
  float dens = 0.5 + 0.38 * turb + 0.22 * fil;
  dens *= arm;
  dens *= smoothstep(0.12, 0.28, r);
  float temp = clamp(1.2 - r * 0.65, 0.0, 1.0);
  vec3 col = mix(uCool, mix(uMid, uHot, temp * temp), temp);
  float doppler = 1.0 + 0.36 * sin(theta) * (1.0 - r * 0.3);
  col *= doppler;
  col = mix(col, vec3(0.58, 0.78, 1.0), clamp(doppler - 1.16, 0.0, 1.0) * 0.5);
  float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
  col += uHot * fres * 0.38;
  float ao = dens * uAlpha;
  if (ao < 0.018) discard;
  gl_FragColor = vec4(col * ao * 1.65, ao);
}
`;

const PHOTON_FRAG = /* glsl */ `
uniform float uAlpha;
varying vec3 vN;
varying vec3 vV;
varying vec3 vObj;
void main() {
  vec3 n = normalize(vN);
  vec3 v = normalize(vV);
  float mu = max(dot(n, v), 0.0);
  float limb = 1.0 - mu;
  float ring = exp(-pow((limb - 0.11) / 0.048, 2.0));
  float halo = pow(limb, 2.6) * 0.42;
  float ang = atan(vObj.x, vObj.z);
  float dop = 0.52 + 0.7 * sin(ang + 0.35);
  vec3 gold = vec3(1.0, 0.86, 0.55);
  vec3 blue = vec3(0.62, 0.82, 1.0);
  vec3 ember = vec3(1.0, 0.42, 0.12);
  vec3 col = mix(ember, gold, dop);
  col = mix(col, blue, clamp(dop - 0.78, 0.0, 1.0));
  float a = uAlpha * (ring * 1.55 + halo);
  if (a < 0.02) discard;
  gl_FragColor = vec4(col * a * (0.7 + dop * 0.55), a);
}
`;

const JET_FRAG = /* glsl */ `
uniform float uTime;
uniform float uAlpha;
uniform float uLod;
varying vec3 vN;
varying vec3 vV;
varying vec3 vObj;
varying vec2 vUv;
${NOISE}
void main() {
  float t = vUv.y;
  float rho = length(vec2(vObj.x, vObj.z));
  vec3 q = warp(vec3(vObj.x * 5.0, vObj.y * 2.2 - uTime * 0.7, vObj.z * 5.0) * mix(1.0, 1.8, uLod));
  float flow = fbm(q);
  float core = exp(-rho * rho * 28.0);
  float sheath = exp(-rho * rho * 8.0) * (0.35 + 0.65 * flow);
  float fade = pow(1.0 - t, 1.15) * smoothstep(0.0, 0.08, t);
  float a = uAlpha * fade * (core * 1.35 + sheath * 0.55);
  if (a < 0.02) discard;
  vec3 col = mix(vec3(1.0, 0.55, 0.18), vec3(0.92, 0.95, 1.0), core + flow * 0.25);
  gl_FragColor = vec4(col * a * 1.5, a);
}
`;

function fade(d: number, near: number, far: number) {
  return 1 - THREE.MathUtils.smoothstep(near, far, d);
}

type Cloud = {
  pts: THREE.Points;
  geo: THREE.BufferGeometry;
  mat: THREE.ShaderMaterial;
};

type PhysSpec = {
  mode: number;
  a: number;
  b: number;
  tilt: number;
  theta0: number;
  velTheta: number;
  z: number;
  t: number;
  s: number;
  mag?: number;
};

function makeCloud(
  n: number,
  place: (i: number, rng: () => number) => PhysSpec,
  seed: number,
  map: THREE.Texture,
  sizeScale: number,
  minDist = 0.12,
): Cloud {
  const rng = mulberry32(seed >>> 0);
  const col = new Float32Array(n * 3);
  const a = new Float32Array(n);
  const b = new Float32Array(n);
  const tilt = new Float32Array(n);
  const theta0 = new Float32Array(n);
  const velTheta = new Float32Array(n);
  const z = new Float32Array(n);
  const psz = new Float32Array(n);
  const mag = new Float32Array(n);
  const phase = new Float32Array(n);
  const mode = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = place(i, rng);
    a[i] = p.a;
    b[i] = p.b;
    tilt[i] = p.tilt;
    theta0[i] = p.theta0;
    velTheta[i] = p.velTheta;
    z[i] = p.z;
    const rgb = blackbodyRgb(p.t);
    const f = 0.62 + rng() * 0.55;
    col[i * 3] = rgb[0] * f;
    col[i * 3 + 1] = rgb[1] * f;
    col[i * 3 + 2] = rgb[2] * f;
    psz[i] = p.s;
    mag[i] = p.mag ?? 0.42 + rng() * 0.5;
    phase[i] = rng();
    mode[i] = p.mode;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute("a", new THREE.BufferAttribute(a, 1));
  geo.setAttribute("b", new THREE.BufferAttribute(b, 1));
  geo.setAttribute("tilt", new THREE.BufferAttribute(tilt, 1));
  geo.setAttribute("theta0", new THREE.BufferAttribute(theta0, 1));
  geo.setAttribute("velTheta", new THREE.BufferAttribute(velTheta, 1));
  geo.setAttribute("z", new THREE.BufferAttribute(z, 1));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("pSize", new THREE.BufferAttribute(psz, 1));
  geo.setAttribute("mag", new THREE.BufferAttribute(mag, 1));
  geo.setAttribute("phase", new THREE.BufferAttribute(phase, 1));
  geo.setAttribute("mode", new THREE.BufferAttribute(mode, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uTick: { value: 0 },
      uPixelRatio: { value: Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2.5) },
      uSizeScale: { value: sizeScale },
      uOpacity: { value: 0 },
      uMinDist: { value: minDist },
      uMaxSize: { value: 9 },
      uNearSoft: { value: 1.05 },
      uCloseAmt: { value: 1 },
      uPertN: { value: 2 },
      uPertAmp: { value: 0 },
      uMap: { value: map },
    },
    vertexShader: PHYS_VERT,
    fragmentShader: LOCAL_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.visible = false;
  return { pts, geo, mat };
}

function tickCloud(c: Cloud, opacity: number, time: number, pr: number) {
  c.pts.visible = opacity > 0.03;
  c.mat.uniforms.uOpacity.value = opacity;
  c.mat.uniforms.uTime.value = time;
  c.mat.uniforms.uTick.value = time;
  c.mat.uniforms.uPixelRatio.value = pr;
}

function sphDir(rng: () => number) {
  const th = rng() * Math.PI * 2;
  const ph = Math.acos(2 * rng() - 1);
  return new THREE.Vector3(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th));
}

function makeProminences(R: number, seed: number) {
  const rng = mulberry32(seed >>> 0);
  const geos: THREE.BufferGeometry[] = [];
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 } },
    vertexShader: SHARED_VERT,
    fragmentShader: PROM_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const group = new THREE.Group();
  for (let i = 0; i < 18; i++) {
    const n0 = sphDir(rng);
    const axis = new THREE.Vector3(n0.z, 0, -n0.x);
    if (axis.lengthSq() < 1e-6) axis.set(1, 0, 0);
    axis.normalize();
    const n1 = n0.clone().applyAxisAngle(axis, (rng() - 0.5) * 1.15).normalize();
    const p0 = n0.clone().multiplyScalar(R * 0.995);
    const p1 = n1.clone().multiplyScalar(R * 0.995);
    const h = R * (0.08 + rng() * 0.32);
    const mid = n0.clone().add(n1).normalize().multiplyScalar(R + h);
    const curve = new THREE.QuadraticBezierCurve3(p0, mid, p1);
    const geo = new THREE.TubeGeometry(curve, 40, R * (0.0045 + rng() * 0.01), 6, false);
    geos.push(geo);
    group.add(new THREE.Mesh(geo, mat));
  }
  return { group, geos, mat };
}

type Palette = { hot: THREE.Vector3; mid: THREE.Vector3; cool: THREE.Vector3 };

const PALETTES: Record<string, Palette> = {
  lmc: {
    hot: new THREE.Vector3(1.0, 0.55, 0.42),
    mid: new THREE.Vector3(0.95, 0.28, 0.38),
    cool: new THREE.Vector3(0.28, 0.06, 0.1),
  },
  smc: {
    hot: new THREE.Vector3(0.55, 0.88, 1.0),
    mid: new THREE.Vector3(0.22, 0.48, 0.72),
    cool: new THREE.Vector3(0.05, 0.1, 0.22),
  },
  scutum: {
    hot: new THREE.Vector3(1.0, 0.72, 0.32),
    mid: new THREE.Vector3(0.72, 0.35, 0.1),
    cool: new THREE.Vector3(0.22, 0.08, 0.03),
  },
  sgr: {
    hot: new THREE.Vector3(1.0, 0.42, 0.55),
    mid: new THREE.Vector3(0.75, 0.16, 0.32),
    cool: new THREE.Vector3(0.28, 0.04, 0.1),
  },
  perseus: {
    hot: new THREE.Vector3(0.45, 0.95, 1.0),
    mid: new THREE.Vector3(0.18, 0.5, 0.7),
    cool: new THREE.Vector3(0.04, 0.12, 0.22),
  },
  outer: {
    hot: new THREE.Vector3(0.82, 0.88, 1.0),
    mid: new THREE.Vector3(0.4, 0.48, 0.62),
    cool: new THREE.Vector3(0.1, 0.12, 0.18),
  },
};

function paletteFor(id: string): Palette {
  if (PALETTES[id]) return PALETTES[id];
  const list = Object.values(PALETTES);
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return list[(h >>> 0) % list.length];
}

function makeNebula(radius: number, pal: Palette) {
  const geo = new THREE.IcosahedronGeometry(radius, 4);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uAlpha: { value: 0 },
      uLod: { value: 0 },
      uHot: { value: pal.hot },
      uMid: { value: pal.mid },
      uCool: { value: pal.cool },
    },
    vertexShader: NEBULA_VERT,
    fragmentShader: NEBULA_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  return { mesh, geo, mat };
}

function makeAccretionLathe(segments: number) {
  const profile: Array<[number, number]> = [
    [0.155, 0],
    [0.18, 0.055],
    [0.32, 0.12],
    [0.55, 0.24],
    [0.82, 0.3],
    [1.08, 0.18],
    [1.28, 0.07],
    [1.38, 0],
  ];
  const pts: THREE.Vector2[] = [];
  for (const [x, y] of profile) pts.push(new THREE.Vector2(x, y));
  for (let i = profile.length - 2; i >= 0; i--) pts.push(new THREE.Vector2(profile[i][0], -profile[i][1]));
  return new THREE.LatheGeometry(pts, segments);
}

type Part = {
  id: string;
  update: (ship: THREE.Vector3, fly: boolean, time: number, pr: number, targetId: string | null) => void;
  dispose: () => void;
};

export class ApproachWorld {
  readonly group = new THREE.Group();
  private parts: Part[] = [];
  private sunMarker: THREE.Sprite | null = null;
  private sunRings: THREE.Mesh[] = [];

  constructor(
    private tex: THREE.Texture,
    private quality: Quality,
  ) {}

  attachSunMarker(sprite: THREE.Sprite, rings: THREE.Mesh[]) {
    this.sunMarker = sprite;
    this.sunRings = rings;
  }

  rebuild(preset: PresetId, params: GalaxyParams, quality: Quality) {
    this.quality = quality;
    this.clear();
    const marks = landmarksFor(preset, params);
    const n = this.quality === "high" ? 1 : this.quality === "medium" ? 0.78 : 0.52;
    for (const m of marks) {
      if (m.kind === "sun") this.addSun(m, n);
      else if (m.kind === "center") this.addCore(m, n);
      else if (m.kind === "companion") this.addCompanion(m, n);
      else this.addArm(m, n);
    }
  }

  update(ship: THREE.Vector3, fly: boolean, time = 0, pr = 2, targetId: string | null = null) {
    for (const p of this.parts) p.update(ship, fly, time, pr, targetId);
  }

  dispose() {
    this.clear();
  }

  private clear() {
    for (const p of this.parts) p.dispose();
    this.parts = [];
    while (this.group.children.length) this.group.remove(this.group.children[0]);
  }

  private addSun(m: WorldLandmark, n: number) {
    const g = new THREE.Group();
    g.position.set(m.world.x, m.world.y, m.world.z);
    this.group.add(g);

    const R = 0.56;
    const bodyGeo = new THREE.SphereGeometry(R, 256, 192);
    const bodyMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uLod: { value: 0 } },
      vertexShader: SUN_VERT,
      fragmentShader: SUN_FRAG,
      toneMapped: false,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    g.add(body);

    const spicGeo = new THREE.SphereGeometry(R * 1.045, 128, 96);
    const spicMat = new THREE.ShaderMaterial({
      uniforms: { uAlpha: { value: 0 }, uTime: { value: 0 }, uLod: { value: 0 } },
      vertexShader: SUN_VERT,
      fragmentShader: SPICULE_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      toneMapped: false,
    });
    const spicules = new THREE.Mesh(spicGeo, spicMat);
    g.add(spicules);

    const shells: THREE.Mesh[] = [];
    const coronaRes: Array<{ geo: THREE.BufferGeometry; mat: THREE.ShaderMaterial }> = [];
    const coronaMat = (alpha: number, scale: number, segs: number) => {
      const geo = new THREE.SphereGeometry(R * scale, segs, Math.max(24, (segs / 3) | 0));
      const mat = new THREE.ShaderMaterial({
        uniforms: { uAlpha: { value: alpha }, uTime: { value: 0 }, uLod: { value: 0 } },
        vertexShader: SUN_VERT,
        fragmentShader: CORONA_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        toneMapped: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      g.add(mesh);
      shells.push(mesh);
      coronaRes.push({ geo, mat });
      return mat;
    };
    const c1 = coronaMat(0.55, 1.28, 96);
    const c2 = coronaMat(0.22, 1.95, 72);

    const proms = makeProminences(R, 91);
    g.add(proms.group);

    const field = makeCloud(
      Math.floor(4200 * n),
      (_i, rng) => {
        const r = 1.4 + Math.pow(rng(), 0.42) * 4.6;
        return {
          mode: 0,
          a: r,
          b: r,
          tilt: 0,
          theta0: rng() * Math.PI * 2,
          velTheta: keplerOmega(r, 0.55),
          z: (rng() - 0.5) * 0.48 * r * 0.2 + gaussian(rng) * 0.07,
          t: 3800 + rng() * 7200,
          s: 1.0 + rng() * 1.8,
          mag: 0.28 + rng() * 0.5,
        };
      },
      414,
      this.tex,
      14,
      0.14,
    );
    g.add(field.pts);

    const closeField = makeCloud(
      Math.floor(3600 * n),
      (_i, rng) => {
        const r = 0.85 + Math.pow(rng(), 0.5) * 2.4;
        return {
          mode: 0,
          a: r,
          b: r,
          tilt: 0,
          theta0: rng() * Math.PI * 2,
          velTheta: keplerOmega(r, 0.55),
          z: (rng() - 0.5) * 0.7 * r * 0.28 + gaussian(rng) * 0.05,
          t: 4200 + rng() * 8000,
          s: 0.7 + rng() * 1.2,
          mag: 0.35 + rng() * 0.5,
        };
      },
      808,
      this.tex,
      9,
      0.08,
    );
    closeField.mat.uniforms.uMaxSize.value = 6.5;
    closeField.mat.uniforms.uNearSoft.value = 0.7;
    g.add(closeField.pts);

    const wind = makeCloud(
      Math.floor(1800 * n),
      (_i, rng) => {
        const lat = (rng() - 0.5) * 1.1;
        return {
          mode: 1,
          a: R * (1.08 + rng() * 0.55),
          b: lat,
          tilt: 0,
          theta0: rng() * Math.PI * 2,
          velTheta: solarOmega(lat, 0.36),
          z: 0,
          t: 4800 + rng() * 5000,
          s: 0.7 + rng() * 1.1,
          mag: 0.22 + rng() * 0.4,
        };
      },
      909,
      this.tex,
      8,
      0.08,
    );
    g.add(wind.pts);

    this.parts.push({
      id: m.id,
      update: (ship, fly, time, pr, targetId) => {
        const d = ship.distanceTo(g.position);
        const aimed = targetId === m.id;
        const vis = fly ? fade(d, 0.55, aimed ? 12 : 9) : 0;
        const lod = fly ? fade(d, 0.7, 5.5) : 0;
        g.visible = vis > 0.02;
        body.visible = vis > 0.06;
        bodyMat.uniforms.uTime.value = time;
        bodyMat.uniforms.uLod.value = lod;
        spicules.visible = vis > 0.08;
        spicMat.uniforms.uTime.value = time;
        spicMat.uniforms.uLod.value = lod;
        spicMat.uniforms.uAlpha.value = vis * (0.35 + lod * 0.85);
        const coronaFade = vis * (0.22 + 0.78 * (1 - lod * 0.55));
        for (const s of shells) s.visible = coronaFade > 0.04;
        c1.uniforms.uTime.value = time;
        c2.uniforms.uTime.value = time;
        c1.uniforms.uLod.value = lod;
        c2.uniforms.uLod.value = lod;
        c1.uniforms.uAlpha.value = 0.55 * coronaFade;
        c2.uniforms.uAlpha.value = 0.22 * coronaFade;
        proms.group.visible = vis > 0.1;
        proms.mat.uniforms.uTime.value = time;
        proms.mat.uniforms.uAlpha.value = vis * (0.25 + lod * 0.85);
        proms.group.rotation.y = time * 0.026;
        tickCloud(field, vis * (0.55 + 0.45 * (1 - lod * 0.5)), time, pr);
        tickCloud(closeField, vis * lod, time, pr);
        tickCloud(wind, vis * (0.35 + lod * 0.5), time, pr);
        if (this.sunMarker) {
          const far = fly ? 1 - fade(d, 1.6, 7) : 1;
          this.sunMarker.material.opacity = far;
          this.sunMarker.visible = far > 0.04;
          const spriteScale = fly ? Math.min(1.6, 0.85 + 0.7 / Math.max(0.8, d)) : 0.95;
          this.sunMarker.scale.set(spriteScale, spriteScale, 1);
        }
        for (const ring of this.sunRings) ring.visible = !fly;
      },
      dispose: () => {
        bodyGeo.dispose();
        bodyMat.dispose();
        spicGeo.dispose();
        spicMat.dispose();
        for (const c of coronaRes) {
          c.geo.dispose();
          c.mat.dispose();
        }
        for (const geo of proms.geos) geo.dispose();
        proms.mat.dispose();
        field.geo.dispose();
        field.mat.dispose();
        closeField.geo.dispose();
        closeField.mat.dispose();
        wind.geo.dispose();
        wind.mat.dispose();
      },
    });
  }

  private addCore(m: WorldLandmark, n: number) {
    const g = new THREE.Group();
    g.position.set(m.world.x, m.world.y, m.world.z);
    this.group.add(g);

    const pal: Palette = {
      hot: new THREE.Vector3(1.0, 0.9, 0.68),
      mid: new THREE.Vector3(1.0, 0.48, 0.18),
      cool: new THREE.Vector3(0.38, 0.08, 0.1),
    };

    const engine = new THREE.Group();
    engine.rotation.set(1.05, 0.55, 0.14);
    g.add(engine);

    const holeGeo = new THREE.SphereGeometry(0.15, 64, 48);
    const holeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const hole = new THREE.Mesh(holeGeo, holeMat);
    engine.add(hole);

    const photonGeo = new THREE.SphereGeometry(0.185, 64, 48);
    const photonMat = new THREE.ShaderMaterial({
      uniforms: { uAlpha: { value: 0 } },
      vertexShader: SHARED_VERT,
      fragmentShader: PHOTON_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const photon = new THREE.Mesh(photonGeo, photonMat);
    engine.add(photon);

    const glowGeo = new THREE.SphereGeometry(0.26, 48, 32);
    const glowMat = new THREE.ShaderMaterial({
      uniforms: { uAlpha: { value: 0 }, uTime: { value: 0 }, uLod: { value: 0 } },
      vertexShader: SUN_VERT,
      fragmentShader: CORONA_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      toneMapped: false,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    engine.add(glow);

    const MU = 0.42;
    const disk = makeCloud(
      Math.floor(7200 * n),
      (_i, rng) => {
        const r = 0.22 + Math.pow(rng(), 0.55) * 1.18;
        const onArm = rng() < 0.64;
        const spiral = Math.log(Math.max(r, 0.2)) * 2.4;
        const theta0 = onArm
          ? (rng() < 0.5 ? 0 : Math.PI) + spiral + (rng() + rng() - 1) * 0.38
          : rng() * Math.PI * 2;
        return {
          mode: 0,
          a: r,
          b: r,
          tilt: 0,
          theta0,
          velTheta: keplerOmega(r, MU),
          z: gaussian(rng) * (0.018 + r * 0.04),
          t: 2200 + (1.4 - r) * 4800 + rng() * 700,
          s: 1.05 + rng() * 1.9,
          mag: 0.32 + rng() * 0.5,
        };
      },
      23,
      this.tex,
      12,
      0.08,
    );
    engine.add(disk.pts);

    const inner = makeCloud(
      Math.floor(2800 * n),
      (_i, rng) => {
        const r = 0.2 + Math.pow(rng(), 0.7) * 0.42;
        return {
          mode: 0,
          a: r,
          b: r,
          tilt: 0,
          theta0: rng() * Math.PI * 2,
          velTheta: keplerOmega(r, MU),
          z: gaussian(rng) * 0.012,
          t: 6500 + rng() * 4500,
          s: 0.8 + rng() * 1.3,
          mag: 0.4 + rng() * 0.5,
        };
      },
      41,
      this.tex,
      9,
      0.07,
    );
    inner.mat.uniforms.uMaxSize.value = 6.2;
    engine.add(inner.pts);

    const jets = makeCloud(
      Math.floor(2400 * n),
      (_i, rng) => ({
        mode: 3,
        a: 0.04 + rng() * 0.08,
        b: rng() < 0.5 ? 1 : -1,
        tilt: rng() * Math.PI * 2,
        theta0: rng(),
        velTheta: 0.12 + rng() * 0.08,
        z: 0,
        t: 7000 + rng() * 5000,
        s: 1.0 + rng() * 1.6,
        mag: 0.28 + rng() * 0.45,
      }),
      61,
      this.tex,
      11,
      0.1,
    );
    engine.add(jets.pts);

    const neb = makeNebula(0.95, pal);
    neb.mesh.scale.set(1.7, 0.42, 1.7);
    engine.add(neb.mesh);

    const cluster = makeCloud(
      Math.floor(7200 * n),
      (_i, rng) => {
        const u = Math.max(rng(), 1e-4);
        const den = Math.pow(u, -2 / 3) - 1;
        const rr = Math.min(2.6, 0.28 / Math.sqrt(Math.max(den, 1e-4)));
        return {
          mode: 2,
          a: rr,
          b: rr * (0.72 + rng() * 0.28),
          tilt: rng() * Math.PI * 2,
          theta0: rng() * Math.PI * 2,
          velTheta: keplerOmega(rr, 0.85),
          z: 0,
          t: 3200 + rng() * 9000,
          s: 1.0 + rng() * 1.8,
          mag: 0.3 + rng() * 0.52,
        };
      },
      17,
      this.tex,
      13,
      0.14,
    );
    g.add(cluster.pts);

    const nucleus = makeCloud(
      Math.floor(3600 * n),
      (_i, rng) => {
        const u = Math.max(rng(), 1e-4);
        const den = Math.pow(u, -2 / 3) - 1;
        const rr = Math.min(0.95, 0.12 / Math.sqrt(Math.max(den, 1e-4)));
        return {
          mode: 2,
          a: rr,
          b: rr * (0.7 + rng() * 0.3),
          tilt: rng() * Math.PI * 2,
          theta0: rng() * Math.PI * 2,
          velTheta: keplerOmega(rr, 0.85),
          z: 0,
          t: 3800 + rng() * 9500,
          s: 0.6 + rng() * 1.05,
          mag: 0.42 + rng() * 0.5,
        };
      },
      29,
      this.tex,
      8,
      0.07,
    );
    nucleus.mat.uniforms.uMaxSize.value = 6.0;
    nucleus.mat.uniforms.uNearSoft.value = 0.65;
    g.add(nucleus.pts);

    this.parts.push({
      id: m.id,
      update: (ship, fly, time, pr, targetId) => {
        const d = ship.distanceTo(g.position);
        const aimed = targetId === m.id;
        const vis = fly ? fade(d, 0.75, aimed ? 14 : 10) : 0;
        const lod = fly ? fade(d, 0.9, 6.5) : 0;
        g.visible = vis > 0.02;
        tickCloud(cluster, vis * (0.7 + 0.3 * (1 - lod * 0.4)), time, pr);
        tickCloud(nucleus, vis * lod, time, pr);
        tickCloud(disk, vis * 0.9, time, pr);
        tickCloud(inner, vis * (0.55 + lod * 0.45), time, pr);
        tickCloud(jets, vis * 0.8, time, pr);
        hole.visible = vis > 0.12;
        photon.visible = vis > 0.1;
        photonMat.uniforms.uAlpha.value = vis * (0.55 + lod * 0.7);
        glow.visible = vis > 0.1;
        glowMat.uniforms.uTime.value = time;
        glowMat.uniforms.uLod.value = lod;
        glowMat.uniforms.uAlpha.value = vis * (0.4 + lod * 0.5);
        neb.mesh.visible = vis > 0.08;
        neb.mat.uniforms.uTime.value = time;
        neb.mat.uniforms.uAlpha.value = vis * (0.28 + lod * 0.45);
        neb.mat.uniforms.uLod.value = lod;
      },
      dispose: () => {
        cluster.geo.dispose();
        cluster.mat.dispose();
        nucleus.geo.dispose();
        nucleus.mat.dispose();
        disk.geo.dispose();
        disk.mat.dispose();
        inner.geo.dispose();
        inner.mat.dispose();
        jets.geo.dispose();
        jets.mat.dispose();
        holeGeo.dispose();
        holeMat.dispose();
        photonGeo.dispose();
        photonMat.dispose();
        glowGeo.dispose();
        glowMat.dispose();
        neb.geo.dispose();
        neb.mat.dispose();
      },
    });
  }

  private addCompanion(m: WorldLandmark, n: number) {
    const g = new THREE.Group();
    g.position.set(m.world.x, m.world.y, m.world.z);
    this.group.add(g);
    const pal = paletteFor(m.id);
    const compact = m.id === "smc" || m.id === "m32";
    const diskScale = compact ? 1.15 : 1.85;
    const mu = compact ? 0.3 : 0.48;
    const winding = m.id === "lmc" || m.id === "n5195" ? 0.38 : compact ? 0.18 : 0.28;

    const disk = makeCloud(
      Math.floor((compact ? 3200 : 5200) * n),
      (_i, rng) => {
        const r = 0.14 + Math.pow(rng(), 0.65) * diskScale;
        const onArm = rng() < 0.58;
        const theta = onArm
          ? (rng() < 0.5 ? 0 : Math.PI) + (rng() + rng() + rng() - 1.5) * 0.5
          : rng() * Math.PI * 2;
        return {
          mode: 4,
          a: r,
          b: r * (compact ? 0.84 : 0.68),
          tilt: r * winding,
          theta0: theta,
          velTheta: keplerOmega(r, mu),
          z: gaussian(rng) * (compact ? 0.18 : 0.12) * (0.4 + r * 0.3),
          t: compact ? 5200 + rng() * 4800 : 3200 + rng() * 4200,
          s: 1.1 + rng() * 1.8,
          mag: 0.28 + rng() * 0.48,
        };
      },
      m.id.length * 131,
      this.tex,
      13,
      0.14,
    );
    disk.mat.uniforms.uPertN.value = 2;
    disk.mat.uniforms.uPertAmp.value = m.id === "lmc" ? 0.58 : compact ? 0.22 : 0.4;
    g.add(disk.pts);

    const bulge = makeCloud(
      Math.floor(1800 * n),
      (_i, rng) => {
        const rr = Math.pow(rng(), 0.55) * (compact ? 0.38 : 0.55);
        return {
          mode: 2,
          a: rr,
          b: rr * (0.7 + rng() * 0.3),
          tilt: rng() * Math.PI * 2,
          theta0: rng() * Math.PI * 2,
          velTheta: keplerOmega(rr, mu * 1.4),
          z: 0,
          t: compact ? 4000 + rng() * 3000 : 3000 + rng() * 2400,
          s: 1.2 + rng() * 2.0,
          mag: 0.4 + rng() * 0.4,
        };
      },
      m.id.length * 197,
      this.tex,
      12,
      0.12,
    );
    g.add(bulge.pts);

    const neb = makeNebula(compact ? 0.42 : 0.62, pal);
    neb.mesh.position.set(compact ? 0.15 : 0.45, 0.05, compact ? -0.1 : 0.2);
    g.add(neb.mesh);

    this.parts.push({
      id: m.id,
      update: (ship, fly, time, pr, targetId) => {
        const d = ship.distanceTo(g.position);
        const aimed = targetId === m.id;
        const vis = fly ? fade(d, 0.9, aimed ? 12 : 8.5) : 0;
        const lod = fly ? fade(d, 1.0, 7) : 0;
        g.visible = vis > 0.02;
        tickCloud(disk, vis, time, pr);
        tickCloud(bulge, vis, time, pr);
        neb.mesh.visible = vis > 0.08;
        neb.mat.uniforms.uTime.value = time;
        neb.mat.uniforms.uAlpha.value = vis * (0.4 + lod * 0.7);
        neb.mat.uniforms.uLod.value = lod;
      },
      dispose: () => {
        disk.geo.dispose();
        disk.mat.dispose();
        bulge.geo.dispose();
        bulge.mat.dispose();
        neb.geo.dispose();
        neb.mat.dispose();
      },
    });
  }

  private addArm(m: WorldLandmark, n: number) {
    const g = new THREE.Group();
    g.position.set(m.world.x, m.world.y, m.world.z);
    this.group.add(g);
    const pal = paletteFor(m.id);
    const seed = m.id.length * 409;

    const field = makeCloud(
      Math.floor(3800 * n),
      (_i, rng) => ({
        mode: 5,
        a: 4.2,
        b: gaussian(rng) * 0.42,
        tilt: 0,
        theta0: rng(),
        velTheta: 0.035 + rng() * 0.02,
        z: gaussian(rng) * 0.14,
        t: 4000 + rng() * 7500,
        s: 1.0 + rng() * 1.8,
        mag: 0.26 + rng() * 0.5,
      }),
      seed,
      this.tex,
      13,
      0.14,
    );
    g.add(field.pts);

    const dust = makeCloud(
      Math.floor(1200 * n),
      (_i, rng) => ({
        mode: 5,
        a: 3.6,
        b: gaussian(rng) * 0.22,
        tilt: 0,
        theta0: rng(),
        velTheta: 0.028 + rng() * 0.015,
        z: gaussian(rng) * 0.06,
        t: 2200,
        s: 2.2 + rng() * 3.0,
        mag: 0.07 + rng() * 0.1,
      }),
      seed + 811,
      this.tex,
      14,
      0.16,
    );
    g.add(dust.pts);

    const hii = makeCloud(
      Math.floor(360 * n),
      (_i, rng) => ({
        mode: 5,
        a: 3.8,
        b: gaussian(rng) * 0.28,
        tilt: 0,
        theta0: rng(),
        velTheta: 0.04 + rng() * 0.02,
        z: gaussian(rng) * 0.08,
        t: 9000 + rng() * 4000,
        s: 2.2 + rng() * 3.2,
        mag: 0.35 + rng() * 0.4,
      }),
      seed + 307,
      this.tex,
      14,
      0.14,
    );
    g.add(hii.pts);

    const neb = makeNebula(0.55, pal);
    neb.mesh.scale.set(1.6, 0.55, 1.1);
    g.add(neb.mesh);

    this.parts.push({
      id: m.id,
      update: (ship, fly, time, pr, targetId) => {
        const d = ship.distanceTo(g.position);
        const aimed = targetId === m.id;
        const vis = fly ? fade(d, 0.85, aimed ? 9 : 6.8) : 0;
        const lod = fly ? fade(d, 0.9, 6) : 0;
        g.visible = vis > 0.02;
        tickCloud(field, vis, time, pr);
        tickCloud(dust, vis * 0.65, time, pr);
        tickCloud(hii, vis * 0.8, time, pr);
        neb.mesh.visible = vis > 0.08;
        neb.mat.uniforms.uTime.value = time;
        neb.mat.uniforms.uAlpha.value = vis * (0.35 + lod * 0.65);
        neb.mat.uniforms.uLod.value = lod;
      },
      dispose: () => {
        field.geo.dispose();
        field.mat.dispose();
        dust.geo.dispose();
        dust.mat.dispose();
        hii.geo.dispose();
        hii.mat.dispose();
        neb.geo.dispose();
        neb.mat.dispose();
      },
    });
  }
}
