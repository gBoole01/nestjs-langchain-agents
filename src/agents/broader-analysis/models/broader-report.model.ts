import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BroaderReportDomain = 'global' | 'geographical' | 'sectorial';

export type BroaderReportDocument = BroaderReport & Document;

@Schema({ _id: false })
export class BroaderReportSection {
  @Prop({ required: true })
  heading: string;

  @Prop({ required: true })
  content: string;
}

export const BroaderReportSectionSchema =
  SchemaFactory.createForClass(BroaderReportSection);

@Schema({ timestamps: true })
export class BroaderReport {
  @Prop({ required: true, enum: ['global', 'geographical', 'sectorial'] })
  domain: BroaderReportDomain;

  @Prop({ required: true })
  subject: string;

  @Prop({ type: [BroaderReportSectionSchema], required: true })
  sections: BroaderReportSection[];

  @Prop({ required: true })
  date: Date;

  @Prop({ required: true })
  period: string;
}

export const BroaderReportSchema = SchemaFactory.createForClass(BroaderReport);
BroaderReportSchema.index({ domain: 1, subject: 1, period: 1 });
