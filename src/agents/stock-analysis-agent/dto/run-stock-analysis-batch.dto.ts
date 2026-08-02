import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class RunStockAnalysisBatchDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  tickers: string[];
}
