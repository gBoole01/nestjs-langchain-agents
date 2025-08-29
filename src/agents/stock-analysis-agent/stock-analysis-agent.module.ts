import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ReportRetrievalModule } from '../../tools/rag/report-retrieval.module';
import { SerperModule } from '../../tools/serper/serper.module';
import { TiingoModule } from '../../tools/tiingo/tiingo.module';
import { WebScrapingModule } from '../../tools/web-scraping/web-scraping.module';
import { AgentDebugService } from './crew/agent-debug.service';
import { ArchivistAgentService } from './crew/archivist-agent.service';
import { CriticAgentService } from './crew/critic-agent.service';
import { DataAnalystAgentService } from './crew/data-analyst-agent.service';
import { JournalistAgentService } from './crew/journalist-agent.service';
import { WriterAgentService } from './crew/writer-agent.service';
import { Report, ReportSchema } from './models/reports.model';
import { StockAnalysisAgentGraphService } from './stock-analysis-agent-graph.service';
import { StockAnalysisAgentService } from './stock-analysis-agent.service';

@Module({
  imports: [
    TiingoModule,
    HttpModule,
    ConfigModule,
    SerperModule,
    WebScrapingModule,
    ReportRetrievalModule,
    MongooseModule.forFeature([{ name: Report.name, schema: ReportSchema }]),
  ],
  providers: [
    StockAnalysisAgentGraphService,
    StockAnalysisAgentService,
    DataAnalystAgentService,
    JournalistAgentService,
    WriterAgentService,
    CriticAgentService,
    AgentDebugService,
    ArchivistAgentService,
  ],
  exports: [StockAnalysisAgentService, StockAnalysisAgentGraphService],
})
export class StockAnalysisAgentModule {}
