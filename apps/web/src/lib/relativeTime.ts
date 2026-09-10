/**
 * 相对时间格式化（"看过"页用）。
 * 刚刚（<5s）→ N 分钟前 → N 小时前 → 昨天 HH:MM → 本年 MM-DD → 跨年 YYYY-MM-DD
 */
function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function formatRelative(timestamp: number, now: number = Date.now()): string {
  if (!Number.isFinite(timestamp)) return '—';
  const diff = now - timestamp;
  if (diff < 0) return '刚刚';
  if (diff < 5_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;

  const d = new Date(timestamp);
  const today = new Date(now);
  const yesterday = new Date(now - 86_400_000);
  const sameDay = (a: Date, b: Date): boolean =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (sameDay(d, yesterday)) return `昨天 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (d.getFullYear() === today.getFullYear()) {
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
