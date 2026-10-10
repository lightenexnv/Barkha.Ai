// Live tracking for an installed system: everything counts from the exact
// moment it was marked as implemented, never from the start of the day,
// month or year. Rain is not spread evenly: each calendar month contributes
// its own expected harvest, pro-rated by how much of that month has passed.
import { useEffect, useState } from "react";

const MS_PER_DAY = 86_400_000;

const monthStart = (year: number, month: number) => new Date(year, month, 1).getTime();

/** Expected harvest (m³) between two instants, from 12 monthly harvest totals. */
export const harvestBetween = (monthlyM3: number[], from: Date, to: Date): number => {
  let start = from.getTime();
  const end = to.getTime();
  if (!(end > start) || monthlyM3.length !== 12) return 0;
  let total = 0;
  while (start < end) {
    const d = new Date(start);
    const begin = monthStart(d.getFullYear(), d.getMonth());
    const next = monthStart(d.getFullYear(), d.getMonth() + 1);
    const segmentEnd = Math.min(end, next);
    total += (monthlyM3[d.getMonth()] ?? 0) * ((segmentEnd - start) / (next - begin));
    start = segmentEnd;
  }
  return total;
};

/** Start of the calendar month containing `date`. */
export const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

/** "just now", "12 minutes", "5 hours", "3 days" since the start. */
export const elapsedParts = (from: Date, to: Date) => {
  const ms = Math.max(0, to.getTime() - from.getTime());
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return { unit: "now" as const, value: 0 };
  if (minutes < 60) return { unit: "minutes" as const, value: minutes };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { unit: "hours" as const, value: hours };
  return { unit: "days" as const, value: Math.floor(ms / MS_PER_DAY) };
};

/** Current time, refreshed every `everyMs` so live figures keep moving. */
export const useNow = (everyMs = 10_000) => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), everyMs);
    return () => window.clearInterval(timer);
  }, [everyMs]);
  return now;
};
