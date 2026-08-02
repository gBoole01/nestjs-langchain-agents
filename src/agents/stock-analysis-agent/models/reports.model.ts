import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ReportDocument = Report & Document;

@Schema({ _id: false })
export class ReportSection {
  @Prop({ required: true })
  heading: string;

  @Prop({ required: true })
  content: string;

  @Prop({ type: [Number] })
  vector?: number[];
}

export const ReportSectionSchema = SchemaFactory.createForClass(ReportSection);

@Schema({ timestamps: true })
export class Report {
  @Prop({ required: true })
  ticker: string;

  @Prop({ required: true })
  date: Date;

  @Prop({ type: [ReportSectionSchema], required: true })
  sections: ReportSection[];

  @Prop({ required: true, enum: ['positive', 'negative', 'neutral'] })
  overallSentiment: string;

  @Prop({ required: true, enum: ['up', 'down', 'flat'] })
  priceTrend: string;
}

export const ReportSchema = SchemaFactory.createForClass(Report);
