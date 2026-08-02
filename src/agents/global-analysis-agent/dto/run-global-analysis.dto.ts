import { IsNotEmpty, IsString } from 'class-validator';

export class RunGlobalAnalysisDto {
  @IsString()
  @IsNotEmpty()
  query: string;
}
