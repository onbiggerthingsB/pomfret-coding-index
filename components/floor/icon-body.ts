import Matter from "matter-js";

/** Eight convex faces approximate the painted corners while keeping broad, level edges for stacking. */
export function createIconBody(x: number, y: number, side: number, angle: number) {
  const half = side / 2;
  // A 45° tangent to the sprite’s 22.5% corner radius cuts about 13% off each edge.
  const flat = half - 0.13 * side;
  return Matter.Body.create({
    label: "Resource icon",
    position: { x, y },
    vertices: [
      { x: -flat, y: -half }, { x: flat, y: -half },
      { x: half, y: -flat }, { x: half, y: flat },
      { x: flat, y: half }, { x: -flat, y: half },
      { x: -half, y: flat }, { x: -half, y: -flat },
    ],
    angle,
    restitution: 0.25,
    friction: 0.45,
    frictionStatic: 0.9,
    frictionAir: 0.014,
    sleepThreshold: 30,
  });
}
