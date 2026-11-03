/** Resource IDs stay in the URL even when several records use the same artwork. */
export function resourceIconUrl(id: string): string {
  return `/api/resource-icon/${encodeURIComponent(id)}?v=3`;
}

/** GitHub project pages have project-specific artwork, separate from the host favicon. */
export function iconHost(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!['https:', 'http:'].includes(parsed.protocol)) return null;
    const host = parsed.hostname.toLowerCase();
    const segments = parsed.pathname.split('/').filter(Boolean);
    if ((host === 'github.com' || host === 'www.github.com') && segments.length >= 2) return null;
    return host || null;
  } catch {
    return null;
  }
}

export function resourceMonogram(name: string, identity: string): string {
  // Only a tiny allowlisted alphabet reaches SVG markup, including for imported names.
  const letters = name.split(/[^a-z0-9]+/i).filter(Boolean).map(word => word[0]).slice(0, 2).join('').toUpperCase() || '?';
  let hash = 0;
  for (const char of identity) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
  const hue = hash % 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" rx="26" fill="hsl(${hue} 48% 31%)"/><text x="64" y="82" text-anchor="middle" font-family="Arial,sans-serif" font-size="49" font-weight="600" fill="white">${letters}</text></svg>`;
}
