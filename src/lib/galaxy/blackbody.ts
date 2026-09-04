/** Approximate blackbody chromaticity, returned in linear 0–1 RGB. */
export function blackbodyRgb(temp: number): [number, number, number] {
  const t = Math.min(40000, Math.max(1000, temp)) / 100;
  let r: number;
  let g: number;
  let b: number;
  if (t <= 66) {
    r = 1;
    g = 0.3901 * Math.log(t) - 0.6319;
  } else {
    r = 1.2929 * Math.pow(t - 60, -0.1332);
    g = 1.1298 * Math.pow(t - 60, -0.0755);
  }
  if (t >= 66) b = 1;
  else if (t <= 19) b = 0;
  else b = 0.5433 * Math.log(t - 10) - 1.1964;
  const gamma = (c: number) => {
    const x = Math.min(1, Math.max(0, c));
    return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
  };
  return [gamma(r), gamma(g), gamma(b)];
}
