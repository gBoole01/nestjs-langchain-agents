import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { GeographicalAnalysisAgentModule } from 'src/agents/geographical-analysis-agent/geographical-analysis-agent.module';
import { GlobalAnalysisAgentModule } from 'src/agents/global-analysis-agent/global-analysis-agent.module';
import { SectorialAnalysisAgentModule } from 'src/agents/sectorial-analysis-agent/sectorial-analysis-agent.module';
import { MarketDataModule } from 'src/tools/market-data/market-data.module';
import { PortfolioModule } from 'src/tools/portfolio/portfolio.module';
import { ReportRetrievalModule } from '../../tools/rag/report-retrieval.module';
import { SerperModule } from '../../tools/serper/serper.module';
import { WebScrapingModule } from '../../tools/web-scraping/web-scraping.module';
import { AgentDebugService } from './crew/agent-debug.service';
import { ArchivistAgentService } from './crew/archivist-agent.service';
import { CriticAgentService } from './crew/critic-agent.service';
import { DataAnalystAgentService } from './crew/data-analyst-agent.service';
import { JournalistAgentService } from './crew/journalist-agent.service';
import { PortfolioAnalystAgentService } from './crew/portfolio-analyst.service';
import { WriterAgentService } from './crew/writer-agent.service';
import { Report, ReportSchema } from './models/reports.model';
import { StockAnalysisAgentGraphService } from './stock-analysis-agent-graph.service';
import { StockAnalysisAgentController } from './stock-analysis-agent.controller';
import { StockAnalysisAgentService } from './stock-analysis-agent.service';

@Module({
  imports: [
    MarketDataModule,
    HttpModule,
    ConfigModule,
    SerperModule,
    WebScrapingModule,
    ReportRetrievalModule,
    PortfolioModule,
    GlobalAnalysisAgentModule,
    GeographicalAnalysisAgentModule,
    SectorialAnalysisAgentModule,
    MongooseModule.forFeature([{ name: Report.name, schema: ReportSchema }]),
  ],
  controllers: [StockAnalysisAgentController],
  providers: [
    StockAnalysisAgentGraphService,
    StockAnalysisAgentService,
    DataAnalystAgentService,
    JournalistAgentService,
    WriterAgentService,
    CriticAgentService,
    AgentDebugService,
    PortfolioAnalystAgentService,
    ArchivistAgentService,
  ],
  exports: [
    StockAnalysisAgentService,
    StockAnalysisAgentGraphService,
    PortfolioAnalystAgentService,
  ],
})
export class StockAnalysisAgentModule {}
