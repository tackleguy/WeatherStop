// 10-minute snap used by Windy and 5-minute snap used by NEXRAD.
export function roundTo(epochSec: number, stepSec: number): number {
  return Math.floor(epochSec / stepSec) * stepSec;
}

export function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

export function formatRelativeFuture(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms < 0) return 'now';
  const min = Math.round(ms / 60000);
  if (min < 60) return `in ${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `in ${hr}h`;
  return `in ${Math.round(hr / 24)}d`;
}

export function formatTime(epochSec: number): string {
  return new Date(epochSec * 1000).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}
