import { IsOptional, IsString } from 'class-validator';

export class ListReportsQueryDto {
  @IsOptional()
  @IsString()
  sector?: string;
}
