// Hex parsing and the one color-space conversion the CPU owns.

export const HEX_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export const isHex = (value) =>
  typeof value === "string" && HEX_PATTERN.test(value);

// "abc" and "#abc" both become "#abc"; anything else is rejected outright, so
// callers never have to guess whether a value carries its hash.
export function normalizeHex(value) {
  if (!isHex(value)) return null;
  return value.startsWith("#") ? value : `#${value}`;
}

// "#abc" -> "#aabbcc". A six-digit value is already expanded and passes through.
export function expandHex(hex) {
  if (hex.length !== 4) return hex;
  return `#${hex
    .slice(1)
    .split("")
    .map((c) => c + c)
    .join("")}`;
}

function srgbToLinear(c) {
  return c < 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

// Palette entries are authored as sRGB, but every mix happens in OKLab: alone
// among the usual spaces it holds perceived lightness steady across a blend, so
// no pair of colors greys out through its midpoint.
//
// The conversion lives here rather than in the shader because the palette is a
// handful of uniform constants: doing it per fragment would recompute the same
// eight values millions of times a frame. Only the inverse stays on the GPU,
// where it genuinely varies per pixel.
export function hexToOklab(hex, target) {
  const value = expandHex(normalizeHex(hex) ?? "#000000").slice(1);
  const int = parseInt(value, 16);

  const r = srgbToLinear(((int >> 16) & 255) / 255);
  const g = srgbToLinear(((int >> 8) & 255) / 255);
  const b = srgbToLinear((int & 255) / 255);

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  return target.set(
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  );
}
