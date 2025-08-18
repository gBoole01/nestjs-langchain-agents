import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ReportRetrievalService } from './report-retrieval.service';
import { ReportRetrievalTool } from './report-retrieval.tool';

@Module({
  imports: [ConfigModule],
  controllers: [],
  providers: [ReportRetrievalService, ReportRetrievalTool],
  exports: [ReportRetrievalService, ReportRetrievalTool],
})
export class ReportRetrievalModule {}
