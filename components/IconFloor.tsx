"use client";

import Matter from "matter-js";
import { BorderBeam } from "border-beam";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { createAtlas, type Sheet } from "./floor/atlas";
import { createBounds } from "./floor/bounds";
import { createDebug } from "./floor/debug";
import { classifyRelease, createFloorDrag, DRAG_THRESHOLD, isClippedResult, pickFloorIcon, type DropBounds } from "./floor/drag";
import { applyGrowth, applyHoldForces, needsPhysics, park, wakeNear } from "./floor/forces";
import { advanceClock, createRenderPoses, STEP, SUBSTEP } from "./floor/timing";
import { createIconBody } from "./floor/icon-body";
import type { Anchor } from "./floor/layout";
import { createMatches } from "./floor/matches";
import { createOverlays, MOST } from "./floor/overlays";
import { popScale } from "./floor/pop";
import { resizeFloorBodies } from "./floor/resize";
import type { Match, Scene } from "./floor/scene";
import { renderSprite } from "./floor/sprite";
import { createSwaps } from "./floor/swaps";
import { createTilt, type TiltStatus } from "./floor/tilt";

export type { Match };

export type FloorApi = {
  /** Shake the pile. 0 is a nudge, 1 is a hard jolt. */
  shake: (intensity: number) => void;
  /** Float the matches up out of the pile, best first. They stay physics bodies throughout, each with its probability above it. */
  select: (matches: Match[], getAnchor: () => Anchor) => void;
  /** Let every floating icon go. Labels fade, gravity takes the icons back into the pile. */
  release: () => void;
  /** A new image arrived while the page is open: it drops into the pile from above. */
  add: (src: string) => void;
  /** Pause physical movement while keeping resource selection available. */
  setPaused: (paused: boolean) => void;
  setTiltEnabled: (enabled: boolean) => void;
  calibrateTilt: () => void;
};

type Props = {
  sources: string[];
  featuredCount: number;
  reserveSources: string[];
  /** Which cell of the packed sheet each pile icon is, or -1 for one that has to be loaded on its own (an upload). */
  cells: number[];
  sheet: Sheet | null;
  apiRef: React.RefObject<FloorApi | null>;
  /** Called once the world is built and `apiRef` is live. A rebuild means whatever was floating has to be sent again. */
  onReady?: () => void;
  /** Open details after a click or tap that did not drag the body. */
  onResourceSelect?: (src: string) => void;
  /** Viewport bounds of the project tray, read when the pointer is released. */
  getDropBounds?: () => DropBounds | null;
  onResourceDrop?: (src: string) => void;
  onTiltStatus?: (status: TiltStatus) => void;
};

const loadImage = (src: string) => {
  const img = new Image();
  img.decoding = "async";
  img.src = src;
  return img;
};

/**
 * Every icon is a rigid body: they drop in, settle on the floor, and can be thrown with the cursor.
 * This file owns the world, the frame loop and the drawing. The springs are in floor/forces, the labels in
 * floor/overlays, and the images popping in and out in floor/swaps.
 */
/**
 * Memoised, and every one of its props is stable on purpose. Typing re-renders the page on each keystroke, and without
 * this the floor re-rendered with it: 180 label elements reconciled, and, because their ref was an inline arrow, 180
 * refs detached and re-attached, thirteen times a second. That alone was most of the jank while typing.
 */
