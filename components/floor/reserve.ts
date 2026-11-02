/**
 * The pile shows a few hundred images out of thousands. This keeps a short queue of other images from the library,
 * already loaded, so that one can pop into the pile at any moment without showing an empty tile first.
 */
export function createReserve(inPile: (src: string) => boolean) {
  const ready: HTMLImageElement[] = [];
  let busy = false;
  let loading = 0; // images asked for that have not arrived yet, so a slow network is not asked again and again
  let stopped = false;
  const controller = new AbortController();

  const refill = async () => {
    if (busy || stopped) return;
    busy = true;
    try {
      const response = await fetch("/api/resources?sample=16", { signal: controller.signal });
      if (!response.ok || stopped) return;
      const data = (await response.json()) as { srcs?: string[] };
      if (stopped) return;
      for (const src of data.srcs ?? []) {
        if (inPile(src)) continue;
        const img = new Image();
        img.decoding = "async";
        loading++;
        img.onload = () => {
          loading--;
          if (!stopped) ready.push(img);
        };
        img.onerror = () => loading--;
        img.src = src;
      }
    } catch {
      // A later churn cycle can retry while the page remains active.
    } finally {
      busy = false;
    }
  };

  return {
    /** The next loaded image that is not in the pile, or nothing if the queue is still filling. */
    next(): HTMLImageElement | undefined {
      if (ready.length + loading < 5) refill();
      while (ready.length) {
        const img = ready.shift()!;
        if (!inPile(img.getAttribute("src") ?? "")) return img;
      }
    },
    stop() {
      stopped = true;
      controller.abort();
      ready.length = 0;
    },
  };
}
