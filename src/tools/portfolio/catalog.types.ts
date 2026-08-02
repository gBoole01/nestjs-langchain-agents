export type CatalogInstrumentType = 'stock' | 'index' | 'commodity' | 'crypto';

export interface CatalogInstrument {
  ticker: string;
  name: string;
  type: CatalogInstrumentType;
  region?: string;
  sector?: string;
}
