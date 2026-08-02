import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';

interface WatchlistItem {
  ticker: string;
  region?: string;
  sector?: string;
}

@Injectable()
export class PortfolioService {
  private portfolio: any[] = [];
  private watchlist: WatchlistItem[] = [];

  constructor() {
    const dataDir = join(__dirname, '..', '..', '..', 'data');
    this.portfolio = JSON.parse(
      readFileSync(join(dataDir, 'portfolio.json'), 'utf-8'),
    );
    this.watchlist = JSON.parse(
      readFileSync(join(dataDir, 'watchlist.json'), 'utf-8'),
    );
  }

  findAll() {
    return this.portfolio;
  }

  findWatchlist() {
    return this.watchlist;
  }

  /**
   * Looks up the region/sector for a ticker across both the portfolio and
   * the watchlist, so the stock analysis graph knows which geographical and
   * sectorial reports are relevant context.
   */
  findRegionAndSector(ticker: string): { region?: string; sector?: string } {
    const match =
      this.portfolio.find((item) => item.ticker === ticker) ??
      this.watchlist.find((item) => item.ticker === ticker);
    return { region: match?.region, sector: match?.sector };
  }
}
