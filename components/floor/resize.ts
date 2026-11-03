import Matter from "matter-js";
import { HEADROOM } from "./bounds.ts";
import type { Scene } from "./scene";

type Viewport = Pick<Scene, "width" | "height" | "size">;

/** Keep the rendered squares and their collision shapes together across a viewport change. */
export function resizeFloorBodies(scene: Pick<Scene, "bodies" | "added" | "holds" | "width" | "height" | "size">, previous: Viewport) {
  const { width, height, size } = scene;
  if (width === previous.width && height === previous.height && size === previous.size) return;
  const scale = size / previous.size;
  const spread = previous.width > 0 ? width / previous.width : 1;

  scene.bodies.forEach((body, i) => {
    if (scale !== 1) Matter.Body.scale(body, scale, scale);
    if (scene.holds.has(i)) return; // matches.relayout places these in their grid, including scrolled rows.

    // Measure the rotated polygon itself. Matter's broad-phase body.bounds also includes a velocity margin.
    const shape = Matter.Bounds.create(body.vertices);
    const halfX = (shape.max.x - shape.min.x) / 2;
    const halfY = (shape.max.y - shape.min.y) / 2;
    const { x, y } = body.position;
    const targetX = x * spread;
    const nextX = Math.max(Math.min(halfX, width / 2), Math.min(width - halfX, targetX));
    // Move a resting stack together with the floor. Bodies mid-flight keep their height, and queued drops stay overhead.
    const targetY = y < 0 ? y * scale : body.isSleeping ? height - (previous.height - y) * scale : y;
    const nextY = y < -HEADROOM && i >= scene.added ? targetY : Math.max(-HEADROOM + halfY, Math.min(height - halfY, targetY));
    if (nextX !== x || nextY !== y) Matter.Body.setPosition(body, { x: nextX, y: nextY });

    // An unchanged stack stays asleep. Let the solver settle compressed neighbours and sleepers whose support spread apart.
    const wallShift = Math.abs(nextX - targetX) > 0.1 || Math.abs(nextY - targetY) > 0.1;
    const onFloor = nextY + halfY >= height - 0.1;
    if (i < scene.added && body.isSleeping && (wallShift || spread < scale - 0.0001 || (spread > scale + 0.0001 && !onFloor))) {
      Matter.Sleeping.set(body, false);
    }
  });
}
