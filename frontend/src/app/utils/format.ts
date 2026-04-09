const TRILLION = 1_000_000_000_000;
const BILLION = 1_000_000_000;
const MILLION = 1_000_000;

export function formatMarketCap(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '-';
  if (value >= TRILLION) return `${(value / TRILLION).toFixed(2)}T`;
  if (value >= BILLION) return `${(value / BILLION).toFixed(2)}B`;
  return `${(value / MILLION).toFixed(2)}M`;
}
