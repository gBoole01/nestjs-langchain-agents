import { IsNotEmpty, IsString } from 'class-validator';

export class RunSectorAnalysisDto {
  @IsString()
  @IsNotEmpty()
  sector: string;
}
