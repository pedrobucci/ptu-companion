// WCAG relative-luminance / contrast-ratio helpers. Used to pick a
// legible text color for a semantic badge background at render time,
// and by tests to audit that every token pairing clears a real contrast
// minimum instead of asserting colors "look right".

function srgbToLinear(c: number): number {
  const cs = c / 255;
  return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
}

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return [r, g, b];
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

export function contrastRatio(hexA: string, hexB: string): number {
  const la = relativeLuminance(hexA);
  const lb = relativeLuminance(hexB);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Picks whichever of black/white gives the background the higher
 * contrast ratio (never a fixed color — bright badges like Electric or
 * Ice need dark text, dark ones like Dragon or Ghost need white). */
export function pickTextColor(backgroundHex: string): "#000000" | "#ffffff" {
  const withBlack = contrastRatio(backgroundHex, "#000000");
  const withWhite = contrastRatio(backgroundHex, "#ffffff");
  return withWhite >= withBlack ? "#ffffff" : "#000000";
}
