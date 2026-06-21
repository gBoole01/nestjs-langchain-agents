import { Module } from '@nestjs/common';
import { PortfolioModule } from './portfolio/portfolio.module';
import { ReportRetrievalModule } from './rag/report-retrieval.module';
import { SerperModule } from './serper/serper.module';
import { TiingoModule } from './tiingo/tiingo.module';
import { WebScrapingModule } from './web-scraping/web-scraping.module';

@Module({
  imports: [
    SerperModule,
    WebScrapingModule,
    TiingoModule,
    PortfolioModule,
    ReportRetrievalModule,
  ],
  exports: [
    SerperModule,
    WebScrapingModule,
    TiingoModule,
    PortfolioModule,
    ReportRetrievalModule,
  ],
})
export class ToolsModule {}
