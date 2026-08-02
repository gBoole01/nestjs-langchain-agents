import { Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { AnalysisRunsService } from 'src/runs/analysis-runs.service';
import { RunRecord } from 'src/runs/run.types';
import { GetPriceHistoryDto } from './dto/get-price-history.dto';
import { MarketDataScraperService } from './market-data-scraper.service';
import { MarketDataService } from './market-data.service';
import { MarketDataPointDocument } from './models/market-data.model';

const DEFAULT_RANGE_DAYS = 90;

@Controller('market-data')
export class MarketDataController {
  constructor(
    private readonly marketDataScraperService: MarketDataScraperService,
    private readonly marketDataService: MarketDataService,
    private readonly analysisRunsService: AnalysisRunsService,
  ) {}

  @Post('scrape')
  @HttpCode(202)
  triggerScrape(): RunRecord {
    return this.analysisRunsService.start('market-data-scrape', {}, () =>
      this.marketDataScraperService.scrapeAll(),
    );
  }

  @Get(':ticker')
  findPriceHistory(
    @Param('ticker') ticker: string,
    @Query() query: GetPriceHistoryDto,
  ): Promise<MarketDataPointDocument[]> {
    const end = query.end ?? new Date().toISOString();
    const start =
      query.start ??
      new Date(
        Date.now() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString();

    return this.marketDataService.getPriceHistory(ticker, start, end);
  }
}
