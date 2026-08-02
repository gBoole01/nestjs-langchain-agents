import { IsNotEmpty, IsString } from 'class-validator';

export class RunGeoAnalysisDto {
  @IsString()
  @IsNotEmpty()
  region: string;
}
