import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SerperNewsService } from './serper-news.service';
import { SerperNewsTool } from './serper-news.tool';
import { SerperReviewsService } from './serper-reviews.service';
import { SerperWebService } from './serper-web.service';
import { SerperWebTool } from './serper-web.tool';

@Module({
  imports: [HttpModule, ConfigModule],
  controllers: [],
  providers: [
    SerperNewsService,
    SerperReviewsService,
    SerperWebService,
    SerperNewsTool,
    SerperWebTool,
  ],
  exports: [
    SerperNewsService,
    SerperReviewsService,
    SerperWebService,
    SerperNewsTool,
    SerperWebTool,
  ],
})
export class SerperModule {}
