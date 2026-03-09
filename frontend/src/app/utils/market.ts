export const MA_PAIRS = [
  { short: 5, long: 20, key: '5-20', label: 'MA5/20' },
  { short: 20, long: 50, key: '20-50', label: 'MA20/50' },
  { short: 20, long: 60, key: '20-60', label: 'MA20/60' },
] as const;

export type GoldenCrossPairKey = typeof MA_PAIRS[number]['key'];

export interface GoldenCrossEvent {
  date: string;
  time: string;
  shortMA: number;
  longMA: number;
  close: number;
  type: 'golden';
  shortPeriod: number;
  longPeriod: number;
  pairKey: GoldenCrossPairKey;
}

export function formatGoldenCrossDate(event: GoldenCrossEvent): string {
  const [, m, d] = event.date.split('-');
  return `${parseInt(m, 10)}月${parseInt(d, 10)}日 ${event.time}`;
}
