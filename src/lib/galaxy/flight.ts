import type { WorldLandmark } from "./types";

export type FlightActions = {
  yaw: number;
  pitch: number;
  throttle: number;
  boost: boolean;
};

export type FlightState = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  speed: number;
  bank: number;
  arrived: boolean;
};

const GAME_CODES = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ShiftLeft",
  "ShiftRight",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function lerpAngle(a: number, b: number, t: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export const flightInput = {
  keys: new Set<string>(),
  injected: null as string[] | null,
  touchYaw: 0,
  touchPitch: 0,
  touchThrottle: 0,
  steerOverride: null as number | null,
  listening: false,

  setKeys(codes: string[]) {
    this.injected = codes;
  },

  setSteer(v: number) {
    this.steerOverride = v;
  },

  sample(): FlightActions {
    const held = this.injected ?? this.keys;
    const has = (c: string) => held instanceof Set ? held.has(c) : held.includes(c);
    let yaw = 0;
    if (has("KeyA") || has("ArrowLeft")) yaw += 1;
    if (has("KeyD") || has("ArrowRight")) yaw -= 1;
    yaw += this.touchYaw;
    if (this.steerOverride != null) yaw = this.steerOverride;
    let pitch = 0;
    if (has("ArrowUp")) pitch += 1;
    if (has("ArrowDown")) pitch -= 1;
    pitch += this.touchPitch;
    let throttle = this.touchThrottle;
    if (has("KeyW")) throttle += 1;
    if (has("KeyS")) throttle -= 1;
    return {
      yaw: clamp(yaw, -1, 1),
      pitch: clamp(pitch, -1, 1),
      throttle: clamp(throttle, -1, 1),
      boost: has("ShiftLeft") || has("ShiftRight"),
    };
  },

  listen() {
    if (this.listening) return;
    this.listening = true;
    this.onDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      this.keys.add(e.code);
      if (GAME_CODES.has(e.code) && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
      }
    };
    this.onUp = (e: KeyboardEvent) => {
      this.keys.delete(e.code);
    };
    this.onBlur = () => this.keys.clear();
    window.addEventListener("keydown", this.onDown);
    window.addEventListener("keyup", this.onUp);
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("visibilitychange", this.onBlur);
  },

  dispose() {
    if (!this.listening) return;
    this.listening = false;
    window.removeEventListener("keydown", this.onDown);
    window.removeEventListener("keyup", this.onUp);
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("visibilitychange", this.onBlur);
    this.keys.clear();
    this.injected = null;
    this.steerOverride = null;
  },

  onDown: (_e: KeyboardEvent) => {},
  onUp: (_e: KeyboardEvent) => {},
  onBlur: () => {},
};

export class FlightSim {
  state: FlightState = {
    x: 0,
    y: 3.2,
    z: 12,
    yaw: 0,
    pitch: -0.18,
    speed: 0,
    bank: 0,
    arrived: false,
  };
  spawned = false;
  private manual = false;

  spawn(marks: WorldLandmark[], targetId: string | null) {
    const sun = marks.find((m) => m.kind === "sun");
    const target = targetId ? marks.find((m) => m.id === targetId) : null;
    const from = sun ?? marks.find((m) => m.kind === "center") ?? marks[0];
    if (from) {
      this.state.x = from.world.x + 1.05;
      this.state.y = from.world.y + 0.38;
      this.state.z = from.world.z + 1.15;
    } else {
      this.state.x = 0;
      this.state.y = 3.4;
      this.state.z = 12;
    }
    const aim = target ?? marks.find((m) => m.kind === "center");
    if (aim) this.lookAt(aim.world.x, aim.world.y, aim.world.z);
    else {
      this.state.yaw = 0;
      this.state.pitch = -0.22;
    }
    this.state.speed = 0;
    this.state.bank = 0;
    this.state.arrived = false;
    this.spawned = true;
    this.manual = false;
  }

  engage() {
    this.manual = false;
    this.state.arrived = false;
  }

  lookAt(x: number, y: number, z: number) {
    const dx = x - this.state.x;
    const dy = y - this.state.y;
    const dz = z - this.state.z;
    const horiz = Math.hypot(dx, dz) || 1e-6;
    this.state.yaw = Math.atan2(-dx, -dz);
    this.state.pitch = clamp(Math.atan2(dy, horiz), -1.15, 1.15);
  }

