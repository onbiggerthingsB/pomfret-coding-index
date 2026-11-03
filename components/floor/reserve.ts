/** A few decoded, verified logos sit ready for the next drop. Removed community logos rejoin the rotation. */
export function createReserve(community: string[]) {
  const ready = new Map<string, HTMLImageElement>();
  const loading = new Set<string>();
  let cursor = 0;
  let stopped = false;

  return {
    next(occupied: Set<string>) {
      for (let checked = 0; checked < community.length && ready.size + loading.size < 4; checked++) {
        const src = community[cursor];
        cursor = (cursor + 1) % community.length;
        if (occupied.has(src) || loading.has(src) || ready.has(src)) continue;
        const img = new Image();
        img.decoding = "async";
        loading.add(src);
        img.onload = () => {
          loading.delete(src);
          if (!stopped) ready.set(src, img);
        };
        img.onerror = () => loading.delete(src);
        img.src = src;
      }
      for (const [src, img] of ready) {
        ready.delete(src);
        if (!occupied.has(src)) return img;
      }
    },
    stop() {
      stopped = true;
      ready.clear();
    },
  };
}
