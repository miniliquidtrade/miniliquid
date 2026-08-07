// Shared chart helpers for the minimalist line charts (account value + assets).

export interface Pt {
  x: number;
  y: number;
}

/** Catmull-Rom → cubic-Bézier: a smooth curve through every point. */
export function smooth(pts: Pt[]): string {
  if (pts.length < 2) return "";
  const d = [`M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d.push(
      `C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(
        2
      )} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`
    );
  }
  return d.join(" ");
}
