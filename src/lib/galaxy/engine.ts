import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { generateGalaxy, generateStaticCloud } from "./generate";
import { companionClouds, landmarksFor, projectLandmarks } from "./landmarks";
import { QUALITY_COUNTS } from "./presets";
import { STAR_FRAG, STAR_VERT } from "./shaders";
import { useEngineStats, useGalaxyStore, useLandmarkScreen } from "./store";
import type { GalaxyParams, ParticleBuffers, ScreenLabel } from "./types";

type Snapshot = ReturnType<typeof useGalaxyStore.getState>;

function glowTexture(size = 64) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  if (!g) throw new Error("2d");
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.18, "rgba(255,255,255,0.82)");
  grd.addColorStop(0.42, "rgba(255,255,255,0.28)");
  grd.addColorStop(0.7, "rgba(255,255,255,0.06)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function haloStars(n: number) {
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = 90 + Math.random() * 80;
    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.cos(phi);
    pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    const t = 0.72 + Math.random() * 0.28;
    col[i * 3] = t;
    col[i * 3 + 1] = t * (0.9 + Math.random() * 0.1);
    col[i * 3 + 2] = 1;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.55,
    vertexColors: true,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return { pts, geo, mat };
}

function labelsEq(a: ScreenLabel[], b: ScreenLabel[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const p = a[i];
    const q = b[i];
    if (p.id !== q.id || p.anchor !== q.anchor) return false;
    if (Math.abs(p.x - q.x) > 0.6 || Math.abs(p.y - q.y) > 0.6) return false;
  }
  return true;
}

export class GalaxyEngine {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private galaxy = new THREE.Group();
  private tex: THREE.CanvasTexture;
  private halo: ReturnType<typeof haloStars>;
  private layers: {
    stars?: THREE.Points;
    dust?: THREE.Points;
    hii?: THREE.Points;
  } = {};
  private companions: THREE.Points[] = [];
  private companionGeos: THREE.BufferGeometry[] = [];
  private companionMats: THREE.PointsMaterial[] = [];
  private mats: THREE.ShaderMaterial[] = [];
  private geos: THREE.BufferGeometry[] = [];
  private sprites: THREE.Sprite[] = [];
  private spriteMats: THREE.SpriteMaterial[] = [];
  private sunSprite: THREE.Sprite | null = null;
  private sunRings: THREE.Mesh[] = [];
  private ro: ResizeObserver;
  private disposed = false;
  private last = performance.now();
  private fpsAccum = 0;
  private fpsFrames = 0;
  private simYear = 0;
  private builtKey = "";
  private lastInc = -1;
  private parent: HTMLElement;
  private regenTimer = 0;
  private labelAccum = 0;
  private proj = new THREE.Vector3();

