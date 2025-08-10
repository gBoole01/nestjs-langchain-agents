import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StockAnalysisAgentModule } from './agents/stock-analysis-agent/stock-analysis-agent.module';
import { StockAnalysisAgentService } from './agents/stock-analysis-agent/stock-analysis-agent.service';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DiscordModule } from './integrations/discord/discord.module';
import { SerperNewsService } from './tools/serper/serper-news.service';
import { SerperReviewsService } from './tools/serper/serper-reviews.service';
import { SerperWebService } from './tools/serper/serper-web.service';
import { SerperModule } from './tools/serper/serper.module';
import { TiingoModule } from './tools/tiingo/tiingo.module';
import { TiingoService } from './tools/tiingo/tiingo.service';
import { WebScrapingModule } from './tools/web-scraping/web-scraping.module';
import { WebScrapingService } from './tools/web-scraping/web-scraping.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    HttpModule,
    DiscordModule,
    SerperModule,
    WebScrapingModule,
    TiingoModule,
    StockAnalysisAgentModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    SerperNewsService,
    SerperReviewsService,
    SerperWebService,
    WebScrapingService,
    TiingoService,
    StockAnalysisAgentService,
  ],
})
export class AppModule {}
