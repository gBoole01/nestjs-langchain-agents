import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OrderSide = 'buy' | 'sell';

export type OrderDocument = Order & Document;

@Schema({ timestamps: true })
export class Order {
  @Prop({ required: true, trim: true, index: true })
  ticker: string;

  @Prop({ required: true, enum: ['buy', 'sell'] })
  side: OrderSide;

  @Prop({ required: true, type: Number, min: 0 })
  shares: number;

  @Prop({ required: true, type: Number, min: 0 })
  price: number;

  @Prop({ required: true, type: Date, default: Date.now })
  executedAt: Date;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
