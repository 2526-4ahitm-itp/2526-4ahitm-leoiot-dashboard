// Pure geometry over a 3D polyline: its total length, and a length-limited
// prefix of it. Used to animate a route tube growing to a target length
// over time, rather than popping fully into view (spec model3d/room-navigation).

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

function dist(a: Point3, b: Point3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/** Total length of the polyline through `points`, in order. */
export function polylineLength(points: readonly Point3[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += dist(points[i - 1], points[i]);
  return total;
}

/**
 * The prefix of `points` covering exactly `length` along the polyline
 * (clamped to the polyline's own total length), with one interpolated point
 * appended when `length` falls in the middle of a segment.
 */
export function polylinePrefix(points: readonly Point3[], length: number): Point3[] {
  if (points.length === 0) return [];
  const out: Point3[] = [points[0]];
  let remaining = length;
  for (let i = 1; i < points.length; i++) {
    const segLen = dist(points[i - 1], points[i]);
    if (remaining >= segLen) {
      out.push(points[i]);
      remaining -= segLen;
      continue;
    }
    if (remaining > 0) {
      const t = segLen === 0 ? 0 : remaining / segLen;
      out.push({
        x: points[i - 1].x + (points[i].x - points[i - 1].x) * t,
        y: points[i - 1].y + (points[i].y - points[i - 1].y) * t,
        z: points[i - 1].z + (points[i].z - points[i - 1].z) * t,
      });
    }
    return out;
  }
  return out;
}
