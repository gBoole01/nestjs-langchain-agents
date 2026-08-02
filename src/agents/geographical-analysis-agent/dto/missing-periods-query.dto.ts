import { IsNotEmpty, IsString } from 'class-validator';

export class MissingPeriodsQueryDto {
  @IsNotEmpty()
  @IsString()
  region: string;
}
