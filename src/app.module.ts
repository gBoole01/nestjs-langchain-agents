import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DiscordModule } from './discord/discord.module';
import { SerperNewsService } from './serper/serper-news.service';
import { SerperReviewsService } from './serper/serper-reviews.service';
import { SerperWebService } from './serper/serper-web.service';
import { SerperModule } from './serper/serper.module';
import { WebScrapingModule } from './web-scraping/web-scraping.module';
import { WebScrapingService } from './web-scraping/web-scraping.service';
import { TiingoService } from './tiingo/tiingo.service';
import { TiingoModule } from './tiingo/tiingo.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    DiscordModule,
    SerperModule,
    WebScrapingModule,
    TiingoModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    SerperNewsService,
    SerperReviewsService,
    SerperWebService,
    WebScrapingService,
    TiingoService,
  ],
})
export class AppModule {}
