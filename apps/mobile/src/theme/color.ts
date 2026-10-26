/** Small hex color helpers used to derive UI shades from the user's theme colors. */

export function isValidHex(value: string): boolean {
  return /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

/** '#abc' | 'abc' | '#aabbcc' → '#aabbcc' (falls back to `fallback` if invalid). */
export function normalizeHex(value: string | undefined | null, fallback = '#000000'): string {
  if (!value || !isValidHex(value)) return fallback;
  let hex = value.trim().replace('#', '').toLowerCase();
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  return `#${hex}`;
}

function toRgb(hex: string): [number, number, number] {
  const h = normalizeHex(hex).slice(1);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
}

/** Linear blend: amount 0 → a, 1 → b. */
export function mix(a: string, b: string, amount: number): string {
  const ca = toRgb(a);
  const cb = toRgb(b);
  return toHex([0, 1, 2].map(i => ca[i] + (cb[i] - ca[i]) * amount) as [number, number, number]);
}

export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = toRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** WCAG relative luminance. */
export function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Text color (near-white or near-black) that reads best on `background`. */
export function readableOn(background: string, light = '#FFFFFF', dark = '#101828'): string {
  return contrastRatio(background, light) >= contrastRatio(background, dark) ? light : dark;
}

/**
 * Nudges `color` toward white (on dark surfaces) or black (on light surfaces)
 * until it reaches `minRatio` contrast against `surface`. Used so any preset's
 * brand color is still legible as text/icons.
 */
export function ensureContrast(color: string, surface: string, minRatio = 4.5): string {
  const target = luminance(surface) < 0.5 ? '#FFFFFF' : '#000000';
  let result = normalizeHex(color);
  for (let step = 1; step <= 10 && contrastRatio(result, surface) < minRatio; step++) {
    result = mix(color, target, step * 0.08);
  }
  return result;
}
