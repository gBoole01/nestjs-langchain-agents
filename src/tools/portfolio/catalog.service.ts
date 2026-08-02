import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { CatalogInstrument } from './catalog.types';

@Injectable()
export class CatalogService {
  private readonly catalog: CatalogInstrument[];

  constructor() {
    const dataDir = join(__dirname, '..', '..', '..', 'data');
    this.catalog = JSON.parse(
      readFileSync(join(dataDir, 'catalog.json'), 'utf-8'),
    );
  }

  findAll(): CatalogInstrument[] {
    return this.catalog;
  }
}
