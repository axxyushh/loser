/** Top-down airliner silhouette, nose pointing right (+x). Decorative. */
export const AIRLINER_PATH =
  'M60 32C56 30.5 46 30 38 30L22 12h-5l10 18H12l-6-8H3l4 10-4 10h3l6-8h15L17 52h5l16-18c8 0 18-.5 22-2z'

export function Airliner({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path d={AIRLINER_PATH} fill="currentColor" />
    </svg>
  )
}
