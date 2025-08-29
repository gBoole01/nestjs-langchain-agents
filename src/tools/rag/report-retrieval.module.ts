import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ReportRetrievalService } from './report-retrieval.service';
import { ReportRetrievalTool } from './report-retrieval.tool';

@Module({
  imports: [ConfigModule],
  controllers: [],
  providers: [ReportRetrievalService, ReportRetrievalTool, Logger],
  exports: [ReportRetrievalService, ReportRetrievalTool],
})
export class ReportRetrievalModule {}
