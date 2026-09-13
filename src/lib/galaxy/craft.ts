import * as THREE from "three";
import { blackbodyRgb } from "./blackbody";
import { LOCAL_FRAG, LOCAL_VERT } from "./shaders";

export type Craft = {
  group: THREE.Group;
  glow: THREE.Sprite;
  setThrust: (t: number, time: number) => void;
  dispose: () => void;
};

const HULL_VERT = /* glsl */ `
varying vec3 vWorldN;
varying vec3 vWorldP;
varying vec3 vObj;
varying vec3 vView;

void main() {
  vObj = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldP = wp.xyz;
  vWorldN = normalize(mat3(modelMatrix) * normal);
  vView = cameraPosition - wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const HULL_FRAG = /* glsl */ `
uniform float uThrust;
uniform float uTime;
varying vec3 vWorldN;
varying vec3 vWorldP;
varying vec3 vObj;
varying vec3 vView;

void main() {
  vec3 N = normalize(vWorldN);
  vec3 V = normalize(vView);
  float ndv = max(dot(N, V), 0.0);
  float fres = pow(1.0 - ndv, 3.1);

  vec3 toCore = normalize(-vWorldP + vec3(0.0002, 0.05, 0.0));
  float core = pow(max(dot(N, toCore), 0.0), 1.4);
  vec3 H = normalize(toCore + V);
  float spec = pow(max(dot(N, H), 0.0), 72.0);

  float belly = smoothstep(0.01, -0.012, vObj.y);
  float spine = smoothstep(0.004, 0.02, vObj.y);
  float aft = smoothstep(0.02, -0.14, vObj.z);

  vec3 graphite = vec3(0.07, 0.07, 0.08);
  vec3 nickel = vec3(0.28, 0.29, 0.32);
  vec3 ivory = vec3(0.82, 0.79, 0.72);

  vec3 albedo = mix(nickel, graphite, belly * 0.85);
  albedo = mix(albedo, ivory * 0.55, spine * 0.22);

  float rings = abs(sin(vObj.z * 72.0));
  float longi = abs(sin(atan(vObj.y, vObj.x) * 6.0));
  float seam = smoothstep(0.96, 1.0, rings) + smoothstep(0.97, 1.0, longi) * 0.5;
  albedo *= 1.0 - seam * 0.45;

  vec3 rim = ivory * fres * 1.15;
  vec3 specCol = ivory * spec * 0.28;
  float pulse = 0.8 + 0.2 * sin(uTime * 20.0);
  vec3 heat = vec3(1.0, 0.55, 0.22) * aft * uThrust * pulse * 0.55;

  vec3 col = albedo * (0.16 + core * 0.28 + ndv * 0.22) + rim + specCol + heat;
  gl_FragColor = vec4(col, 1.0);
}
`;

const WING_FRAG = /* glsl */ `
varying vec3 vWorldN;
varying vec3 vWorldP;
varying vec3 vObj;
varying vec3 vView;

void main() {
  vec3 N = normalize(vWorldN);
  vec3 V = normalize(vView);
  float ndv = max(dot(N, V), 0.0);
  float fres = pow(1.0 - ndv, 2.8);
  vec3 graphite = vec3(0.09, 0.09, 0.10);
  vec3 nickel = vec3(0.24, 0.25, 0.28);
  float leading = smoothstep(-0.04, 0.06, vObj.z);
  vec3 albedo = mix(graphite, nickel, leading * 0.5);
  vec3 rim = vec3(0.78, 0.76, 0.70) * fres * 0.7;
  vec3 col = albedo * (0.14 + ndv * 0.22) + rim;
  gl_FragColor = vec4(col, 1.0);
}
`;

const GLASS_FRAG = /* glsl */ `
varying vec3 vWorldN;
varying vec3 vWorldP;
varying vec3 vObj;
varying vec3 vView;

void main() {
  vec3 N = normalize(vWorldN);
  vec3 V = normalize(vView);
  float fres = pow(1.0 - max(dot(N, V), 0.0), 1.7);
  vec3 tint = vec3(0.03, 0.04, 0.055);
  vec3 sky = vec3(0.55, 0.62, 0.72);
  vec3 col = tint + sky * fres * 0.7;
  gl_FragColor = vec4(col, 0.78 + fres * 0.18);
}
`;

const BELL_FRAG = /* glsl */ `
uniform float uThrust;
uniform float uTime;
varying vec3 vWorldN;
varying vec3 vWorldP;
varying vec3 vObj;
varying vec3 vView;

