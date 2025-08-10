import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WebScrapingService } from './web-scraping.service';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [WebScrapingService],
  exports: [WebScrapingService],
})
export class WebScrapingModule {}
