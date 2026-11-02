export type DropBounds = { left: number; right: number; top: number; bottom: number };

/** Maximum pointer travel, rather than final displacement, distinguishes throwing from clicking. */
export function classifyRelease(travelled: number, x: number, y: number, bounds: DropBounds | null): "select" | "drop" | "ignore" {
  if (!Number.isFinite(travelled) || travelled < 0) return "ignore";
  if (travelled <= 7) return "select";
  if (!bounds || ![x, y, bounds.left, bounds.right, bounds.top, bounds.bottom].every(Number.isFinite)) return "ignore";
  if (bounds.right <= bounds.left || bounds.bottom <= bounds.top) return "ignore";
  return x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom ? "drop" : "ignore";
}
