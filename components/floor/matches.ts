import Matter from "matter-js";
import { park, wakeAt, wakeNear } from "./forces.ts";
import { gridLayout, LABEL, type Anchor, type Layout } from "./layout.ts";
import type { createOverlays } from "./overlays";
import type { Match, Pop, Scene } from "./scene";
import { renderSprite } from "./sprite.ts";
import type { createSwaps } from "./swaps";

const LOOKAHEAD = 0; // a row wholly outside the container is not launched at all: its cell is out in the page, under the search bar
const KEEP = 3; // rows beyond the view a match may stay in before it gives its icon back

type Pending = { slot: number; pop?: Pop };
type Shown = {
  matches: Match[];
  layout: Layout;
  getAnchor: () => Anchor;
  launched: Set<number>; // cells that have an icon in them or on the way to them
  pending: Map<number, Pending>; // unique reservation per launch, including a later visit to the same cell
  sources: Set<string>; // matches already in the pile keep their own slot until their row appears
  taken: Set<number>; // pile icons spoken for, so two cells cannot claim the same one
};

/**
 * The matches of one search: where each belongs in the container, which have set off, and how far the container is
 * scrolled. Only the rows that can be seen set off. The rest wait in the pile and rise when they are scrolled into
 * view, so a search with a hundred matches costs no more than one with twenty.
 */