  forward(out: { x: number; y: number; z: number }) {
    const cy = Math.cos(this.state.yaw);
    const sy = Math.sin(this.state.yaw);
    const cp = Math.cos(this.state.pitch);
    const sp = Math.sin(this.state.pitch);
    out.x = -sy * cp;
    out.y = sp;
    out.z = -cy * cp;
  }

  step(
    dt: number,
    actions: FlightActions,
    target: WorldLandmark | null,
    auto: boolean,
  ) {
    if (actions.yaw !== 0 || actions.pitch !== 0 || actions.throttle < 0) {
      this.manual = true;
    }
    const assist = auto && target && !this.manual;
    if (assist && target) {
      const dx = target.world.x - this.state.x;
      const dy = target.world.y - this.state.y;
      const dz = target.world.z - this.state.z;
      const horiz = Math.hypot(dx, dz) || 1e-6;
      const wantYaw = Math.atan2(-dx, -dz);
      const wantPitch = clamp(Math.atan2(dy, horiz), -1.15, 1.15);
      const k = 1 - Math.exp(-3.2 * dt);
      this.state.yaw = lerpAngle(this.state.yaw, wantYaw, k);
      this.state.pitch += (wantPitch - this.state.pitch) * k;
    }

    const turn = 1.35 + Math.min(1, this.state.speed / 4) * 0.7;
    this.state.yaw += actions.yaw * turn * dt;
    this.state.pitch = clamp(this.state.pitch + actions.pitch * 1.05 * dt, -1.2, 1.2);
    this.state.bank += (actions.yaw - this.state.bank) * (1 - Math.exp(-8 * dt));

    const maxBoost = actions.boost ? 11 : 5.6;
    let max = maxBoost;
    let throttle = actions.throttle;
    if (target) {
      const dist = Math.hypot(
        target.world.x - this.state.x,
        target.world.y - this.state.y,
        target.world.z - this.state.z,
      );
      const hold = arrivalRadius(target);
      const near = clamp(dist / (hold * 5), 0, 1);
      max = maxBoost * (0.18 + 0.82 * near * near);
      if (assist) {
        if (dist > hold * 3) throttle = Math.max(throttle, 0.55);
        else if (dist > hold) throttle = Math.max(throttle, 0.16);
        else throttle = Math.min(throttle, 0);
      }
    }
    const thrust = throttle * (actions.boost ? 16 : 7.5);
    this.state.speed += thrust * dt;
    this.state.speed *= Math.exp(-1.15 * dt);
    if (actions.throttle === 0 && !assist) this.state.speed *= Math.exp(-0.55 * dt);
    this.state.speed = clamp(this.state.speed, -2.2, max);

    const f = { x: 0, y: 0, z: 0 };
    this.forward(f);
    this.state.x += f.x * this.state.speed * dt;
    this.state.y += f.y * this.state.speed * dt;
    this.state.z += f.z * this.state.speed * dt;
    this.state.y = clamp(this.state.y, -18, 22);

    if (target) {
      const dist = Math.hypot(
        target.world.x - this.state.x,
        target.world.y - this.state.y,
        target.world.z - this.state.z,
      );
      this.state.arrived = dist < arrivalRadius(target);
      if (this.state.arrived && assist) {
        this.state.speed *= Math.exp(-3 * dt);
      }
    } else {
      this.state.arrived = false;
    }
  }
}

export function arrivalRadius(m: WorldLandmark) {
  if (m.kind === "center") return 2.55;
  if (m.kind === "companion") return 1.45;
  if (m.kind === "sun") return 1.05;
  return 0.95;
}

export function headingTo(state: FlightState, tx: number, ty: number, tz: number) {
  const dx = tx - state.x;
  const dy = ty - state.y;
  const dz = tz - state.z;
  const horiz = Math.hypot(dx, dz) || 1e-6;
  const wantYaw = Math.atan2(-dx, -dz);
  let d = wantYaw - state.yaw;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  const wantPitch = Math.atan2(dy, horiz);
  return { yawErr: d, pitchErr: wantPitch - state.pitch };
}
