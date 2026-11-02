// Offline adaptation of Orbkit SHDR-11 (Hydrogen), copyright 2026 zzzzshawn.
// See public/orb/LICENSE.txt. Run with `node scripts/render-hydrogen.mjs`.
// Sharp is already supplied by this app's Next.js dependency.
import sharp from "sharp";
import { fileURLToPath } from "node:url";

// Six seconds of motion at 60 distinct samples per second. At 84 pixels each
// frame stays sharp at double the button size, and the sheet fits in 2048 px.
const columns = 24;
const rows = 15;
const frameCount = columns * rows;
const tile = 84;
const scale = 2;
const side = tile * scale;
const atlasWidth = side * columns;
const atlasHeight = side * rows;
const pixels = Buffer.alloc(atlasWidth * atlasHeight * 4);
const tau = Math.PI * 2;
const mix = (a, b, t) => a + (b - a) * t;
const clamp = x => Math.max(0, Math.min(1, x));
const smooth = x => x * x * (3 - 2 * x);

// The upstream orbital has an unbounded noise clock. Travelling around
// a circle in noise space lets each flow field meet itself at the loop seam.
function hash(x, y) {
  let bits = Math.imul(x, 0x3d20adea) ^ Math.imul(y, 0x05526c56);
  bits = Math.imul(bits ^ bits >>> 15, 0x27d4eb2d);
  return ((bits ^ bits >>> 15) >>> 0) / 0xffffffff;
}

function noise(x, y) {
  const i = Math.floor(x), j = Math.floor(y);
  const u = smooth(x - i), v = smooth(y - j);
  return mix(mix(hash(i, j), hash(i + 1, j), u), mix(hash(i, j + 1), hash(i + 1, j + 1), u), v);
}

function flow(x, y) {
  return 0.58 * noise(x, y) + 0.28 * noise(2 * x + 3.7, 2 * y + 1.4) + 0.14 * noise(4 * x - 1.2, 4 * y + 7.1);
}

// One repeating thin-film spectrum. Tight pairs form a hard metal crease
// between the pearl reflection and its warm lip, even at a 38 px display size.
const spectrum = [
  [0.00, [17, 23, 48]], [0.12, [34, 51, 112]], [0.22, [76, 113, 212]],
  [0.31, [161, 191, 247]], [0.37, [235, 237, 241]], [0.42, [255, 224, 185]],
  [0.46, [177, 115, 114]], [0.50, [29, 24, 49]], [0.56, [57, 47, 93]],
  [0.66, [149, 125, 203]], [0.76, [191, 193, 235]], [0.86, [74, 96, 145]],
  [1.00, [17, 23, 48]],
];

function renderFrame(frame) {
  const phase = tau * frame / frameCount;
  const spin = phase + 0.43, cosSpin = Math.cos(spin), sinSpin = Math.sin(spin);
  const tilt = 0.18 + 0.26 * Math.sin(phase + 0.4);
  const cosTilt = Math.cos(tilt), sinTilt = Math.sin(tilt);
  const driftX = 0.58 * Math.cos(phase), driftY = 0.58 * Math.sin(phase);
  const tileX = (frame % columns) * side, tileY = Math.floor(frame / columns) * side;
  const radius = side * 0.485;
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const nx = (x + 0.5 - side / 2) / radius;
      const ny = (side / 2 - y - 0.5) / radius;
      const r2 = nx * nx + ny * ny;
      if (r2 >= 1) continue;
      const nz = Math.sqrt(1 - r2);
      // Rotate the projected dome, precess its spin axis, then warp it before
      // evaluating Hydrogen's radial and angular wave function.
      const domeX = nx * cosSpin - nz * sinSpin;
      const spunZ = nx * sinSpin + nz * cosSpin;
      const domeY = ny * cosTilt - spunZ * sinTilt;
      const domeZ = ny * sinTilt + spunZ * cosTilt;
      const px = domeX + 0.32 * (flow(domeY + driftX, domeZ + driftY) - 0.5);
      const py = domeY + 0.32 * (flow(domeZ - driftY + 3.7, domeX + driftX) - 0.5);
      const pz = domeZ + 0.32 * (flow(domeX - driftX + 7.1, domeY - driftY) - 0.5);
      const r = Math.hypot(px, py, pz) + 0.001;
      const phi = Math.atan2(pz, px), theta = Math.acos(Math.max(-1, Math.min(1, py / r)));
      const rho = 0.8 * r;
      const radial = Math.sqrt(rho) * Math.exp(-rho);
      const angular = Math.sin(theta) ** 3 * Math.cos(phi + 0.32 * Math.sin(phase));
      const wave = 0.85 + 0.15 * Math.sin(3 * phi + 2.5 * theta - 2 * phase);
      const probability = clamp(2.1 * ((radial * angular) ** 2 * wave) ** 0.45);
      const fresnel = (1 - nz) ** 1.5;
      const angle = 2 * phi + 1.5 * theta + 2.25 * probability + 0.45 * fresnel + 0.24 * Math.sin(phase);
      const wavelength = (angle / tau + 3.23) % 1;
      const index = spectrum.findIndex(([stop]) => stop > wavelength);
      const [a, ca] = spectrum[index - 1], [b, cb] = spectrum[index];
      const tint = smooth((wavelength - a) / (b - a));

      // A fixed upper-left softbox and narrow rim keep the metal dimensional
      // as the interference colours sweep around the spherical surface.
      const diffuse = 0.64 + 0.27 * nz + 0.16 * (-0.6 * nx + 0.8 * ny);
      const key = Math.max(0, -0.37 * nx + 0.60 * ny + 0.71 * nz) ** 64;
      const rim = fresnel * (0.45 + 0.55 * Math.max(0, -nx * 0.75 + ny * 0.67));
      const offset = ((tileY + y) * atlasWidth + tileX + x) * 4;
      for (let channel = 0; channel < 3; channel++) {
        const metal = mix(ca[channel], cb[channel], tint) * diffuse;
        pixels[offset + channel] = Math.round(Math.min(255, metal + 106 * key + 102 * rim));
      }
      pixels[offset + 3] = 255;
    }
  }
}

for (let frame = 0; frame < frameCount; frame++) renderFrame(frame);
await sharp(pixels, { raw: { width: atlasWidth, height: atlasHeight, channels: 4 } })
  .resize(tile * columns, tile * rows)
  .webp({ quality: 88, alphaQuality: 100, smartSubsample: true, effort: 6 })
  .toFile(fileURLToPath(new URL("../public/orb/hydrogen.webp", import.meta.url)));
