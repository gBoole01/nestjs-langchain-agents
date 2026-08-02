import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WatchedTickerDocument = WatchedTicker & Document;

@Schema({ timestamps: true })
export class WatchedTicker {
  @Prop({ required: true, unique: true, trim: true })
  ticker: string;

  @Prop()
  region?: string;

  @Prop()
  sector?: string;
}

export const WatchedTickerSchema = SchemaFactory.createForClass(WatchedTicker);
WatchedTickerSchema.index({ ticker: 1 }, { unique: true });
