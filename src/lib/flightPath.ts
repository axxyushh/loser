/**
 * The airplane's route, authored in viewport fractions (x of width, y of height)
 * so it can be re-composed for any screen. Two compositions exist:
 * a wide one for tablet/desktop and a narrower, calmer one for phones.
 *
 * The first two segments cross the wordmark left-to-right; the headline morph is
 * keyed to where the plane is on this path, not to raw scroll distance.
 */
type Seg = readonly ['M' | 'C' | 'S', ...number[]]

const DESKTOP: Seg[] = [
  ['M', 0.02, 0.82],
  ['C', 0.22, 0.8, 0.34, 0.46, 0.52, 0.43], // lift off, cross the wordmark
  ['S', 0.86, 0.4, 0.95, 0.18],
  ['S', 0.9, 0.11, 0.68, 0.14], // turn over the top (kept clear of the nav bar)
  ['S', 0.32, 0.2, 0.14, 0.32],
  ['S', 0.03, 0.5, 0.18, 0.64],
  ['S', 0.5, 0.84, 0.76, 0.74],
  ['S', 0.96, 0.62, 0.9, 0.44],
  ['S', 0.84, 0.3, 0.6, 0.34],
  ['S', 0.3, 0.4, 0.2, 0.58],
  ['S', 0.12, 0.78, 0.4, 0.86],
  ['S', 0.7, 0.9, 0.9, 0.9], // final approach, levels out on the runway line
]

const MOBILE: Seg[] = [
  ['M', 0.05, 0.8],
  ['C', 0.2, 0.78, 0.32, 0.46, 0.5, 0.42],
  ['S', 0.82, 0.4, 0.94, 0.2],
  ['S', 0.9, 0.13, 0.6, 0.15],
  ['S', 0.2, 0.18, 0.1, 0.38],
  ['S', 0.1, 0.6, 0.4, 0.66],
  ['S', 0.85, 0.74, 0.9, 0.56],
  ['S', 0.8, 0.4, 0.5, 0.45],
  ['S', 0.15, 0.55, 0.15, 0.75],
  ['S', 0.4, 0.9, 0.9, 0.9],
]

export function buildPath(w: number, h: number, mobile: boolean): string {
  return (mobile ? MOBILE : DESKTOP)
    .map(([cmd, ...n]) => cmd + n.map((v, i) => (v * (i % 2 ? h : w)).toFixed(1)).join(' '))
    .join(' ')
}

export const smoothstep = (t: number): number => {
  const x = Math.min(1, Math.max(0, t))
  return x * x * (3 - 2 * x)
}
