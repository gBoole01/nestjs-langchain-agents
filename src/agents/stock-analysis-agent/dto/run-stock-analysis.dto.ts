import { IsNotEmpty, IsString } from 'class-validator';

export class RunStockAnalysisDto {
  @IsString()
  @IsNotEmpty()
  ticker: string;
}
