import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ReportDocument = Report & Document;

@Schema({ timestamps: true })
export class Report {
  @Prop({ required: true })
  ticker: string;

  @Prop({ required: true })
  reportContent: string;

  @Prop({ required: true })
  date: Date;
}

export const ReportSchema = SchemaFactory.createForClass(Report);
