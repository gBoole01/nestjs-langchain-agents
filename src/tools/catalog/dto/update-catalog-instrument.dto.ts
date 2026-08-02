import { IsIn, IsOptional, IsString } from 'class-validator';
import { CatalogInstrumentType } from '../models/catalog-instrument.model';

const CATALOG_INSTRUMENT_TYPES: CatalogInstrumentType[] = [
  'stock',
  'index',
  'commodity',
  'crypto',
];

export class UpdateCatalogInstrumentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(CATALOG_INSTRUMENT_TYPES)
  type?: CatalogInstrumentType;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  sector?: string;
}
