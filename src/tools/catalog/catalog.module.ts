import { Logger, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import {
  CatalogInstrument,
  CatalogInstrumentSchema,
} from './models/catalog-instrument.model';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CatalogInstrument.name, schema: CatalogInstrumentSchema },
    ]),
  ],
  controllers: [CatalogController],
  providers: [CatalogService, Logger],
  exports: [CatalogService],
})
export class CatalogModule {}
