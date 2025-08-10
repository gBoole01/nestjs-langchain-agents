import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SerperNewsService } from './serper-news.service';
import { SerperReviewsService } from './serper-reviews.service';
import { SerperWebService } from './serper-web.service';

@Module({
  imports: [HttpModule, ConfigModule],
  controllers: [],
  providers: [SerperNewsService, SerperReviewsService, SerperWebService],
  exports: [SerperNewsService, SerperReviewsService, SerperWebService],
})
export class SerperModule {}