export function createMatches(scene: Scene, overlays: ReturnType<typeof createOverlays>, swaps: ReturnType<typeof createSwaps>, loadImage: (src: string) => HTMLImageElement, invalidateGesture: (i: number) => void, featuredCount = 0) {
  const { bodies, holds, grown, sharp, pops, srcs } = scene;

  /**
   * The enlarged, full-resolution copies of the matches, a few per frame.
   *
   * Each one is a canvas several times the area of a pile icon, with two gradients painted into it. Doing all
   * hundred-odd of them in the frame the answer arrives cost 89 ms, which is a visible jolt at exactly the moment the
   * page is meant to feel quick. Spread over the following frames they are all done inside a quarter of a second, and
   * until a match has its own copy it is simply drawn from its cell in the sheet.
   *
   * The picture is loaded only now, too: the pile draws from the packed sheet and decodes no full-size images at all,
   * so this is the only place a logo's own file is ever needed.
   */
  const wanted = new Map<number, number>(); // body -> the size it wants a full-resolution copy at
  const makeSharp = (i: number, side: number) => wanted.set(i, side);

  // Three a frame, not six. Each is a canvas allocation and two gradients at up to 96 px, and at 120 Hz three still
  // finishes sixty matches in under a fifth of a second while keeping the per-frame cost under the vsync budget.
  const PER_FRAME = 3;
  const drawSharp = () => {
    let budget = PER_FRAME;
    for (const [i, side] of wanted) {
      if (budget-- <= 0) return;
      wanted.delete(i);
      if (holds.get(i)?.rest.side !== side) continue; // let go, or laid out again at another size, while it queued
      const img = scene.ensureImage(i);
      if (img.complete && img.naturalWidth) {
        sharp.set(i, renderSprite(img, side, scene.dpr));
        scene.dirty = true;
      } else {
        img.addEventListener("load", () => {
          if (holds.get(i)?.rest.side !== side) return;
          wanted.set(i, side);
          scene.dirty = true;
        }, { once: true });
      }
    }
  };
  // Out-of-pile matches borrow a slot for the search. Keep the actual artwork,
  // including its sheet cell, so retiring a result restores the same resource.
  const borrowed = new Map<number, { src: string; image: Scene["images"][number]; tile: Scene["tiles"][number] }>();
  const restore = (i: number) => {
    const prior = borrowed.get(i);
    if (!prior) return;
    invalidateGesture(i);
    borrowed.delete(i);
    pops.delete(i);
    srcs[i] = prior.src;
    scene.images[i] = prior.image;
    scene.tiles[i] = prior.tile;
    sharp.delete(i);
    scene.retile(i);
    scene.dirty = true;
  };
  let shown: Shown | null = null;
  let token = 0; // bumps on every select/release, so an image that finishes loading late knows it is no longer wanted

  /**
   * `fly` is the difference between answering a search and browsing one. The first screenful flies up out of the pile,
   * which is the whole point of the page. Rows you scroll to afterwards simply appear in their places: a list that threw
   * a hundred icons through the air every time you turned the wheel was chaos, and nobody reads a list that way.
   */
  const begin = (i: number, rank: number, fly: boolean) => {
    if (!shown) return;
    invalidateGesture(i);
    const rest = shown.layout.rests[rank];
    const match = shown.matches[rank];
    const label = overlays.assign(i, rank, match, rest, shown.layout.small);
    holds.set(i, { rest, scale: rest.side / scene.size, startY: bodies[i].position.y, t: 0, boost: 1, rank, label, arrived: false, match, labelled: false, parked: false });
    if (!grown.has(i)) grown.set(i, 1);
    // Matches still shoulder the pile aside, but never each other: two that had to cross once blocked each other in mid-air.
    bodies[i].collisionFilter.group = -1;
    makeSharp(i, rest.side);
    wakeNear(scene, bodies[i]); // either way it is about to leave this spot, so what was resting on it has to fall
    if (!fly || !scene.animate) {
      const previousScale = grown.get(i) ?? 1;
      grown.set(i, rest.side / scene.size);
      const change = rest.side / scene.size / previousScale;
      Matter.Body.scale(bodies[i], change, change);
      park(scene, i);
    }
    scene.dirty = true;
  };

  /**
   * Is this match's cell in view, or within `margin` cells of it? A filter can return hundreds, far more than the pile
   * has icons to lend, so only the rows you can see (and a little either side) hold a real icon. The rest wait.
   */
  const nearView = (rank: number, margin = 0) => {
    if (!shown?.layout.box) return false;
    const { box, rests } = shown.layout;
    const rest = rests[rank];
    const reach = margin * (rest.side + LABEL);
    const y = rest.y - scene.scroll;
    return y + rest.side / 2 + reach > box.y && y - rest.side / 2 - LABEL - reach < box.y + box.height;
  };

  /**
   * Is this cell wholly inside the container, rather than the half row that peeks out of the bottom edge?
   *
   * Only a cell that is wholly inside is worth flying to. A cell in the peek row sits a few pixels below the container,
   * out in the gap above the search bar, so an icon on its way there hovers in plain sight under the bar for two to
   * four seconds and then parks half out of the box. That is what looked like icons getting stuck under the search
   * bar. The peek row is content, like anything else in a scrolling list, so it simply appears in place.
   */
  const whollyInView = (rank: number) => {
    if (!shown?.layout.box) return false;
    const { box, rests } = shown.layout;
    const rest = rests[rank];
    const y = rest.y - scene.scroll;
    return y - rest.side / 2 - LABEL >= box.y && y + rest.side / 2 <= box.y + box.height;
  };

  /**
   * Matches scrolled well out of the way give their icon back to the pile, so the next rows have one to use. It is put
   * back quietly, asleep and down among the others, rather than dropped from where it was: a hundred icons raining down
   * the page while you scroll is exactly the mess this is here to avoid.
   */
  const RETIRE_AT_ONCE = 6; // a flick can scroll past a dozen rows in a frame; giving them all back at once is the spike
  const QUIET = 140; // ms of stillness before icons are handed back, so a moving scroll never pays for it
  const SPARE_ENOUGH = 40; // unless the pile is running this low on lendable icons, in which case hand some back now
  const cancelPending = (current: Shown, rank: number, pending: Pending) => {
    current.pending.delete(rank);
    current.taken.delete(pending.slot);
    if (pending.pop && pops.get(pending.slot) === pending.pop) {
      pops.delete(pending.slot);
      scene.dirty = true; // paint the original resource at its full size again
    }
  };
  const retire = () => {
    if (!shown) return;
    let budget = RETIRE_AT_ONCE;
    for (const [i, hold] of [...holds]) {
      if (nearView(hold.rank, KEEP)) continue;
      if (budget-- <= 0) return; // the rest go back on the next frame: they are far out of sight either way
      invalidateGesture(i);
      const body = bodies[i];
      const scale = grown.get(i) ?? 1;
      if (scale !== 1) Matter.Body.scale(body, 1 / scale, 1 / scale);
      grown.delete(i);
      sharp.delete(i);
      body.collisionFilter.mask = 0xffffffff;
      body.collisionFilter.group = 0;
      // Only the pile it lands in has to make room. Waking where it used to be is a full scan of the pile for nothing:
      // a match sits high above it, so there is never anything resting on it up there.
      if (body.position.y > scene.height * 0.5) wakeAt(scene, body.position.x, body.position.y);
      Matter.Body.setPosition(body, { x: scene.size + Math.random() * Math.max(1, scene.width - scene.size * 2), y: scene.height - scene.size * (0.5 + Math.random() * 3) });
      wakeAt(scene, body.position.x, body.position.y);
      Matter.Body.setVelocity(body, { x: 0, y: 0 });
      Matter.Body.setAngle(body, (Math.random() - 0.5) * 0.6);
      Matter.Body.setAngularVelocity(body, 0);
      Matter.Sleeping.set(body, true);
      overlays.fade(hold.label);
      holds.delete(i);
      shown.launched.delete(hold.rank);
      shown.taken.delete(i);
      restore(i);
      if (typeof scene.tiles[i] === "number") scene.images[i] = null; // the sheet still has its pile-sized copy, so let the big one go
      scene.retile(i);
    }
    // Cells that were waiting on a picture and have since scrolled well away give their pile icon back too.
    for (const [rank, pending] of shown.pending) {
      if (nearView(rank, KEEP)) continue;
      cancelPending(shown, rank, pending);
    }
  };

  /**
   * Which cells are waiting for an icon, best first. They do not all set off at once.
   *
   * Sixty icons leaving the pile in the same frame is a scrum: they shoulder each other, take seconds to get through,
   * and the ones still in the air when the three-second patience runs out were being counted as arrived and cut off at
   * the edge of the container, which is why they seemed to vanish under the search bar. A few at a time reach their
   * cells quickly and cleanly, and it reads as a wave filling the grid rather than as a swarm.
   */
  const WAVE = 3; // icons that set off together
  const WAVE_GAP = 70; // ms between waves: sixty matches are all away inside a second and a half
  const queue: { rank: number; fly: boolean }[] = [];
  let waveAt = 0;

  /** The pile's spare icons. Worked out once per wave, not once per cell, which is the whole cost of a scroll. */
  const spareIcons = () => {
    const list: number[] = [];
    for (let k = featuredCount; k < scene.added; k++) {
      if (!grown.has(k) && !shown?.taken.has(k) && !shown?.sources.has(srcs[k]) && !pops.has(k) && bodies[k].position.y < scene.height + scene.size) list.push(k);
    }
    return list;
  };

  /** Every cell in view that has no icon yet and none on the way, in rank order, queued to set off. */
  const fill = (fly: boolean) => {
    if (!shown) return;
    const { matches, launched, pending } = shown;
    queue.length = 0;
    matches.forEach((_, rank) => {
      if (launched.has(rank) || pending.has(rank) || !nearView(rank, LOOKAHEAD)) return;
      queue.push({ rank, fly: fly && whollyInView(rank) });
    });
  };

  /**
   * One cell sets off. Returns false when there was no icon to give it, in which case it stays at the head of the
   * queue and the next wave tries again: a cell must never be quietly abandoned, or it stays empty in the grid.
   */
  const launch = (rank: number, fly: boolean, spare: number[]) => {
    if (!shown) return false;
    const { matches, launched } = shown;
    const match = matches[rank];
    const mine = token;
    const i = srcs.indexOf(match.src);
    if (i >= 0 && i < scene.added && !shown.taken.has(i) && !pops.has(i) && !holds.has(i)) {
      // The spare list was built for the whole wave. This exact match is no longer available to a later rank.
      const spareIndex = spare.indexOf(i);
      if (spareIndex >= 0) spare.splice(spareIndex, 1);
      launched.add(rank);
      shown.taken.add(i);
      begin(i, rank, fly);
      return true;
    }
    // The pile only shows a sample of the library. For a match that is not in it, a random image pops away,
    // the match springs up in its place, and it rises from there like any other.
    if (i >= 0 || !spare.length) return false;
    const slot = spare.splice(Math.floor(Math.random() * spare.length), 1)[0];
    // Counted as pending, not launched, until it actually sets off. Marking it launched here and then scrolling away
    // before the picture arrived left the cell marked as done for good, with nothing in it and its pile icon never
    // given back, which is what emptied the container after a hard scroll.
    const pending: Pending = { slot };
    shown.pending.set(rank, pending);
    shown.taken.add(slot);
    const original = { src: srcs[slot], image: scene.images[slot], tile: scene.tiles[slot] };
    const img = loadImage(match.src);
    const current = () => mine === token && shown?.pending.get(rank) === pending;
    const done = () => {
      if (!shown || !current()) return;
      shown.pending.delete(rank);
      borrowed.set(slot, original);
      if (launched.has(rank) || !nearView(rank, LOOKAHEAD)) {
        shown.taken.delete(slot);
        restore(slot);
        return;
      }
      launched.add(rank);
      begin(slot, rank, fly && whollyInView(rank));
    };
    const ready = () => {
      if (current()) pending.pop = swaps.swapIn(slot, img, match.src, 0, done);
    };
    const give = () => {
      // Its picture will not load. Hand the icon back so the cell can be filled by a later wave rather than
      // staying empty in the middle of the grid.
      if (shown && current()) cancelPending(shown, rank, pending);
    };
    if (img.complete && img.naturalWidth) ready();
    else {
      img.onload = ready;
      img.onerror = give;
    }
    return true;
  };

  /** The next few off the queue, at most one wave per `WAVE_GAP`. */
  const drain = (now: number) => {
    if (!shown || !queue.length || (scene.animate && now - waveAt < WAVE_GAP)) return;
    waveAt = now;
    const spare = spareIcons();
    let launched = 0;
    for (let remaining = queue.length; remaining > 0 && launched < WAVE; remaining--) {
      const next = queue.shift()!;
      if (shown.launched.has(next.rank) || shown.pending.has(next.rank) || !nearView(next.rank, LOOKAHEAD)) continue;
      // A match not yet poured in can wait its turn while other visible matches launch.
      if (launch(next.rank, next.fly, spare)) launched++;
      else queue.push(next);
    }
  };

  const release = () => {
    token++;
    if (shown) for (const [rank, pending] of shown.pending) cancelPending(shown, rank, pending);
    shown = null;
    for (const i of borrowed.keys()) restore(i);
    queue.length = 0;
    scene.box = null;
    overlays.frame(null);
    if (!holds.size) return;
    holds.forEach((hold, i) => {
      invalidateGesture(i);
      Matter.Sleeping.set(bodies[i], false);
      bodies[i].collisionFilter.mask = 0xffffffff; // it collides again on the way down
      bodies[i].collisionFilter.group = 0;
      overlays.fade(hold.label);
    });
    if (!scene.animate) {
      const columns = Math.max(1, Math.floor((scene.width - scene.size) / scene.size));
      grown.forEach((scale, i) => {
        const body = bodies[i];
        Matter.Body.scale(body, 1 / scale, 1 / scale);
        Matter.Body.setPosition(body, {
          x: scene.size + (i % columns) * scene.size,
          y: scene.height - scene.size / 2 - Math.floor(i / columns) * scene.size,
        });
        Matter.Body.setAngle(body, 0);
        Matter.Body.setVelocity(body, { x: 0, y: 0 });
        Matter.Body.setAngularVelocity(body, 0);
        Matter.Sleeping.set(body, true);
      });
      grown.clear();
      sharp.clear();
    }
    holds.clear(); // the springs stop, so gravity alone carries them back down, shrinking as they go
    scene.dirty = true;
  };

  /**
   * Scrolling moves the labels at once, as one layer, so every icon that has reached its cell has to move just as
   * rigidly. Parked ones are set exactly. Ones that have arrived but are still settling are shifted by the same amount
   * (setPosition keeps their velocity), so they go on settling while they scroll. Left to their springs they lagged
   * behind their labels and wobbled. Only icons still on their way up from the pile are steered by the spring.
   */
  const scrollIcons = (by: number) => {
    holds.forEach((hold, i) => {
      if (hold.parked || hold.arrived || hold.labelled) invalidateGesture(i);
      if (hold.parked) Matter.Body.setPosition(bodies[i], { x: hold.rest.x, y: hold.rest.y - scene.scroll });
      else if (hold.arrived || hold.labelled) Matter.Body.setPosition(bodies[i], { x: bodies[i].position.x, y: bodies[i].position.y - by });
    });
    scene.dirty = true;
  };

  // A trackpad sends a hundred wheel events a second. Moving the icons, retiring the ones scrolled away and working
  // out which cells are newly in view all scan the whole pile, so they happen once a frame instead, however many
  // events arrived. `scene.scroll` is still exact the instant the wheel turns; only the work waits.
  let scrolledBy = 0;
  let scrollPending = false;
  let scrolledAt = -1e9; // when the wheel last turned

  return {
    release,

    /** Once a frame: the scroll's real work, the next wave off the queue, and a few more full-resolution copies. */
    tick(frame: number) {
      if (scrollPending) {
        scrollPending = false;
        if (shown) {
          overlays.scroll(scene.scroll, shown.layout.scrollMost);
          scrollIcons(scrolledBy);
          fill(false);
        }
        scrolledBy = 0;
      }
      /**
       * Handing an icon back is the expensive half of scrolling: it is rescaled, dropped into the pile, has its cell of
       * the atlas redrawn, and wakes every neighbour so the pile makes room for it. Doing that while the wheel is still
       * turning had the pile permanently churning, four and a half times the physics cost and eighty-odd late frames in
       * a hard scroll. None of it is urgent, because 500 icons in the pile is far more than the eighty-odd cells in
       * view need. So it waits for the scroll to go quiet, unless the spare icons are genuinely running out.
       */
      // The running-low check is itself a scan of the pile, so it happens a few times a second, not every frame.
      const quiet = scene.now - scrolledAt > QUIET;
      if (shown && (quiet || (frame % 12 === 0 && spareIcons().length < SPARE_ENOUGH))) retire();
      drain(scene.now);
      if (wanted.size) drawSharp();
      // A cell whose icon never arrived, or that had none to spare, is queued again a few times a second.
      if (frame % 30 === 0 && shown && shown.launched.size < shown.matches.length && !queue.length) fill(false);
    },

    /** How many cells in view are still waiting for an icon. Read from the console as `__floor.holes()`. */
    holes() {
      if (!shown) return 0;
      let n = 0;
      shown.matches.forEach((_, rank) => {
        if (!shown!.launched.has(rank) && nearView(rank)) n++;
      });
      return n;
    },

    select(matches: Match[], getAnchor: () => Anchor) {
      release();
      token++;
      // A background swap queued just before this search must not claim the same icon as a result.
      for (const [i, pop] of pops) {
        if (pop.rain && !pop.swapped) {
          pops.delete(i);
          scene.dirty = true;
        }
      }
      const few = matches;
      const layout = gridLayout(few.length, getAnchor(), scene, scene.bigSize);
      shown = { matches: few, layout, getAnchor, launched: new Set(), pending: new Map(), taken: new Set(), sources: new Set(few.map(match => match.src)) };
      scene.box = layout.box;
      scene.scroll = 0;
      scrolledBy = 0;
      scrollPending = false;
      overlays.frame(layout.box);
      overlays.scroll(0, layout.scrollMost);
      waveAt = 0; // the best match leaves on the very next frame, not after a wave's wait
      fill(scene.animate);
    },

    /** The wheel over the container. Says whether it took the scroll. */
    scrollBy(dy: number, x: number, y: number): boolean {
      const box = shown?.layout.box;
      if (!shown || !box || !shown.layout.scrollMost || x < box.x || x > box.x + box.width || y < box.y || y > box.y + box.height) return false;
      const to = Math.max(0, Math.min(shown.layout.scrollMost, scene.scroll + dy));
      if (to === scene.scroll) return true;
      scrolledBy += to - scene.scroll;
      scene.scroll = to;
      scrolledAt = scene.now;
      scrollPending = true; // the frame loop moves the icons and the labels together
      return true;
    },

    /** The window changed: the grid is laid out again and every match is pulled to its new cell and size. */
    relayout() {
      if (!shown) return;
      const layout = (shown.layout = gridLayout(shown.matches.length, shown.getAnchor(), scene, scene.bigSize));
      scene.box = layout.box;
      scene.scroll = Math.min(scene.scroll, layout.scrollMost);
      overlays.frame(layout.box);
      overlays.scroll(scene.scroll, layout.scrollMost);
      holds.forEach((hold, i) => {
        invalidateGesture(i);
        hold.rest = layout.rests[hold.rank];
        hold.scale = hold.rest.side / scene.size;
        hold.parked = false; // back under the spring, which carries it over and parks it again
        hold.t = Math.min(hold.t, 4);
        Matter.Sleeping.set(bodies[i], false);
        makeSharp(i, hold.rest.side);
        overlays.move(hold.label, hold.rest);
        if (!scene.animate) {
          const change = hold.scale / (grown.get(i) ?? 1);
          Matter.Body.scale(bodies[i], change, change);
          grown.set(i, hold.scale);
          park(scene, i);
        }
      });
      retire();
      fill(false);
    },
  };
}
