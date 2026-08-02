import {
  addPeriods,
  assertCadence,
  enumeratePeriods,
  getCurrentPeriod,
  getPeriodBounds,
  getPeriodLabel,
  parsePeriod,
} from './period.util';

describe('period.util', () => {
  describe('parsePeriod', () => {
    it('parses a semester label', () => {
      expect(parsePeriod('2023-S1')).toEqual({
        year: 2023,
        index: 1,
        cadence: 'semester',
      });
    });

    it('parses a quarter label', () => {
      expect(parsePeriod('2024-Q3')).toEqual({
        year: 2024,
        index: 3,
        cadence: 'quarter',
      });
    });

    it('throws on malformed input', () => {
      expect(() => parsePeriod('2024-H1')).toThrow();
      expect(() => parsePeriod('2024-Q5')).toThrow();
      expect(() => parsePeriod('not-a-period')).toThrow();
    });
  });

  describe('addPeriods', () => {
    it('shifts within the same year', () => {
      expect(addPeriods('2023-S1', 1)).toBe('2023-S2');
      expect(addPeriods('2024-Q1', 2)).toBe('2024-Q3');
    });

    it('rolls forward across a year boundary', () => {
      expect(addPeriods('2023-S2', 1)).toBe('2024-S1');
      expect(addPeriods('2024-Q4', 1)).toBe('2025-Q1');
    });

    it('rolls backward across a year boundary', () => {
      expect(addPeriods('2024-S1', -1)).toBe('2023-S2');
      expect(addPeriods('2025-Q1', -1)).toBe('2024-Q4');
    });

    it('rolls backward across multiple years', () => {
      expect(addPeriods('2026-S1', -7)).toBe('2022-S2');
      expect(addPeriods('2026-Q2', -7)).toBe('2024-Q3');
    });
  });

  describe('getCurrentPeriod', () => {
    it('resolves the correct semester', () => {
      expect(
        getCurrentPeriod('semester', new Date('2026-08-02T00:00:00Z')),
      ).toBe('2026-S2');
      expect(
        getCurrentPeriod('semester', new Date('2026-01-15T00:00:00Z')),
      ).toBe('2026-S1');
    });

    it('resolves the correct quarter', () => {
      expect(
        getCurrentPeriod('quarter', new Date('2026-08-02T00:00:00Z')),
      ).toBe('2026-Q3');
      expect(
        getCurrentPeriod('quarter', new Date('2026-12-31T00:00:00Z')),
      ).toBe('2026-Q4');
    });
  });

  describe('getPeriodBounds', () => {
    it('computes correct start/end for a semester', () => {
      const { start, end } = getPeriodBounds('2023-S1');
      expect(start.toISOString()).toBe('2023-01-01T00:00:00.000Z');
      expect(end.toISOString()).toBe('2023-06-30T23:59:59.999Z');
    });

    it('computes correct start/end for a quarter', () => {
      const { start, end } = getPeriodBounds('2024-Q3');
      expect(start.toISOString()).toBe('2024-07-01T00:00:00.000Z');
      expect(end.toISOString()).toBe('2024-09-30T23:59:59.999Z');
    });
  });

  describe('getPeriodLabel', () => {
    it('includes the period and a human-readable range', () => {
      expect(getPeriodLabel('2023-S1')).toBe(
        '2023-S1 (January 2023 - June 2023)',
      );
    });
  });

  describe('enumeratePeriods', () => {
    it('enumerates the exact backfill range from the spec', () => {
      expect(enumeratePeriods('2022-S2', '2026-S1')).toEqual([
        '2022-S2',
        '2023-S1',
        '2023-S2',
        '2024-S1',
        '2024-S2',
        '2025-S1',
        '2025-S2',
        '2026-S1',
      ]);
    });

    it('enumerates a quarterly range', () => {
      expect(enumeratePeriods('2024-Q3', '2026-Q2')).toEqual([
        '2024-Q3',
        '2024-Q4',
        '2025-Q1',
        '2025-Q2',
        '2025-Q3',
        '2025-Q4',
        '2026-Q1',
        '2026-Q2',
      ]);
    });

    it('returns a single-element array when from equals to', () => {
      expect(enumeratePeriods('2025-Q1', '2025-Q1')).toEqual(['2025-Q1']);
    });

    it('throws when cadences differ', () => {
      expect(() => enumeratePeriods('2024-S1', '2024-Q3')).toThrow();
    });
  });

  describe('assertCadence', () => {
    it('passes for a matching cadence', () => {
      expect(() => assertCadence('2024-S1', 'semester')).not.toThrow();
    });

    it('throws for a mismatched cadence', () => {
      expect(() => assertCadence('2024-Q1', 'semester')).toThrow();
    });
  });
});
