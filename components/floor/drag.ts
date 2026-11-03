import Matter from "matter-js";
import { popScale } from "./pop.ts";
import type { Scene } from "./scene";
import { RADIUS } from "./sprite.ts";

export type DropBounds = { left: number; right: number; top: number; bottom: number };
type Point = Matter.Vector;
type Pose = { position: Point; angle: number };
export const DRAG_THRESHOLD = 7;

export function isClippedResult(scene: Scene, i: number) {
  const hold = scene.holds.get(i);
  const box = scene.box;
  if (!box || !hold) return false;
  if (hold.parked) return true;
  const { x, y } = scene.bodies[i].position;
  const reach = scene.size * (scene.grown.get(i) ?? 1);
  return hold.arrived && x > box.x && x < box.x + box.width && y > box.y - reach && y < box.y + box.height + reach
    && Math.abs(y - (hold.rest.y - scene.scroll)) < reach && Math.abs(x - hold.rest.x) < reach;
}

/** Pick the top painted rounded square at the displayed pose, in CSS/world pixels even on a Retina canvas. */
export function pickFloorIcon(scene: Scene, point: Point, poseAt: (i: number) => Pose) {
  const box = scene.box;
  const inClip = !!box && point.x >= box.x + 1 && point.x <= box.x + box.width - 1
    && point.y >= box.y + 1 && point.y <= box.y + box.height - 1;
  let top: { index: number; local: Point } | undefined;
  let layer = -1;
  const check = (i: number, scale: number, order: number) => {
    if (order < layer || !(scene.sharp.get(i) || scene.atlas.patch(i))) return;
    const pose = poseAt(i);
    const pop = scene.pops.get(i);
    const side = scene.size * scale * (pop ? popScale(scene.now - pop.t0) : 1);
    const delta = Matter.Vector.sub(point, pose.position);
    if (side < 0.5 || Math.abs(delta.x) + Math.abs(delta.y) > side * Math.SQRT2) return;
    const local = Matter.Vector.rotate(delta, -pose.angle);
    const radius = side * RADIUS;
    const dx = Math.max(0, Math.abs(local.x) - (side / 2 - radius));
    const dy = Math.max(0, Math.abs(local.y) - (side / 2 - radius));
    if (dx * dx + dy * dy > radius * radius) return;
    layer = order;
    top = { index: i, local };
  };
  for (let i = 0; i < scene.added; i++) if (!scene.grown.has(i)) check(i, 1, 0);
  scene.grown.forEach((scale, i) => {
    const clipped = isClippedResult(scene, i);
    if (!clipped || inClip) check(i, scale, clipped ? 2 : 1);
  });
  return top;
}

const BASE_FRAME = 1000 / 60; // Matter velocity units
const THROW_WINDOW = 72; // ms of hand movement contributing to release velocity
type Sample = Point & { time: number };

export function createFloorDrag(engine: Matter.Engine) {
  let grab: { constraint: Matter.Constraint; body: Matter.Body; samples: Sample[]; local: Point; target: Point; size: number } | undefined;
  const updateAnchor = () => {
    if (!grab) return;
    const { body, constraint, local, target, size } = grab;
    const grip = Matter.Vector.add(body.position, Matter.Vector.rotate(local, body.angle));
    const stretch = Matter.Vector.sub(target, grip);
    // A single fast pointer event can span the entire screen. Limit spring extension at each physics step.
    const fraction = Math.min(1, size / (Matter.Vector.magnitude(stretch) || 1));
    constraint.pointA = Matter.Vector.add(grip, Matter.Vector.mult(stretch, fraction));
  };

  return {
    get body() { return grab?.body; },
    start(body: Matter.Body, local: Point, point: Point, time: number, size: number) {
      const constraint = Matter.Constraint.create({
        bodyB: body, pointB: Matter.Vector.rotate(local, body.angle), pointA: { ...point },
        length: 0, stiffness: 0.18, damping: 0.22, render: { visible: false },
      });
      Matter.Sleeping.set(body, false);
      Matter.Composite.add(engine.world, constraint);
      grab = { body, local, constraint, target: point, size, samples: [{ ...point, time }] };
      Matter.Events.on(engine, "beforeUpdate", updateAnchor);
    },
    move(point: Point, time: number, animate: boolean) {
      if (!grab) return;
      const { body, samples, local } = grab;
      grab.target = point;
      if (time > samples[samples.length - 1].time) {
        samples.push({ ...point, time });
        // Keep the sample straddling the window edge to interpolate sparse events.
        while (samples.length > 2 && samples[1].time <= time - THROW_WINDOW) samples.shift();
      } else Object.assign(samples[samples.length - 1], point);
      if (!animate) {
        // A paused solver has no steps to satisfy the constraint. Pose just the grabbed tile at its anchor.
        Matter.Body.setPosition(body, Matter.Vector.sub(point, Matter.Vector.rotate(local, body.angle)));
      }
    },
    finish(throwBody: boolean) {
      if (!grab) return;
      const { body, constraint, samples, size } = grab;
      Matter.Composite.remove(engine.world, constraint);
      Matter.Events.off(engine, "beforeUpdate", updateAnchor);
      grab = undefined;
      // Matter 0.20 keeps the last constraint correction on its body after removal and reapplies it
      // on the next step. The grab is this body's only constraint, so discard its cached correction.
      const { constraintImpulse } = body as Matter.Body & { constraintImpulse: Point & { angle: number } };
      constraintImpulse.x = constraintImpulse.y = constraintImpulse.angle = 0;
      const last = samples[samples.length - 1];
      const first = samples[0];
      const next = samples[1] ?? first;
      const start = Math.max(first.time, last.time - THROW_WINDOW);
      const t = next.time > first.time ? (start - first.time) / (next.time - first.time) : 0;
      const elapsed = Math.max(8, last.time - start);
      const hand = {
        x: (last.x - first.x - (next.x - first.x) * t) * BASE_FRAME / elapsed,
        y: (last.y - first.y - (next.y - first.y) * t) * BASE_FRAME / elapsed,
      };
      const speed = Matter.Vector.magnitude(hand);
      const limit = throwBody ? Math.min(26, size * 1.3, speed) : 0;
      const carried = Matter.Body.getVelocity(body);
      const velocity = Matter.Vector.add(Matter.Vector.mult(hand, 0.75), Matter.Vector.mult(carried, 0.25));
      const factor = Math.min(1, limit / (Matter.Vector.magnitude(velocity) || 1));
      Matter.Body.setVelocity(body, Matter.Vector.mult(velocity, factor));
      const maxSpin = Math.min(0.55, limit * 2 / size);
      Matter.Body.setAngularVelocity(body, Math.max(-maxSpin, Math.min(maxSpin, Matter.Body.getAngularVelocity(body))));
    },
  };
}

/** Maximum pointer travel, rather than final displacement, distinguishes throwing from clicking. */
export function classifyRelease(travelled: number, x: number, y: number, bounds: DropBounds | null): "select" | "drop" | "ignore" {
  if (!Number.isFinite(travelled) || travelled < 0) return "ignore";
  if (travelled <= DRAG_THRESHOLD) return "select";
  if (!bounds || ![x, y, bounds.left, bounds.right, bounds.top, bounds.bottom].every(Number.isFinite)) return "ignore";
  if (bounds.right <= bounds.left || bounds.bottom <= bounds.top) return "ignore";
  return x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom ? "drop" : "ignore";
}
