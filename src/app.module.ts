import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DiscordModule } from './discord/discord.module';
import { SerperNewsService } from './serper/serper-news.service';
import { SerperReviewsService } from './serper/serper-reviews.service';
import { SerperWebService } from './serper/serper-web.service';
import { SerperModule } from './serper/serper.module';
import { StockAnalysisAgentModule } from './stock-analysis-agent/stock-analysis-agent.module';
import { StockAnalysisAgentService } from './stock-analysis-agent/stock-analysis-agent.service';
import { TiingoModule } from './tiingo/tiingo.module';
import { TiingoService } from './tiingo/tiingo.service';
import { WebScrapingModule } from './web-scraping/web-scraping.module';
import { WebScrapingService } from './web-scraping/web-scraping.service';

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
