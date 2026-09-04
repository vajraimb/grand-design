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

  float dist = max(-mvPosition.z, 0.35);
  float tw = 1.0;
  if (mag > 0.42) {
    tw = 0.86 + 0.14 * sin(uTick * (1.6 + phase * 1.8) + phase * 6.2831853);
  }

  gl_PointSize = min(42.0, max(0.7, pSize * uPixelRatio * uSizeScale * tw / dist));
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
