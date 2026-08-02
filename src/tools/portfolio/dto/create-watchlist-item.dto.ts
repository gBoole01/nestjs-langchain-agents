import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateWatchlistItemDto {
  @IsString()
  @IsNotEmpty()
  ticker: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  sector?: string;
}
