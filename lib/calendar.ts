// Pure date helpers for the themed date picker (components/DateField.tsx).
//
// Dates are handled as `yyyy-mm-dd` strings and as plain y/m/d numbers — never
// via a Date parsed from a string — so nothing shifts a day either side of
// midnight depending on the viewer's timezone.

export interface Ymd {
  year: number;
  month: number; // 1-12
  day: number;
}

export function parseYmd(value: string): Ymd | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  return { year: Number(y), month: Number(m), day: Number(d) };
}

export function formatYmd({ year, month, day }: Ymd): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function todayYmd(now: Date = new Date()): Ymd {
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

export function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month is the last day of this one.
  return new Date(year, month, 0).getDate();
}

/** Monday-first weekday index (0 = Monday … 6 = Sunday), matching the Turkish
 * calendar convention. JS getDay() is Sunday-first, hence the shift. */
export function mondayFirstWeekday(year: number, month: number, day: number): number {
  return (new Date(year, month - 1, day).getDay() + 6) % 7;
}

export function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + (month - 1) + delta;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

export interface GridCell {
  /** null for the blank leading/trailing padding cells. */
  day: number | null;
  key: string;
}

/** The month laid out as whole weeks, padded so every row has seven cells. */
export function buildMonthGrid(year: number, month: number): GridCell[][] {
  const total = daysInMonth(year, month);
  const leading = mondayFirstWeekday(year, month, 1);

  const cells: GridCell[] = [];
  for (let i = 0; i < leading; i++) cells.push({ day: null, key: `pad-start-${i}` });
  for (let d = 1; d <= total; d++) cells.push({ day: d, key: `d-${d}` });
  while (cells.length % 7 !== 0) cells.push({ day: null, key: `pad-end-${cells.length}` });

  const weeks: GridCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** String comparison is valid for `yyyy-mm-dd`, so bounds need no parsing. */
export function isDisabled(value: string, min?: string, max?: string): boolean {
  if (min && value < min) return true;
  if (max && value > max) return true;
  return false;
}
