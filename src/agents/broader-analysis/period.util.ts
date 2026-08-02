export type Cadence = 'semester' | 'quarter' | 'month' | 'week';

interface ParsedPeriod {
  year: number;
  index: number; // 1|2 for semester, 1-4 for quarter, 1-12 for month, 1-53 for week
  cadence: Cadence;
}

const PERIOD_PATTERN =
  /^(\d{4})-(?:S([12])|Q([1-4])|M(0[1-9]|1[0-2])|W(0[1-9]|[1-4]\d|5[0-3]))$/;

const PERIODS_PER_YEAR: Record<Cadence, number> = {
  semester: 2,
  quarter: 4,
  month: 12,
  week: 52, // approximation; week arithmetic below uses real ISO-week dates
};

const MONTHS_PER_UNIT: Record<'semester' | 'quarter' | 'month', number> = {
  semester: 6,
  quarter: 3,
  month: 1,
};

/**
 * ISO-8601 week-year and week number (Monday-start, week 1 contains Jan 4).
 * Weeks don't divide evenly into calendar years (52 or 53 per ISO year), so
 * week arithmetic is done via real dates rather than the (year, index)
 * formula used for the other cadences.
 */
function isoWeekInfo(date: Date): { year: number; week: number } {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const dayNum = (d.getUTCDay() + 6) % 7; // Mon=0 .. Sun=6
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // Thursday of this ISO week
  const isoYear = d.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstThursdayDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(
    firstThursday.getUTCDate() - firstThursdayDayNum + 3,
  );
  const week =
    1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return { year: isoYear, week };
}

/** Monday (UTC midnight) of the given ISO week-year/week number. */
function mondayOfIsoWeek(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4DayNum = (jan4.getUTCDay() + 6) % 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4DayNum);
  const result = new Date(week1Monday);
  result.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  return result;
}

export function parsePeriod(period: string): ParsedPeriod {
  const match = PERIOD_PATTERN.exec(period);
  if (!match) {
    throw new Error(`Invalid period format: "${period}"`);
  }
  const year = Number(match[1]);
  if (match[2]) {
    return { year, index: Number(match[2]), cadence: 'semester' };
  }
  if (match[3]) {
    return { year, index: Number(match[3]), cadence: 'quarter' };
  }
  if (match[4]) {
    return { year, index: Number(match[4]), cadence: 'month' };
  }
  return { year, index: Number(match[5]), cadence: 'week' };
}

export function formatPeriod(period: ParsedPeriod): string {
  switch (period.cadence) {
    case 'semester':
      return `${period.year}-S${period.index}`;
    case 'quarter':
      return `${period.year}-Q${period.index}`;
    case 'month':
      return `${period.year}-M${String(period.index).padStart(2, '0')}`;
    case 'week':
      return `${period.year}-W${String(period.index).padStart(2, '0')}`;
  }
}

export function assertCadence(period: string, cadence: Cadence): void {
  if (parsePeriod(period).cadence !== cadence) {
    throw new Error(`Period "${period}" is not a valid ${cadence} label`);
  }
}

/** Number of periods of this cadence in a calendar year (week is an approximation). */
export function periodsPerYear(cadence: Cadence): number {
  return PERIODS_PER_YEAR[cadence];
}

/**
 * Shifts a period by `delta` units (positive moves forward, negative moves
 * back), carrying over into adjacent years as needed.
 */
export function addPeriods(period: string, delta: number): string {
  const parsed = parsePeriod(period);
  if (parsed.cadence === 'week') {
    const monday = mondayOfIsoWeek(parsed.year, parsed.index);
    const shifted = new Date(monday);
    shifted.setUTCDate(shifted.getUTCDate() + delta * 7);
    const { year, week } = isoWeekInfo(shifted);
    return formatPeriod({ year, index: week, cadence: 'week' });
  }
  const perYear = PERIODS_PER_YEAR[parsed.cadence];
  const absoluteIndex = parsed.year * perYear + (parsed.index - 1) + delta;
  const year = Math.floor(absoluteIndex / perYear);
  const index = (((absoluteIndex % perYear) + perYear) % perYear) + 1;
  return formatPeriod({ year, index, cadence: parsed.cadence });
}

export function getCurrentPeriod(cadence: Cadence, now = new Date()): string {
  if (cadence === 'week') {
    const { year, week } = isoWeekInfo(now);
    return formatPeriod({ year, index: week, cadence: 'week' });
  }
  const month = now.getUTCMonth(); // 0-11
  const index =
    cadence === 'semester'
      ? month < 6
        ? 1
        : 2
      : cadence === 'quarter'
        ? Math.floor(month / 3) + 1
        : month + 1;
  return formatPeriod({ year: now.getUTCFullYear(), index, cadence });
}

/**
 * Calendar bounds (UTC) covered by a period, end-inclusive.
 */
export function getPeriodBounds(period: string): { start: Date; end: Date } {
  const parsed = parsePeriod(period);
  if (parsed.cadence === 'week') {
    const start = mondayOfIsoWeek(parsed.year, parsed.index);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    end.setUTCHours(23, 59, 59, 999);
    return { start, end };
  }
  const monthsPerUnit = MONTHS_PER_UNIT[parsed.cadence];
  const startMonth = (parsed.index - 1) * monthsPerUnit;
  const start = new Date(Date.UTC(parsed.year, startMonth, 1));
  const end = new Date(
    Date.UTC(parsed.year, startMonth + monthsPerUnit, 0, 23, 59, 59, 999),
  );
  return { start, end };
}

/**
 * Human-readable label for use in research queries and report prompts,
 * e.g. "2023-S1 (January - June 2023)".
 */
export function getPeriodLabel(period: string): string {
  const parsed = parsePeriod(period);
  const { start, end } = getPeriodBounds(period);
  if (parsed.cadence === 'week') {
    const format = (date: Date) =>
      date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      });
    return `${period} (${format(start)} - ${format(end)})`;
  }
  const format = (date: Date) =>
    date.toLocaleString('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
  return `${period} (${format(start)} - ${format(end)})`;
}

/**
 * Enumerates every period from `from` to `to`, inclusive, in chronological
 * order. `from` and `to` must share the same cadence.
 */
export function enumeratePeriods(from: string, to: string): string[] {
  const fromParsed = parsePeriod(from);
  const toParsed = parsePeriod(to);
  if (fromParsed.cadence !== toParsed.cadence) {
    throw new Error(
      `Cannot enumerate periods across different cadences: "${from}" and "${to}"`,
    );
  }

  if (fromParsed.cadence === 'week') {
    const periods: string[] = [];
    const toStart = getPeriodBounds(to).start.getTime();
    let current = from;
    while (getPeriodBounds(current).start.getTime() <= toStart) {
      periods.push(current);
      current = addPeriods(current, 1);
    }
    return periods;
  }

  const perYear = PERIODS_PER_YEAR[fromParsed.cadence];
  const start = fromParsed.year * perYear + (fromParsed.index - 1);
  const end = toParsed.year * perYear + (toParsed.index - 1);

  const periods: string[] = [];
  for (let i = start; i <= end; i++) {
    periods.push(
      formatPeriod({
        year: Math.floor(i / perYear),
        index: (i % perYear) + 1,
        cadence: fromParsed.cadence,
      }),
    );
  }
  return periods;
}
