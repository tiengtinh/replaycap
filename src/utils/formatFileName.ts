/**
 * Builds a deterministic filename for a captured bar screenshot.
 *
 * Full pattern:  VN301!__dual__2026-03-13__bar_0001__2026-03-13_09-31-00.png
 * Fallback:      VN301!__dual__2026-03-13__bar_0001.png
 */
export function formatFileName(opts: {
  symbol: string;
  layoutMode: string;
  targetDate: string;
  barIndex: number;
  barDate?: string | null;
  barTime?: string | null;
}): string {
  const { symbol, layoutMode, targetDate, barIndex, barDate, barTime } = opts;

  const paddedIndex = String(barIndex).padStart(4, "0");
  const base = `${symbol}__${layoutMode}__${targetDate}__bar_${paddedIndex}`;

  if (barDate && barTime) {
    const safeTime = barTime.replace(/:/g, "-");
    return `${base}__${barDate}_${safeTime}.png`;
  }

  return `${base}.png`;
}
