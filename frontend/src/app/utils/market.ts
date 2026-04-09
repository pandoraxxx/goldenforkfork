export const MA_PAIRS = [
  { short: 5, long: 20, key: '5-20', label: 'MA5/20' },
  { short: 20, long: 50, key: '20-50', label: 'MA20/50' },
  { short: 20, long: 60, key: '20-60', label: 'MA20/60' },
] as const;

export const MA_PERIOD_MIN = 2;
export const MA_PERIOD_MAX = 250;

export type GoldenCrossPairKey = string;

export interface MAPair {
  short: number;
  long: number;
  key: string;
  label: string;
}

export function parsePairKey(pairKey: string): MAPair | null {
  const m = /^(\d+)-(\d+)$/.exec(pairKey);
  if (!m) return null;
  const short = Number(m[1]);
  const long = Number(m[2]);
  if (short >= long) return null;
  if (short < MA_PERIOD_MIN || long > MA_PERIOD_MAX) return null;
  return { short, long, key: `${short}-${long}`, label: `MA${short}/${long}` };
}

export function isPresetPair(key: string): boolean {
  return MA_PAIRS.some((p) => p.key === key);
}

export function getPairLabel(key: string): string {
  const preset = MA_PAIRS.find((p) => p.key === key);
  if (preset) return preset.label;
  const parsed = parsePairKey(key);
  return parsed ? parsed.label : key;
}

export interface GoldenCrossEvent {
  date: string;
  time: string;
  shortMA: number;
  longMA: number;
  close: number;
  type: 'golden';
  shortPeriod: number;
  longPeriod: number;
  pairKey: string;
}

export function formatGoldenCrossDate(event: GoldenCrossEvent): string {
  const [, m, d] = event.date.split('-');
  return `${parseInt(m, 10)}月${parseInt(d, 10)}日 ${event.time}`;
}

export function isGoldenCrossBuySignal(event: GoldenCrossEvent | null | undefined, recentDays = 5): boolean {
  if (!event?.date) return false;
  const ts = new Date(event.date).getTime();
  if (!Number.isFinite(ts)) return false;
  const days = (Date.now() - ts) / (24 * 60 * 60 * 1000);
  return days >= 0 && days <= recentDays;
}
