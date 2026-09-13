/** Tanner Helland approximation of blackbody chromaticity, 1000–15000 K. */
export function blackbodyRgb(kelvin: number): [number, number, number] {
  const t = Math.min(400, Math.max(10, kelvin / 100));
  let r: number;
  let g: number;
  let b: number;

  if (t <= 66) {
    r = 1;
    g = clamp01((99.4708 * Math.log(t) - 161.1196) / 255);
  } else {
    r = clamp01((329.6987 * Math.pow(t - 60, -0.1332)) / 255);
    g = clamp01((288.1222 * Math.pow(t - 60, -0.0755)) / 255);
  }

  if (t >= 66) b = 1;
  else if (t <= 19) b = 0;
  else b = clamp01((138.5177 * Math.log(t - 10) - 305.0448) / 255);

  return [r, g, b];
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}
