import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CatalogInstrumentType = 'stock' | 'index' | 'commodity' | 'crypto';

export type CatalogInstrumentDocument = CatalogInstrument & Document;

@Schema({ timestamps: true })
export class CatalogInstrument {
  @Prop({ required: true, unique: true, trim: true })
  ticker: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, type: String })
  type: CatalogInstrumentType;

  @Prop()
  region?: string;

  @Prop()
  sector?: string;
}

export const CatalogInstrumentSchema =
  SchemaFactory.createForClass(CatalogInstrument);
CatalogInstrumentSchema.index({ ticker: 1 }, { unique: true });
