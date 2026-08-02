import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { CatalogInstrumentType } from '../models/catalog-instrument.model';

const CATALOG_INSTRUMENT_TYPES: CatalogInstrumentType[] = [
  'stock',
  'index',
  'commodity',
  'crypto',
];

export class CreateCatalogInstrumentDto {
  @IsString()
  @IsNotEmpty()
  ticker: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsIn(CATALOG_INSTRUMENT_TYPES)
  type: CatalogInstrumentType;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  sector?: string;
}
