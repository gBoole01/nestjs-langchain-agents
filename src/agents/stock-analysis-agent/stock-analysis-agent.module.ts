import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SerperModule } from 'src/tools/serper/serper.module';
import { WebScrapingModule } from 'src/tools/web-scraping/web-scraping.module';
import { TiingoModule } from '../../tools/tiingo/tiingo.module';
import { StockAnalysisAgentService } from './stock-analysis-agent.service';

@Module({
  imports: [
    TiingoModule,
    HttpModule,
    ConfigModule,
    SerperModule,
    WebScrapingModule,
  ],
  providers: [StockAnalysisAgentService],
  exports: [StockAnalysisAgentService],
})
export class StockAnalysisAgentModule {}
