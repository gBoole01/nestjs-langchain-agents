export type Cadence = 'semester' | 'quarter';

interface ParsedPeriod {
  year: number;
  index: number; // 1|2 for semester, 1-4 for quarter
  cadence: Cadence;
}

const PERIOD_PATTERN = /^(\d{4})-(?:S([12])|Q([1-4]))$/;

const PERIODS_PER_YEAR: Record<Cadence, number> = {
  semester: 2,
  quarter: 4,
};

const MONTHS_PER_UNIT: Record<Cadence, number> = {
  semester: 6,
  quarter: 3,
};

export function parsePeriod(period: string): ParsedPeriod {
  const match = PERIOD_PATTERN.exec(period);
  if (!match) {
    throw new Error(`Invalid period format: "${period}"`);
  }
  const year = Number(match[1]);
  if (match[2]) {
    return { year, index: Number(match[2]), cadence: 'semester' };
  }
  return { year, index: Number(match[3]), cadence: 'quarter' };
}

export function formatPeriod(period: ParsedPeriod): string {
  return period.cadence === 'semester'
    ? `${period.year}-S${period.index}`
    : `${period.year}-Q${period.index}`;
}

export function assertCadence(period: string, cadence: Cadence): void {
  if (parsePeriod(period).cadence !== cadence) {
    throw new Error(`Period "${period}" is not a valid ${cadence} label`);
  }
}

/**
 * Shifts a period by `delta` units (positive moves forward, negative moves
 * back), carrying over into adjacent years as needed.
 */
export function addPeriods(period: string, delta: number): string {
  const parsed = parsePeriod(period);
  const perYear = PERIODS_PER_YEAR[parsed.cadence];
  const absoluteIndex = parsed.year * perYear + (parsed.index - 1) + delta;
  const year = Math.floor(absoluteIndex / perYear);
  const index = (((absoluteIndex % perYear) + perYear) % perYear) + 1;
  return formatPeriod({ year, index, cadence: parsed.cadence });
}

export function getCurrentPeriod(cadence: Cadence, now = new Date()): string {
  const month = now.getUTCMonth(); // 0-11
  const index =
    cadence === 'semester' ? (month < 6 ? 1 : 2) : Math.floor(month / 3) + 1;
  return formatPeriod({ year: now.getUTCFullYear(), index, cadence });
}

/**
 * Calendar bounds (UTC) covered by a period, end-inclusive.
 */
export function getPeriodBounds(period: string): { start: Date; end: Date } {
  const parsed = parsePeriod(period);
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
  const { start, end } = getPeriodBounds(period);
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