void main() {
  vec3 N = normalize(vWorldN);
  vec3 V = normalize(vView);
  float ndv = dot(N, V);
  float inner = float(ndv < 0.04);
  float fres = pow(1.0 - abs(ndv), 2.2);
  vec3 metal = vec3(0.12, 0.12, 0.13) + vec3(0.45, 0.46, 0.48) * fres * 0.4;
  float pulse = 0.78 + 0.22 * sin(uTime * 26.0 + vObj.x * 40.0);
  vec3 fire = vec3(1.0, 0.62, 0.28) * (0.12 + uThrust * 1.1) * pulse;
  vec3 core = vec3(1.0, 0.92, 0.78) * uThrust * 0.55;
  vec3 col = mix(metal, fire + core, inner);
  gl_FragColor = vec4(col, 1.0);
}
`;

function lathe(pts: Array<[number, number]>, segs: number) {
  const v = pts.map(([y, r]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(v, segs);
  geo.rotateX(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

function foilWing() {
  const shape = new THREE.Shape();
  shape.moveTo(0.01, 0.048);
  shape.lineTo(0.125, 0.006);
  shape.lineTo(0.122, -0.01);
  shape.lineTo(0.01, -0.058);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.0044,
    bevelEnabled: true,
    bevelThickness: 0.0009,
    bevelSize: 0.0012,
    bevelSegments: 1,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -0.003, -0.018);
  geo.computeVertexNormals();
  return geo;
}

export function createCraft(glowMap: THREE.Texture, pixelRatio: number): Craft {
  const group = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];

  const hullMat = new THREE.ShaderMaterial({
    uniforms: { uThrust: { value: 0 }, uTime: { value: 0 } },
    vertexShader: HULL_VERT,
    fragmentShader: HULL_FRAG,
    toneMapped: false,
  });
  mats.push(hullMat);

  const hullGeo = lathe(
    [
      [0.26, 0.0],
      [0.245, 0.004],
      [0.22, 0.009],
      [0.18, 0.014],
      [0.12, 0.019],
      [0.05, 0.023],
      [0.0, 0.024],
      [-0.06, 0.022],
      [-0.12, 0.017],
      [-0.16, 0.013],
      [-0.185, 0.018],
      [-0.205, 0.008],
      [-0.22, 0.0],
    ],
    72,
  );
  geos.push(hullGeo);
  group.add(new THREE.Mesh(hullGeo, hullMat));

  const glassMat = new THREE.ShaderMaterial({
    uniforms: {},
    vertexShader: HULL_VERT,
    fragmentShader: GLASS_FRAG,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  mats.push(glassMat);
  const glassGeo = new THREE.SphereGeometry(0.02, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.55);
  glassGeo.rotateX(-Math.PI / 2);
  glassGeo.scale(1.05, 0.58, 1.15);
  glassGeo.translate(0, 0.012, 0.1);
  geos.push(glassGeo);
  group.add(new THREE.Mesh(glassGeo, glassMat));

  const wingMat = new THREE.ShaderMaterial({
    uniforms: {},
    vertexShader: HULL_VERT,
    fragmentShader: WING_FRAG,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  mats.push(wingMat);
  const wingGeo = foilWing();
  geos.push(wingGeo);
  const wingL = new THREE.Mesh(wingGeo, wingMat);
  const wingR = new THREE.Mesh(wingGeo, wingMat);
  wingR.scale.x = -1;
  wingL.rotation.z = 0.16;
  wingR.rotation.z = -0.16;
  group.add(wingL, wingR);

  const finGeo = new THREE.BoxGeometry(0.0022, 0.032, 0.038);
  finGeo.translate(0, 0.02, -0.05);
  geos.push(finGeo);
  group.add(new THREE.Mesh(finGeo, wingMat));

  const bellMat = new THREE.ShaderMaterial({
    uniforms: { uThrust: { value: 0 }, uTime: { value: 0 } },
    vertexShader: HULL_VERT,
    fragmentShader: BELL_FRAG,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  mats.push(bellMat);
  const bellGeo = lathe(
    [
      [0.0, 0.0015],
      [0.004, 0.006],
      [0.012, 0.009],
      [0.018, 0.006],
      [0.02, 0.002],
    ],
    20,
  );
  geos.push(bellGeo);
  const offsets: Array<[number, number, number]> = [
    [0, 0, -0.215],
    [0.012, 0.006, -0.205],
    [-0.012, 0.006, -0.205],
  ];
  for (const [x, y, z] of offsets) {
    const bell = new THREE.Mesh(bellGeo, bellMat);
    bell.position.set(x, y, z);
    group.add(bell);
  }

  const glowMat = new THREE.SpriteMaterial({
    map: glowMap,
    color: 0xffc090,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.22,
    toneMapped: false,
  });
  mats.push(glowMat);
  const glow = new THREE.Sprite(glowMat);
  glow.position.set(0, 0, -0.24);
  glow.scale.set(0.08, 0.08, 1);
  group.add(glow);

  const nPlume = 160;
  const pPos = new Float32Array(nPlume * 3);
  const pCol = new Float32Array(nPlume * 3);
  const pSize = new Float32Array(nPlume);
  const pMag = new Float32Array(nPlume);
  const pPhase = new Float32Array(nPlume);
  for (let i = 0; i < nPlume; i++) {
    const t = Math.pow(Math.random(), 0.55);
    const r = t * 0.022 * (0.35 + Math.random());
    const a = Math.random() * Math.PI * 2;
    const lane = Math.floor(Math.random() * 3);
    const ox = lane === 0 ? 0 : lane === 1 ? 0.012 : -0.012;
    const oy = lane === 0 ? 0 : 0.006;
    pPos[i * 3] = ox + Math.cos(a) * r;
    pPos[i * 3 + 1] = oy + Math.sin(a) * r * 0.55;
    pPos[i * 3 + 2] = -0.22 - t * 0.28;
    const rgb = blackbodyRgb(2200 + Math.random() * 2800 + (1 - t) * 1400);
    pCol[i * 3] = rgb[0];
    pCol[i * 3 + 1] = rgb[1];
    pCol[i * 3 + 2] = rgb[2];
    pSize[i] = 0.7 + Math.random() * 1.4;
    pMag[i] = 0.3 + Math.random() * 0.45;
    pPhase[i] = Math.random();
  }
  const plumeGeo = new THREE.BufferGeometry();
  plumeGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  plumeGeo.setAttribute("color", new THREE.BufferAttribute(pCol, 3));
  plumeGeo.setAttribute("pSize", new THREE.BufferAttribute(pSize, 1));
  plumeGeo.setAttribute("mag", new THREE.BufferAttribute(pMag, 1));
  plumeGeo.setAttribute("phase", new THREE.BufferAttribute(pPhase, 1));
  geos.push(plumeGeo);
  const plumeMat = new THREE.ShaderMaterial({
    uniforms: {
      uTick: { value: 0 },
      uPixelRatio: { value: pixelRatio },
      uSizeScale: { value: 5 },
      uOpacity: { value: 0 },
      uMinDist: { value: 0.04 },
      uMaxSize: { value: 22 },
      uNearSoft: { value: 0.05 },
      uCloseAmt: { value: 0 },
      uMap: { value: glowMap },
    },
    vertexShader: LOCAL_VERT,
    fragmentShader: LOCAL_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  mats.push(plumeMat);
  const plume = new THREE.Points(plumeGeo, plumeMat);
  plume.frustumCulled = false;
  group.add(plume);

  const mkLight = (color: number, pos: [number, number, number], s: number) => {
    const mat = new THREE.SpriteMaterial({
      map: glowMap,
      color,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.55,
      toneMapped: false,
    });
    mats.push(mat);
    const spr = new THREE.Sprite(mat);
    spr.position.set(...pos);
    spr.scale.set(s, s, 1);
    group.add(spr);
    return mat;
  };
  const port = mkLight(0xff5a4c, [-0.026, 0.002, 0.03], 0.012);
  const starboard = mkLight(0x6eeea0, [0.026, 0.002, 0.03], 0.012);
  const tail = mkLight(0xe8e4dc, [0, 0.018, -0.1], 0.01);

  group.visible = false;
  group.scale.setScalar(1.38);

  return {
    group,
    glow,
    setThrust: (t: number, time: number) => {
      hullMat.uniforms.uThrust.value = t;
      hullMat.uniforms.uTime.value = time;
      bellMat.uniforms.uThrust.value = t;
      bellMat.uniforms.uTime.value = time;
      glowMat.opacity = 0.08 + t * 0.45;
      glow.scale.setScalar(0.06 + t * 0.14);
      plumeMat.uniforms.uOpacity.value = 0.08 + t * 0.95;
      plumeMat.uniforms.uTick.value = time;
      plumeMat.uniforms.uSizeScale.value = 4 + t * 6;
      const blink = 0.55 + 0.45 * Math.sin(time * 7.5);
      port.opacity = 0.3 + blink * 0.4;
      starboard.opacity = 0.3 + (1 - blink) * 0.4;
      tail.opacity = 0.22 + t * 0.35;
    },
    dispose: () => {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
    },
  };
}
