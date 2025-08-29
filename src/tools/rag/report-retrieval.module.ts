import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Report,
  ReportSchema,
} from 'src/agents/stock-analysis-agent/models/reports.model';
import { ReportRetrievalService } from './report-retrieval.service';
import { ReportRetrievalTool } from './report-retrieval.tool';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([{ name: Report.name, schema: ReportSchema }]),
  ],
  controllers: [],
  providers: [ReportRetrievalService, ReportRetrievalTool, Logger],
  exports: [ReportRetrievalService, ReportRetrievalTool],
})
export class ReportRetrievalModule {}
