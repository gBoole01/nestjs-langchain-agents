import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WebScrapingService } from './web-scraping.service';
import { WebScrapingTool } from './web-scraping.tool';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [WebScrapingService, WebScrapingTool],
  exports: [WebScrapingService, WebScrapingTool],
})
export class WebScrapingModule {}
