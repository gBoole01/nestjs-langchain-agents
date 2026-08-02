import { IsOptional, Matches } from 'class-validator';

const SEMESTER_PATTERN = /^\d{4}-S[12]$/;

export class BackfillGlobalDto {
  @IsOptional()
  @Matches(SEMESTER_PATTERN, {
    message: 'from must be a semester label, e.g. "2022-S2"',
  })
  from?: string;

  @IsOptional()
  @Matches(SEMESTER_PATTERN, {
    message: 'to must be a semester label, e.g. "2026-S1"',
  })
  to?: string;
}