  constructor(private canvas: HTMLCanvasElement) {
    const parent = canvas.parentElement ?? document.body;
    this.parent = parent;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
      stencil: false,
    });
    this.renderer.setClearColor(0x050508, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(52, 1, 0.15, 400);
    this.scene.add(this.galaxy);

    this.tex = glowTexture(64);
    this.halo = haloStars(1400);
    this.scene.add(this.halo.pts);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.055;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 90;
    this.controls.autoRotateSpeed = 0.32;
    this.controls.enablePan = true;
    this.controls.target.set(0, 0, 0);

    this.resize();
    this.sync(true);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(parent);

    this.renderer.setAnimationLoop(() => this.tick());
  }

  private resize() {
    const w = Math.max(1, this.parent.clientWidth);
    const h = Math.max(1, this.parent.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const pr = this.renderer.getPixelRatio();
    for (const m of this.mats) m.uniforms.uPixelRatio.value = pr;
  }

  private regenKey(s: Snapshot) {
    const p = s.params;
    return [
      s.preset,
      s.quality,
      p.seed,
      p.radGalaxy,
      p.radCore,
      p.deltaAng,
      p.ex1,
      p.ex2,
      p.hasDarkMatter,
    ].join("|");
  }

  sync(force = false) {
    const s = useGalaxyStore.getState();
    this.applyLive(s);
    const key = this.regenKey(s);
    if (!force && key === this.builtKey) return;
    const run = () => {
      if (this.disposed) return;
      const s2 = useGalaxyStore.getState();
      this.rebuild(s2);
      this.builtKey = this.regenKey(s2);
      this.applyLive(s2);
      this.publishLabels(s2, true);
    };
    if (force) {
      window.clearTimeout(this.regenTimer);
      run();
      return;
    }
    window.clearTimeout(this.regenTimer);
    this.regenTimer = window.setTimeout(run, 140);
  }

  private applyLive(s: Snapshot) {
    this.controls.autoRotate = s.autoRotate && !s.paused;
    if (this.layers.dust) this.layers.dust.visible = s.showDust;
    if (this.layers.hii) this.layers.hii.visible = s.showHii;
    if (this.sunSprite) this.sunSprite.visible = s.showLabels;
    for (const ring of this.sunRings) ring.visible = s.showLabels;
    for (const m of this.mats) {
      m.uniforms.uPertN.value = s.params.pertN;
      m.uniforms.uPertAmp.value = s.params.pertAmp;
      m.uniforms.uBrightness.value = s.brightness;
    }
    if (Math.abs(s.params.inclination - this.lastInc) > 0.05) {
      this.placeCamera(s.params.inclination);
      this.lastInc = s.params.inclination;
    }
    this.publishLabels(s);
  }

  private placeCamera(inclination: number) {
    const dist =
      this.lastInc < 0 ? 28 : Math.min(90, Math.max(8, this.camera.position.length() || 28));
    const inc = THREE.MathUtils.degToRad(inclination);
    this.camera.position.set(0, dist * Math.cos(inc), dist * Math.sin(inc));
    this.camera.lookAt(0, 0, 0);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
    this.camera.updateMatrixWorld();
  }

  private clearCompanions() {
    for (const p of this.companions) this.galaxy.remove(p);
    for (const g of this.companionGeos) g.dispose();
    for (const m of this.companionMats) m.dispose();
    this.companions = [];
    this.companionGeos = [];
    this.companionMats = [];
  }

  private clearSun() {
    if (this.sunSprite) {
      this.galaxy.remove(this.sunSprite);
      this.sunSprite = null;
    }
    for (const ring of this.sunRings) {
      this.galaxy.remove(ring);
      ring.geometry.dispose();
      (ring.material as THREE.Material).dispose();
    }
    this.sunRings = [];
  }

  private rebuild(s: Snapshot) {
    const params = s.params;
    const quality = s.quality;
    for (const p of Object.values(this.layers)) {
      if (!p) continue;
      this.galaxy.remove(p);
    }
    for (const sp of this.sprites) this.galaxy.remove(sp);
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
    for (const m of this.spriteMats) m.dispose();
    this.geos = [];
    this.mats = [];
    this.sprites = [];
    this.spriteMats = [];
    this.layers = {};
    this.clearCompanions();
    this.clearSun();

    const counts = QUALITY_COUNTS[quality];
    const buf = generateGalaxy(params, counts);

    this.layers.stars = this.makePoints(buf.stars, params, 16, 1);
    this.layers.dust = this.makePoints(buf.dust, params, 18, 0.7);
    this.layers.hii = this.makePoints(buf.hii, params, 22, 1.05);
    this.galaxy.add(this.layers.stars, this.layers.dust, this.layers.hii);
    this.addCoreGlow();
    this.addCompanions(s.preset, params, counts.stars);
    this.addSunMarker(s.preset, params);

    useEngineStats.setState({
      starCount: buf.stars.count,
      dustCount: buf.dust.count,
      hiiCount: buf.hii.count,
    });
  }

  private addCompanions(preset: Snapshot["preset"], params: GalaxyParams, starCount: number) {
    const clouds = companionClouds(preset, params, starCount);
    for (const spec of clouds) {
      const cloud = generateStaticCloud(spec, params.seed);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(cloud.pos, 3));
      geo.setAttribute("color", new THREE.BufferAttribute(cloud.color, 3));
      const mat = new THREE.PointsMaterial({
        size: 0.085,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending,
        opacity: 0.95,
        map: this.tex,
      });
      const pts = new THREE.Points(geo, mat);
      pts.frustumCulled = false;
      this.galaxy.add(pts);
      this.companions.push(pts);
      this.companionGeos.push(geo);
      this.companionMats.push(mat);
    }
  }

  private addSunMarker(preset: Snapshot["preset"], params: GalaxyParams) {
    const sun = landmarksFor(preset, params).find((m) => m.kind === "sun");
    if (!sun) return;
    const mat = new THREE.SpriteMaterial({
      map: this.tex,
      color: 0xe8eef4,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.95,
      toneMapped: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.7, 0.7, 1);
    sprite.position.set(sun.world.x, sun.world.y, sun.world.z);
    this.galaxy.add(sprite);
    this.sunSprite = sprite;

    const makeRing = (inner: number, outer: number, opacity: number) => {
      const ringGeo = new THREE.RingGeometry(inner, outer, 48);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xd5dbe3,
        side: THREE.DoubleSide,
        transparent: true,
        opacity,
        depthWrite: false,
        toneMapped: false,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.copy(sprite.position);
      this.galaxy.add(ring);
      this.sunRings.push(ring);
    };
    makeRing(0.38, 0.46, 0.75);
    makeRing(0.62, 0.68, 0.4);
  }

  private addCoreGlow() {
    const make = (scale: number, color: number, opacity: number) => {
      const mat = new THREE.SpriteMaterial({
        map: this.tex,
        color,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity,
        toneMapped: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(scale, scale, 1);
      this.galaxy.add(sprite);
      this.sprites.push(sprite);
      this.spriteMats.push(mat);
    };
    make(1.5, 0xffe2b0, 0.42);
    make(3.4, 0xffc17a, 0.12);
  }

  private makePoints(
    buf: ParticleBuffers,
    params: GalaxyParams,
    sizeScale: number,
    brightness: number,
  ) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(buf.count * 3), 3));
    geo.setAttribute("a", new THREE.BufferAttribute(buf.a, 1));
    geo.setAttribute("b", new THREE.BufferAttribute(buf.b, 1));
    geo.setAttribute("tilt", new THREE.BufferAttribute(buf.tilt, 1));
    geo.setAttribute("theta0", new THREE.BufferAttribute(buf.theta0, 1));
    geo.setAttribute("velTheta", new THREE.BufferAttribute(buf.velTheta, 1));
    geo.setAttribute("z", new THREE.BufferAttribute(buf.z, 1));
    geo.setAttribute("pSize", new THREE.BufferAttribute(buf.size, 1));
    geo.setAttribute("mag", new THREE.BufferAttribute(buf.mag, 1));
    geo.setAttribute("phase", new THREE.BufferAttribute(buf.phase, 1));
    geo.setAttribute("color", new THREE.BufferAttribute(buf.color, 3));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), params.radGalaxy * 2.6);

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: this.simYear },
        uTick: { value: 0 },
        uPertN: { value: params.pertN },
        uPertAmp: { value: params.pertAmp },
        uPixelRatio: { value: this.renderer.getPixelRatio() },
        uSizeScale: { value: sizeScale },
        uBrightness: { value: brightness },
        uMap: { value: this.tex },
      },
      vertexShader: STAR_VERT,
      fragmentShader: STAR_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });

    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    this.geos.push(geo);
    this.mats.push(mat);
    return pts;
  }

  private publishLabels(s: Snapshot, force = false) {
    if (!s.showLabels) {
      if (force || useLandmarkScreen.getState().labels.length) {
        useLandmarkScreen.setState({ labels: [] });
      }
      return;
    }
    this.camera.updateMatrixWorld();
    const marks = landmarksFor(s.preset, s.params);
    const sun = marks.find((m) => m.kind === "sun");
    if (sun && this.sunSprite) {
      this.sunSprite.position.set(sun.world.x, sun.world.y, sun.world.z);
      for (const ring of this.sunRings) ring.position.copy(this.sunSprite.position);
    }
    const w = this.parent.clientWidth;
    const h = this.parent.clientHeight;
    const desktop = w >= 1024;
    const labels = projectLandmarks(
      marks,
      (x, y, z) => {
        this.proj.set(x, y, z).project(this.camera);
        if (this.proj.z < -1.02 || this.proj.z > 1.02) return null;
        if (Math.abs(this.proj.x) > 1.12 || Math.abs(this.proj.y) > 1.12) return null;
        return { x: this.proj.x, y: this.proj.y, z: this.proj.z };
      },
      {
        w,
        h,
        padL: 16,
        padR: desktop && !s.uiHidden ? 348 : 18,
        padT: s.uiHidden ? 24 : 88,
        padB: desktop ? 36 : 78,
      },
      this.camera.position,
    );
    if (!force && labelsEq(useLandmarkScreen.getState().labels, labels)) return;
    useLandmarkScreen.setState({ labels });
  }

  private tick() {
    if (this.disposed) return;
    const now = performance.now();
    const dt = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;

    const s = useGalaxyStore.getState();
    if (!s.paused) this.simYear += dt * s.timeScale;

    for (const m of this.mats) {
      m.uniforms.uTime.value = this.simYear;
      m.uniforms.uTick.value = now * 0.001;
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);

    this.labelAccum += dt;
    if (this.labelAccum >= 0.05) {
      this.labelAccum = 0;
      this.publishLabels(s);
    }

    this.fpsAccum += dt;
    this.fpsFrames += 1;
    if (this.fpsAccum >= 0.4) {
      const fps = this.fpsFrames / this.fpsAccum;
      this.fpsAccum = 0;
      this.fpsFrames = 0;
      useEngineStats.setState({ fps, year: this.simYear });
    }
  }

  dispose() {
    this.disposed = true;
    window.clearTimeout(this.regenTimer);
    this.ro.disconnect();
    this.renderer.setAnimationLoop(null);
    this.controls.dispose();
    this.clearCompanions();
    this.clearSun();
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
    for (const m of this.spriteMats) m.dispose();
    this.halo.geo.dispose();
    this.halo.mat.dispose();
    this.tex.dispose();
    this.renderer.dispose();
    useLandmarkScreen.setState({ labels: [] });
  }
}
