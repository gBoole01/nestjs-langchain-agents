import { IsArray, IsOptional, IsString, Matches } from 'class-validator';

const QUARTER_PATTERN = /^\d{4}-Q[1-4]$/;

export class BackfillGeoDto {
  @IsOptional()
  @Matches(QUARTER_PATTERN, {
    message: 'from must be a quarter label, e.g. "2024-Q3"',
  })
  from?: string;

  @IsOptional()
  @Matches(QUARTER_PATTERN, {
    message: 'to must be a quarter label, e.g. "2026-Q2"',
  })
  to?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  regions?: string[];
}
