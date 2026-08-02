import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PortfolioService } from '../portfolio/portfolio.service';
import { TiingoService } from '../tiingo/tiingo.service';
import { MarketDataService } from './market-data.service';

const DAILY_SCRAPE_CRON = '0 22 * * 1-5';
const DEFAULT_BACKFILL_DAYS = 90;

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

@Injectable()
export class MarketDataScraperService {
  private readonly logger = new Logger(MarketDataScraperService.name);

  constructor(
    private readonly portfolioService: PortfolioService,
    private readonly tiingoService: TiingoService,
    private readonly marketDataService: MarketDataService,
  ) {}

  @Cron(DAILY_SCRAPE_CRON)
  async handleScheduledScrape(): Promise<void> {
    await this.scrapeAll();
  }

  async scrapeAll(): Promise<string> {
    const [holdings, watchlist] = await Promise.all([
      this.portfolioService.findAll(),
      this.portfolioService.findWatchlist(),
    ]);
    const tickers = Array.from(
      new Set([
        ...holdings.map((holding) => holding.ticker),
        ...watchlist.map((watched) => watched.ticker),
      ]),
    );

    let succeeded = 0;
    let failed = 0;

    for (const ticker of tickers) {
      try {
        await this.scrapeTicker(ticker);
        succeeded++;
      } catch (error) {
        failed++;
        this.logger.error(
          `Failed to scrape market data for ${ticker}: ${error.message}`,
        );
      }
    }

    const summary = `${tickers.length} tickers: ${succeeded} ok, ${failed} failed`;
    this.logger.log(summary);
    return summary;
  }

  private async scrapeTicker(ticker: string): Promise<void> {
    const latestDate = await this.marketDataService.getLatestDate(ticker);
    const today = new Date();

    let start: Date;
    if (latestDate) {
      start = new Date(latestDate);
      start.setUTCDate(start.getUTCDate() + 1);
    } else {
      start = new Date(today);
      start.setUTCDate(start.getUTCDate() - DEFAULT_BACKFILL_DAYS);
    }

    const startDate = formatDate(start);
    const endDate = formatDate(today);
    if (startDate > endDate) {
      return;
    }

    const points = await this.tiingoService.fetchMarketData(
      ticker,
      startDate,
      endDate,
    );
    if (!points || points.length === 0) {
      return;
    }

    await this.marketDataService.upsertMany(ticker, points);
  }
}