export const IconFloor = memo(function IconFloor({ sources, featuredCount, reserveSources, cells, sheet, apiRef, onReady, onResourceSelect, getDropBounds, onResourceDrop, onTiltStatus }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const beamRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const clipRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);
  // One callback per slot, made once. An inline arrow here is a new identity every render, which makes React drop and
  // re-take all 180 refs each time.
  const setLabel = useMemo(() => Array.from({ length: MOST }, (_, k) => (el: HTMLDivElement | null) => void (labelRefs.current[k] = el)), []);
  const [iconSize, setIconSize] = useState(96);
  const [animateBeam, setAnimateBeam] = useState(false);
  const pausedRef = useRef(false);
  const selectRef = useRef(onResourceSelect);
  const dropRef = useRef({ getDropBounds, onResourceDrop });
  const tiltStatusRef = useRef(onTiltStatus);

  useEffect(() => {
    selectRef.current = onResourceSelect;
    dropRef.current = { getDropBounds, onResourceDrop };
    tiltStatusRef.current = onTiltStatus;
  }, [onResourceSelect, getDropBounds, onResourceDrop, onTiltStatus]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = reducedQuery.matches;
    const engine = Matter.Engine.create({ gravity: { x: 0, y: 1, scale: 0.001 } });
    engine.enableSleeping = true; // bodies that stop moving leave the solver: no jitter, and far less CPU
    // These run in each of the three substeps, so a step gets 12 position passes in all (it was 4): hard hits no longer leave icons overlapping.
    engine.positionIterations = 4;
    engine.velocityIterations = 3;

    // Let a settled pile sleep despite tiny corrections at its contacts.
    const sleeping = Matter.Sleeping as unknown as { _motionSleepThreshold: number };
    sleeping._motionSleepThreshold = 0.35;

    // A cold sprite sheet can take longer than the entire pour. Start only once art can actually be painted.
    let dropAt = Infinity;
    const srcs = [...sources];
    const scene: Scene = {
      engine, srcs, images: srcs.map(() => null), tiles: srcs.map((_, i) => (sheet && cells[i] >= 0 ? cells[i] : null)),
      atlas: createAtlas(), sheet, sheetImg: null, bodies: [],
      grown: new Map(), sharp: new Map(), holds: new Map(), pops: new Map(), box: null, scroll: 0,
      width: 0, height: 0, size: 96, bigSize: 96, midSize: 56, dpr: 1, added: 0, dirty: true, now: performance.now(), animate: !reduced && !pausedRef.current,
      retile(i) {
        const tile = scene.tiles[i];
        if (typeof tile === "number") {
          if (!scene.sheet) return loadOwn(i); // A borrowed cell can return after the packed image failed.
          if (scene.sheetImg?.complete && scene.sheetImg.naturalWidth) scene.atlas.putSheet(i, sheet!, scene.sheetImg, tile);
        } else if (!scene.atlas.putImage(i, tile)) return; // its own picture has not arrived yet; it will call back
        if (dropAt === Infinity && scene.atlas.patch(i)) dropAt = performance.now() + 200;
        if (scene.grown.has(i)) scene.sharp.set(i, renderSprite(scene.images[i], scene.bigSize, scene.dpr)); // keep the enlarged copy crisp after a resize
        scene.dirty = true;
      },
      ensureImage(i) {
        const had = scene.images[i];
        if (had && had.getAttribute("src") === srcs[i]) return had;
        const img = loadImage(srcs[i]);
        scene.images[i] = img;
        return img;
      },
    };
    const { images, bodies, holds, grown, sharp, pops } = scene;
    let press: { pointerId: number; start: Matter.Vector; time: number; local: Matter.Vector; travelled: number; src: string; index: number } | null = null;
    let canceledPointerId: number | null = null;
    let suppressedClick: { x: number; y: number; until: number } | null = null;
    const tilt = createTilt(scene, status => tiltStatusRef.current?.(status));
    tilt.setSuspended(!scene.animate || document.hidden);

    /** Redraw every cell. One pass over the pile, and the only thing a resize costs. */
    const rebake = () => {
      scene.atlas.layout(srcs.length, scene.size * scene.dpr);
      for (let i = 0; i < srcs.length; i++) scene.retile(i);
      scene.dirty = true;
    };

    // The packed sheet: one request for the whole pile. Anything it does not cover, and anything that arrives later,
    // loads its own image and draws itself into its cell when it lands.
    if (sheet) {
      const img = loadImage(sheet.url);
      scene.sheetImg = img;
      if (img.complete && img.naturalWidth) rebake();
      else img.onload = () => rebake();
      img.onerror = () => {
        scene.sheet = null; // no sheet: fall back to one image each, which is slower but still works
        for (let i = 0; i < srcs.length; i++) if (typeof scene.tiles[i] === "number") loadOwn(i);
      };
    }
    /** Give body `i` its own picture for the pile, for want of a cell in the sheet. */
    function loadOwn(i: number) {
      const img = scene.ensureImage(i);
      scene.tiles[i] = img;
      if (img.complete && img.naturalWidth) scene.retile(i);
      else img.onload = () => scene.tiles[i] === img && scene.retile(i);
    }
    srcs.forEach((_, i) => {
      if (scene.tiles[i] === null) loadOwn(i);
    });

    const bounds = createBounds(scene);
    const resize = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (!width || !height || (width === scene.width && height === scene.height && dpr === scene.dpr)) return false;
      if (scene.width > 0) invalidateGesture();
      const previous = { width: scene.width, height: scene.height, size: scene.size };
      scene.width = width;
      scene.height = height;
      scene.dpr = dpr;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Small enough that the settled pile stays under the search bar: at most ~38% of the window, however many images there are.
      const fits = Math.sqrt((0.38 * height * width * 0.75) / Math.max(1, srcs.length));
      scene.size = Math.max(10, Math.min(25, width / 55, fits));
      scene.bigSize = Math.max(64, Math.min(104, width / 12));
      scene.midSize = Math.max(40, Math.min(60, width / 22));
      setIconSize(scene.bigSize);
      resizeFloorBodies(scene, previous);
      bounds.build();
      rebake();
      return true;
    };
    resize();

    const spawn = (i: number) => createIconBody(
      scene.width * (0.1 + 0.8 * ((i * 0.618) % 1)),
      -scene.size * (1.4 + (i % 12) * 1.3),
      scene.size,
      (Math.random() - 0.5) * 0.6,
    );
    images.forEach((_, i) => bodies.push(spawn(i)));

    const drag = createFloorDrag(engine);

    /**
     * What the frames actually cost, measured where they happen. "Smooth" is not an average: a run at 120 fps with one
     * 40 ms frame a second reads as a stutter, and the mean hides it completely. So this keeps the last couple of
     * seconds of frame gaps and reports the median, the 95th, and how many were late enough to see.
     */
    const pace: number[] = [];
    const PACE = 240; // about two seconds at 120 Hz
    const paced = () => {
      if (pace.length < 8) return { fps: 0, p50: 0, p95: 0, late: 0 };
      const sorted = [...pace].sort((a, b) => a - b);
      const at = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
      const mid = at(0.5);
      return {
        fps: Math.round(1000 / mid),
        p50: +mid.toFixed(1),
        p95: +at(0.95).toFixed(1),
        late: pace.filter((d) => d > mid * 1.6).length, // frames that missed their slot by enough to be seen
      };
    };
    const stats = { solverSteps: 0, stepMs: 0, drawMs: 0, awake: 0, swaps: 0, gx: 0, gy: 1, paced }; // read from the console as window.__floor when chasing lag
    (window as unknown as { __floor?: unknown }).__floor = Object.assign(stats, createDebug(scene));
    const overlays = createOverlays(scene, { labels: () => labelRefs.current, tip: () => tipRef.current, frame: () => frameRef.current, clip: () => clipRef.current, content: () => contentRef.current, beam: () => beamRef.current });
    const swaps = createSwaps(scene, (i) => i === press?.index, invalidateGesture, stats, featuredCount, reserveSources);
    const matches = createMatches(scene, overlays, swaps, loadImage, invalidateGesture, featuredCount);
    Object.assign(stats, { holes: () => matches.holes() });

    const poses = createRenderPoses(bodies);
    let blend = 1;
    let canInterpolate = false;
    const drawnPose = (i: number) => poses.at(i, blend);
    let raf = 0;
    let frames = 0;
    let last = performance.now();
    let acc = 0;
    const resetClock = () => {
      last = performance.now();
      acc = 0;
      canInterpolate = false;
      blend = 1;
    };
    let lastShake = 0;
    let wasAwake = false;

    const placeRemaining = () => {
      const columns = Math.max(1, Math.floor((scene.width - scene.size) / scene.size));
      for (let i = scene.added; i < bodies.length; i++) {
        const body = bodies[i];
        Matter.Composite.add(engine.world, body);
        Matter.Body.setPosition(body, {
          x: scene.size + (i % columns) * scene.size,
          y: scene.height - scene.size / 2 - Math.floor(i / columns) * scene.size,
        });
        Matter.Body.setAngle(body, 0);
        Matter.Sleeping.set(body, true);
      }
      scene.added = bodies.length;
      scene.dirty = true;
    };
    if (!scene.animate) placeRemaining();
    setAnimateBeam(scene.animate);

    const syncMotion = () => {
      const animate = !pausedRef.current && !reduced;
      if (animate === scene.animate) return;
      invalidateGesture();
      scene.animate = animate;
      setAnimateBeam(animate);
      tilt.setSuspended(!animate || document.hidden);
      if (!animate) {
        swaps.finish();
        placeRemaining();
        matches.relayout();
      }
      resetClock();
    };

    const paint = (i: number, scale: number) => {
      const sprite = (scale > 1 ? sharp.get(i) : null) ?? scene.atlas.patch(i);
      if (!sprite) return;
      const body = drawnPose(i);
      const pop = pops.get(i);
      const side = scene.size * scale * (pop ? popScale(scene.now - pop.t0) : 1);
      if (side < 0.5) return;
      const { dpr } = scene;
      const cos = Math.cos(body.angle);
      const sin = Math.sin(body.angle);
      ctx.setTransform(dpr * cos, dpr * sin, -dpr * sin, dpr * cos, dpr * body.position.x, dpr * body.position.y); // one call instead of save/translate/rotate/restore
      ctx.drawImage(sprite.img, sprite.x, sprite.y, sprite.w, sprite.w, -side / 2, -side / 2, side, side);
    };

    const draw = () => {
      const { dpr, box } = scene;
      ctx.clearRect(0, 0, scene.width, scene.height);
      for (let i = 0; i < scene.added; i++) if (!grown.has(i)) paint(i, 1);
      // Grown icons go on top. Those still rising, or shrinking on the way down, are painted freely. Those that have
      // settled belong to the container: they are clipped to it, which is what lets it scroll.
      const settled: number[] = [];
      grown.forEach((scale, i) => {
        if (drag.body !== bodies[i] && isClippedResult(scene, i)) settled.push(i);
        else paint(i, scale);
      });
      if (box && settled.length) {
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.beginPath();
        ctx.roundRect(box.x + 1, box.y + 1, box.width - 2, box.height - 2, 4);
        ctx.clip();
        for (const i of settled) {
          const y = bodies[i].position.y;
          const reach = scene.size * (grown.get(i) ?? 1);
          if (y + reach > box.y && y - reach < box.y + box.height) paint(i, grown.get(i) ?? 1); // rows scrolled out of sight are skipped
        }
        ctx.restore();
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    /**
     * An image swapping in the resting pile changes a patch a few dozen pixels wide. Repainting only that patch, and not
     * millions of pixels of canvas three times a second, is what keeps a large window smooth while nothing else moves.
     */
    const drawSwaps = () => {
      const { dpr, size } = scene;
      const r = size * 0.9; // the overshoot of the pop, at any angle
      pops.forEach((_, i) => {
        if (grown.has(i)) return;
        const { x, y } = bodies[i].position;
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.beginPath();
        ctx.rect(x - r, y - r, r * 2, r * 2);
        ctx.clip();
        ctx.clearRect(x - r, y - r, r * 2, r * 2);
        for (let k = 0; k < scene.added; k++) {
          const at = bodies[k].position;
          const reach = r + size * (grown.get(k) ?? 1);
          if (Math.abs(at.x - x) < reach && Math.abs(at.y - y) < reach) paint(k, grown.get(k) ?? 1);
        }
        ctx.restore();
      });
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const stepPhysics = (elapsed: number) => {
      if (!needsPhysics(scene, drag.body)) {
        acc = 0;
        canInterpolate = false;
        blend = 1;
        return;
      }
      const tick = advanceClock(acc, elapsed);
      acc = tick.remainder;
      if (tick.steps) canInterpolate = true;
      blend = canInterpolate ? acc / SUBSTEP : 1;
      if (!tick.steps) return;
      const t0 = performance.now();
      for (let step = 0; step < tick.steps; step++) {
        applyGrowth(scene, SUBSTEP / STEP, drag.body);
        applyHoldForces(scene, SUBSTEP, drag.body);
        bounds.limitSpeeds(SUBSTEP);
        if (step === tick.steps - 1) poses.beforeStep(scene.added);
        Matter.Engine.update(engine, SUBSTEP);
      }
      poses.afterStep(scene.added);
      stats.solverSteps += tick.steps;
      stats.stepMs += ((performance.now() - t0) / tick.steps - stats.stepMs) * 0.1;
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (document.hidden) {
        canInterpolate = false;
        last = now;
        acc = 0;
        return;
      }
      const raw = now - last;
      if (raw > 0 && raw < 500) {
        pace.push(raw); // a gap over half a second is the tab being parked, not a dropped frame
        if (pace.length > PACE) pace.shift();
      }
      last = now;
      scene.now = now;
      if (scene.animate) {
        swaps.churn(now);
        // A small library trickles in one by one; a large one pours, so the whole pile is down in about 4 seconds.
        const gap = Math.min(50, 4000 / Math.max(1, bodies.length));
        let poured = 0;
        while (scene.added < bodies.length && now >= dropAt && poured < 12) {
          Matter.Composite.add(engine.world, bodies[scene.added++]);
          dropAt = Math.max(dropAt + gap, now - 100);
          poured++;
          scene.dirty = true;
        }
        stepPhysics(raw);
        swaps.run(now);
        bounds.patrol(++frames);
      } else {
        frames++;
        blend = 1;
        canInterpolate = false;
        acc = 0;
        if (scene.added < bodies.length) placeRemaining();
      }
      matches.tick(frames);
      let awake = 0;
      for (let i = 0; i < scene.added; i++) if (!bodies[i].isSleeping) awake++;
      stats.awake = awake;
      stats.gx = engine.gravity.x;
      stats.gy = engine.gravity.y;
      if ((awake || wasAwake) && scene.animate) scene.dirty = true;
      wasAwake = awake > 0;
      overlays.place(now, drawnPose);
      if (scene.dirty) {
        const t0 = performance.now();
        draw();
        stats.drawMs += (performance.now() - t0 - stats.drawMs) * 0.1;
        scene.dirty = false;
      } else if (pops.size) {
        // The small pile-only repaint cannot reproduce the ordered, clipped layers of search results.
        if (grown.size) draw();
        else drawSwaps();
      }
    };
    raf = requestAnimationFrame(frame);

    apiRef.current = {
      shake(intensity) {
        const now = performance.now();
        if (!scene.animate || now - lastShake < 70 || !scene.added) return; // a burst of keystrokes must not compound into one big throw
        lastShake = now;
        const power = Math.max(0.05, Math.min(1, intensity)) * Math.max(0.25, scene.size / 110); // tuned at ~110 px icons, scaled to the current size
        // Only a handful of icons jump. Waking the whole pile on every keystroke is what made typing lag.
        const jolts = Math.min(28, Math.ceil(scene.added * 0.06));
        for (let n = 0; n < jolts; n++) {
          const i = Math.floor(Math.random() * scene.added);
          const body = bodies[i];
          if (holds.has(i) || body.position.y < scene.height * 0.45) continue;
          Matter.Sleeping.set(body, false);
          Matter.Body.setVelocity(body, { x: body.velocity.x + (Math.random() - 0.5) * 2.2 * power, y: body.velocity.y - Math.random() * 1.6 * power });
          Matter.Body.setAngularVelocity(body, body.angularVelocity + (Math.random() - 0.5) * 0.04 * power);
        }
        scene.dirty = true;
      },
      select: (found, getAnchor) => matches.select(found, getAnchor),
      release: () => matches.release(),
      add(src) {
        if (srcs.includes(src)) return;
        const i = srcs.push(src) - 1;
        images.push(null);
        scene.tiles.push(null);
        loadOwn(i);
        const body = spawn(i);
        Matter.Body.setPosition(body, { x: scene.width * (0.3 + Math.random() * 0.4), y: -scene.size * 1.5 }); // above the window, under the ceiling: it falls in
        bodies.push(body); // the drop loop adds it to the world on its next tick
        scene.dirty = true;
      },
      setPaused(paused) {
        pausedRef.current = paused;
        syncMotion();
      },
      setTiltEnabled: enabled => tilt.setEnabled(enabled),
      calibrateTilt: () => tilt.calibrate(),
    };
    onReady?.();

    const onReducedMotion = (event: MediaQueryListEvent) => {
      reduced = event.matches;
      syncMotion();
    };
    reducedQuery.addEventListener("change", onReducedMotion);

    // Pointer travel distinguishes an intentional click from throwing a body.
    const worldPoint = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const onPointerDown = (event: PointerEvent) => {
      if (press || event.button !== 0 || !event.isPrimary) return;
      const point = worldPoint(event);
      const hit = pickFloorIcon(scene, point, drawnPose);
      if (!hit) return;
      press = { ...hit, pointerId: event.pointerId, start: point, time: event.timeStamp, travelled: 0, src: srcs[hit.index] };
      canvas.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!press || press.pointerId !== event.pointerId) return;
      const point = worldPoint(event);
      press.travelled = Math.max(press.travelled, Math.hypot(point.x - press.start.x, point.y - press.start.y));
      if (press.travelled <= DRAG_THRESHOLD) return;
      if (!drag.body) {
        const body = bodies[press.index];
        const hold = holds.get(press.index);
        if (hold) hold.parked = false;
        if (scene.animate) wakeNear(scene, body);
        drag.start(body, press.local, press.start, press.time, scene.size * (grown.get(press.index) ?? 1));
      }
      drag.move({
        x: Math.max(0, Math.min(scene.width, point.x)),
        y: Math.max(0, Math.min(scene.height, point.y)),
      }, event.timeStamp, scene.animate);
      scene.dirty = true;
    };
    function finishGesture(fling: boolean, releaseCapture = true) {
      if (!press) return;
      const { index, pointerId } = press;
      press = null;
      if (drag.body) {
        const hold = holds.get(index);
        drag.finish(fling && scene.animate && !hold);
        if (hold) {
          hold.t = 0;
          hold.boost = 1;
          if (!scene.animate) park(scene, index);
        }
        scene.dirty = true;
      }
      if (releaseCapture && canvas?.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
    }
    function invalidateGesture(index?: number) {
      if (!press || (index !== undefined && press.index !== index)) return;
      canceledPointerId = press.pointerId;
      // Keep capture through pointerup so a button beneath a canceled drag cannot receive the release.
      finishGesture(false, false);
    }
    function suppressClick(event: PointerEvent) {
      suppressedClick = { x: event.clientX, y: event.clientY, until: performance.now() + 500 };
      event.preventDefault();
    }
    const onPointerUp = (event: PointerEvent) => {
      if (canceledPointerId === event.pointerId) {
        canceledPointerId = null;
        suppressClick(event);
        if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
        return;
      }
      if (!press || press.pointerId !== event.pointerId) return;
      onPointerMove(event);
      const selected = press;
      const dropBounds = dropRef.current.getDropBounds?.() ?? null;
      const action = classifyRelease(selected.travelled, event.clientX, event.clientY, dropBounds);
      finishGesture(action === "ignore");
      if (action === "select") selectRef.current?.(selected.src);
      else {
        suppressClick(event);
        if (action === "drop") dropRef.current.onResourceDrop?.(selected.src);
      }
    };
    const onClick = (event: MouseEvent) => {
      if (!suppressedClick || performance.now() > suppressedClick.until || Math.hypot(event.clientX - suppressedClick.x, event.clientY - suppressedClick.y) > 2) return;
      suppressedClick = null;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const onPointerCancel = (event: PointerEvent) => {
      if (press?.pointerId === event.pointerId) invalidateGesture();
    };
    const clearOldClick = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0) return;
      suppressedClick = null;
      if (canceledPointerId === event.pointerId) canceledPointerId = null;
    };
    const onBlur = () => invalidateGesture();
    const onVisibilityChange = () => {
      tilt.setSuspended(!scene.animate || document.hidden);
      resetClock();
      if (document.hidden) invalidateGesture();
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("pointerdown", clearOldClick, true);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("lostpointercapture", onPointerCancel);
    window.addEventListener("blur", onBlur);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    document.addEventListener("visibilitychange", onVisibilityChange);

    const onResize = () => {
      if (resize()) matches.relayout();
    };
    window.addEventListener("resize", onResize);
    // The wheel scrolls the container when the cursor is over it and there is more than fits.
    const onWheel = (e: WheelEvent) => {
      if (matches.scrollBy(e.deltaY, e.clientX, e.clientY)) e.preventDefault();
    };
    window.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      tilt.stop();
      finishGesture(false);
      if (canceledPointerId !== null && canvas.hasPointerCapture(canceledPointerId)) canvas.releasePointerCapture(canceledPointerId);
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("lostpointercapture", onPointerCancel);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("pointerdown", clearOldClick, true);
      reducedQuery.removeEventListener("change", onReducedMotion);
      overlays.destroy();
      swaps.stop();
      Matter.Events.off(engine, "beforeUpdate afterUpdate collisionStart collisionActive collisionEnd");
      apiRef.current = null;
      Matter.Composite.clear(engine.world, false);
      Matter.Engine.clear(engine);
    };
  }, [sources, featuredCount, reserveSources, cells, sheet, apiRef, onReady]);

  return (
    <>
      {/* The container the matches gather in. It comes before the canvas, so every icon is drawn over it. */}
      <div ref={frameRef} aria-hidden className="match-frame pointer-events-none fixed left-0 top-0 rounded-[5px] border border-line bg-panel" style={{ opacity: 0 }} />
      <canvas ref={canvasRef} role="img" aria-label="Interactive resource icons. Drag to move them or click to open details. The same resources are available in the results list." className="fixed inset-0 h-full w-full" style={{ touchAction: "none" }} />
      {/* The real border-beam, riding the best match's actual edge. The icon itself is still drawn by the
          canvas underneath; this layer is only the rim of light, and it copies the body's pose every frame. */}
      <div
        ref={beamRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 will-change-transform"
        style={{ width: iconSize, height: iconSize, opacity: 0, borderRadius: iconSize * 0.225,
          transition: animateBeam ? "opacity 300ms ease-out" : "none", boxShadow: animateBeam ? undefined : "inset 0 0 0 1.5px #bcb9cc" }}
      >
        {animateBeam && <BorderBeam size="md" colorVariant="colorful" theme="dark" strength={1} brightness={1.9} saturation={1.5} borderRadius={iconSize * 0.225}>
          <div style={{ width: iconSize, height: iconSize, borderRadius: iconSize * 0.225 }} />
        </BorderBeam>}
      </div>
      {/* The container again, in front of the canvas this time: it clips the labels and carries the soft edges that
          show there is more to scroll to. One probability label per match, each placed once in its cell. */}
      <div ref={clipRef} aria-hidden data-above="false" data-below="false" className="match-clip pointer-events-none fixed left-0 top-0 z-20 overflow-hidden rounded-[5px]" style={{ opacity: 0 }}>
        <div ref={contentRef} className="absolute inset-0 will-change-transform">
          {Array.from({ length: MOST }, (_, k) => (
            <div
              key={k}
              ref={setLabel[k]}
              className="match-label absolute left-0 top-0 rounded-[4px] border border-line-strong bg-panel px-2 py-0.5 text-[11.5px] font-medium tabular-nums tracking-[-0.01em] text-muted data-[best=true]:text-text data-[small=true]:px-1.5 data-[small=true]:text-[10px]"
              style={{ opacity: 0 }}
            />
          ))}
        </div>
      </div>
      {/* What the match under the cursor is: a box with a caret pointing down at it. The words fade in one after another. */}
      <div ref={tipRef} aria-hidden data-open="false" data-side="top" className="match-tip pointer-events-none fixed left-0 top-0 z-30 will-change-transform">
        <div className="relative max-w-[290px] rounded-[5px] border border-line-strong bg-raised px-4 py-3 will-change-[filter,transform]">
          <p data-part="name" className="text-[14px] font-semibold tracking-[-0.012em] text-text" />
          <p data-part="tagline" className="mt-1 text-[12.5px] leading-[1.45] text-muted" />
          <p data-part="detail" className="mt-2 text-[11px] tracking-[0.02em] text-faint" />
          <span className="match-tip-caret border-line-strong bg-raised" />
        </div>
      </div>
    </>
  );
});
