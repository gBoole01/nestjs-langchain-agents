import { IsArray, IsOptional, IsString, Matches } from 'class-validator';

const PERIOD_PATTERN =
  /^\d{4}-(?:M(?:0[1-9]|1[0-2])|Q[1-4]|W(?:0[1-9]|[1-4]\d|5[0-3]))$/;
const PERIOD_MESSAGE =
  'must be a month, quarter, or week label matching the target sectors’ cadence, e.g. "2024-M07", "2024-Q3", or "2024-W27"';

export class BackfillSectorDto {
  @IsOptional()
  @Matches(PERIOD_PATTERN, {
    message: `from ${PERIOD_MESSAGE}`,
  })
  from?: string;

  @IsOptional()
  @Matches(PERIOD_PATTERN, {
    message: `to ${PERIOD_MESSAGE}`,
  })
  to?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sectors?: string[];

  @IsOptional()
  @IsArray()
  @Matches(PERIOD_PATTERN, {
    each: true,
    message: `each period ${PERIOD_MESSAGE}`,
  })
  periods?: string[];
}
