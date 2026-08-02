import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MarketDataPointDocument = MarketDataPoint & Document;

@Schema({ timestamps: true })
export class MarketDataPoint {
  @Prop({ required: true, trim: true })
  ticker: string;

  @Prop({ required: true })
  date: Date;

  @Prop({ type: Number })
  open?: number;

  @Prop({ type: Number })
  high?: number;

  @Prop({ type: Number })
  low?: number;

  @Prop({ type: Number })
  close?: number;

  @Prop({ type: Number })
  adjOpen?: number;

  @Prop({ type: Number })
  adjHigh?: number;

  @Prop({ type: Number })
  adjLow?: number;

  @Prop({ type: Number })
  adjClose?: number;

  @Prop({ type: Number })
  volume?: number;
}

export const MarketDataPointSchema =
  SchemaFactory.createForClass(MarketDataPoint);
MarketDataPointSchema.index({ ticker: 1, date: 1 }, { unique: true });
