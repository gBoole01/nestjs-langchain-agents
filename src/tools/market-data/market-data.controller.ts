import { Controller, HttpCode, Post } from '@nestjs/common';
import { AnalysisRunsService } from 'src/runs/analysis-runs.service';
import { RunRecord } from 'src/runs/run.types';
import { MarketDataScraperService } from './market-data-scraper.service';

@Controller('market-data')
export class MarketDataController {
  constructor(
    private readonly marketDataScraperService: MarketDataScraperService,
    private readonly analysisRunsService: AnalysisRunsService,
  ) {}

  @Post('scrape')
  @HttpCode(202)
  triggerScrape(): RunRecord {
    return this.analysisRunsService.start('market-data-scrape', {}, () =>
      this.marketDataScraperService.scrapeAll(),
    );
  }
}
