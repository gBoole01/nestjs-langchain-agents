import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BroaderReportDomain = 'global' | 'geographical' | 'sectorial';

export type BroaderReportDocument = BroaderReport & Document;

@Schema({ timestamps: true })
export class BroaderReport {
  @Prop({ required: true, enum: ['global', 'geographical', 'sectorial'] })
  domain: BroaderReportDomain;

  @Prop({ required: true })
  subject: string;

  @Prop({ required: true })
  reportContent: string;

  @Prop({ required: true })
  date: Date;
}

export const BroaderReportSchema = SchemaFactory.createForClass(BroaderReport);
