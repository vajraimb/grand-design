export const STAR_VERT = /* glsl */ `
attribute float a;
attribute float b;
attribute float tilt;
attribute float theta0;
attribute float velTheta;
attribute float z;
attribute float pSize;
attribute float mag;
attribute float phase;
attribute vec3 color;

uniform float uTime;
uniform float uTick;
uniform float uPertN;
uniform float uPertAmp;
uniform float uPixelRatio;
uniform float uSizeScale;
uniform float uBrightness;

varying vec3 vColor;
varying float vAlpha;

void main() {
  float theta = theta0 + velTheta * uTime;
  float x = a * cos(theta);
  float y = b * sin(theta);
  float cti = cos(tilt);
  float sti = sin(tilt);
  float px = x * cti - y * sti;
  float py = x * sti + y * cti;

  if (uPertAmp > 0.001 && uPertN > 0.5) {
    float ang = atan(py, px);
    float pr = uPertAmp * (0.35 + 0.65 * clamp(a / 16.0, 0.0, 1.4));
    px += pr * sin(uPertN * ang);
    py += pr * cos(uPertN * ang);
  }

  vec4 mvPosition = modelViewMatrix * vec4(px, z, py, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  float d = max(-mvPosition.z, 0.12);
  float close = 1.0 - smoothstep(1.1, 8.0, d);
  float tw = 1.0;
  if (mag > 0.42) {
    tw = 0.86 + 0.14 * sin(uTick * (1.6 + phase * 1.8) + phase * 6.2831853);
  }

  float scale = mix(uSizeScale, uSizeScale * 0.38, close);
  float cap = mix(36.0, 8.0, close);
  float floorD = mix(0.35, 0.22, close);
  gl_PointSize = clamp(pSize * uPixelRatio * scale * tw / max(d, floorD), 0.7, cap);
  vColor = color * (uBrightness * (0.55 + mag * 0.9) * tw);
  vAlpha = clamp(mag * uBrightness * tw, 0.0, 1.0);
}
`;

export const STAR_FRAG = /* glsl */ `
uniform sampler2D uMap;
varying vec3 vColor;
varying float vAlpha;

void main() {
  vec4 tex = texture2D(uMap, gl_PointCoord);
  float a = tex.a * vAlpha;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vColor * tex.a, a);
}
`;

/** Close-up landmark stars — pinpricks when near, glow when far. */
export const LOCAL_VERT = /* glsl */ `
attribute float pSize;
attribute float mag;
attribute float phase;
attribute vec3 color;

uniform float uTick;
uniform float uPixelRatio;
uniform float uSizeScale;
uniform float uOpacity;
uniform float uMinDist;
uniform float uMaxSize;
uniform float uNearSoft;
uniform float uCloseAmt;

varying vec3 vColor;
varying float vAlpha;

void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  float d = max(-mvPosition.z, uMinDist);
  float close = (1.0 - smoothstep(0.45, 3.8, d)) * uCloseAmt;
  float tw = 0.86 + 0.14 * sin(uTick * (1.35 + phase * 2.1) + phase * 6.2831853);
  float scale = mix(uSizeScale, uSizeScale * 0.34, close);
  float cap = mix(uMaxSize, min(uMaxSize, 7.2), close);
  float atten = max(d, mix(uMinDist, uNearSoft, close));
  gl_PointSize = clamp(pSize * uPixelRatio * scale * tw / atten, 0.85, cap);
  vColor = color * (0.62 + mag * 1.05) * tw;
  vAlpha = clamp(mag * uOpacity * tw, 0.0, 1.0);
}
`;

export const LOCAL_FRAG = STAR_FRAG;

/**
 * Close-up worlds share the galaxy's orbital language.
 * mode 0 Kepler disk · 1 sphere spin · 2 3D ellipse · 3 jet · 4 nested spiral · 5 stream
 */
export const PHYS_VERT = /* glsl */ `
attribute float a;
attribute float b;
attribute float tilt;
attribute float theta0;
attribute float velTheta;
attribute float z;
attribute float pSize;
attribute float mag;
attribute float phase;
attribute float mode;
attribute vec3 color;

uniform float uTime;
uniform float uTick;
uniform float uPixelRatio;
uniform float uSizeScale;
uniform float uOpacity;
uniform float uMinDist;
uniform float uMaxSize;
uniform float uNearSoft;
uniform float uCloseAmt;
uniform float uPertN;
uniform float uPertAmp;

varying vec3 vColor;
varying float vAlpha;

void main() {
  vec3 pos = vec3(0.0);
  float doppler = 1.0;

  if (mode < 0.5) {
    float theta = theta0 + velTheta * uTime;
    vec3 p = vec3(a * cos(theta), z, a * sin(theta));
    float cti = cos(tilt);
    float sti = sin(tilt);
    pos = vec3(p.x, p.y * cti - p.z * sti, p.y * sti + p.z * cti);
    doppler = 1.0 + 0.28 * sin(theta);
  } else if (mode < 1.5) {
    float lat = b;
    float lon = theta0 + velTheta * uTime;
    float cl = cos(lat);
    pos = vec3(a * cl * cos(lon), a * sin(lat), a * cl * sin(lon));
  } else if (mode < 2.5) {
    float th = theta0 + velTheta * uTime;
    vec3 p = vec3(a * cos(th), 0.0, b * sin(th));
    float rx = phase * 6.2831853;
    float cx = cos(rx);
    float sx = sin(rx);
    p = vec3(p.x, p.y * cx - p.z * sx, p.y * sx + p.z * cx);
    float cy = cos(tilt);
    float sy = sin(tilt);
    pos = vec3(p.x * cy - p.z * sy, p.y, p.x * sy + p.z * cy);
  } else if (mode < 3.5) {
    float life = fract(theta0 + velTheta * uTime);
    float along = life * 2.35;
    float spr = mix(0.018, 0.15, life * life);
    float ang = tilt + phase * 0.8;
    float sgn = b >= 0.0 ? 1.0 : -1.0;
    pos = vec3(cos(ang) * spr, sgn * (0.2 + along), sin(ang) * spr);
  } else if (mode < 4.5) {
    float theta = theta0 + velTheta * uTime;
    float x = a * cos(theta);
    float y = b * sin(theta);
    float cti = cos(tilt);
    float sti = sin(tilt);
    float px = x * cti - y * sti;
    float py = x * sti + y * cti;
    if (uPertAmp > 0.001 && uPertN > 0.5) {
      float ang = atan(py, px);
      float pr = uPertAmp * (0.35 + 0.65 * clamp(a / 1.6, 0.0, 1.4));
      px += pr * sin(uPertN * ang);
      py += pr * cos(uPertN * ang);
    }
    pos = vec3(px, z, py);
  } else {
    float along = fract(theta0 + velTheta * uTime + 0.5) - 0.5;
    pos = vec3(along * a, z, b);
  }

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  float d = max(-mvPosition.z, uMinDist);
  float close = (1.0 - smoothstep(0.45, 3.8, d)) * uCloseAmt;
  float tw = 0.86 + 0.14 * sin(uTick * (1.35 + phase * 2.1) + phase * 6.2831853);
  float scale = mix(uSizeScale, uSizeScale * 0.34, close);
  float cap = mix(uMaxSize, min(uMaxSize, 7.2), close);
  float atten = max(d, mix(uMinDist, uNearSoft, close));
  gl_PointSize = clamp(pSize * uPixelRatio * scale * tw / atten, 0.85, cap);
  vColor = color * (0.62 + mag * 1.05) * tw * doppler;
  vAlpha = clamp(mag * uOpacity * tw, 0.0, 1.0);
}
`;

