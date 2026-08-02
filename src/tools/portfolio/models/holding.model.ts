import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type HoldingDocument = Holding & Document;

@Schema({ timestamps: true })
export class Holding {
  @Prop({ required: true, unique: true, trim: true })
  ticker: string;

  @Prop({ required: true, type: Number, min: 0 })
  shares: number;

  @Prop({ type: Number, min: 0 })
  currentPrice?: number;

  @Prop({ type: Number, min: 0 })
  valueInEUR?: number;

  @Prop()
  region?: string;

  @Prop()
  sector?: string;
}

export const HoldingSchema = SchemaFactory.createForClass(Holding);
HoldingSchema.index({ ticker: 1 }, { unique: true });
