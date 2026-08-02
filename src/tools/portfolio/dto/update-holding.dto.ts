import { IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateHoldingDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  shares?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  currentPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  valueInEUR?: number;
}
