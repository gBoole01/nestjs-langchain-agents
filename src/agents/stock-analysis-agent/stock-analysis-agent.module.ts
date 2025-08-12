import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SerperModule } from 'src/tools/serper/serper.module';
import { WebScrapingModule } from 'src/tools/web-scraping/web-scraping.module';
import { TiingoModule } from '../../tools/tiingo/tiingo.module';
import { AgentDebugService } from './agent-debug.service';
import { DataAnalystAgentService } from './data-analyst-agent.service';
import { JournalistAgentService } from './journalist-agent.service';
import { StockAnalysisAgentService } from './stock-analysis-agent.service';
import { WriterAgentService } from './writer-agent.service';

@Module({
  imports: [
    TiingoModule,
    HttpModule,
    ConfigModule,
    SerperModule,
    WebScrapingModule,
  ],
  providers: [
    StockAnalysisAgentService,
    DataAnalystAgentService,
    JournalistAgentService,
    WriterAgentService,
    AgentDebugService,
  ],
  exports: [StockAnalysisAgentService],
})
export class StockAnalysisAgentModule {}
