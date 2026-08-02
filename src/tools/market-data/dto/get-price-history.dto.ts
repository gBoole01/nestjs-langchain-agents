import { IsDateString, IsOptional } from 'class-validator';

export class GetPriceHistoryDto {
  @IsOptional()
  @IsDateString()
  start?: string;

  @IsOptional()
  @IsDateString()
  end?: string;
}
