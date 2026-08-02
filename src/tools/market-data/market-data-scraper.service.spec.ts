import { MarketDataScraperService } from './market-data-scraper.service';

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

describe('MarketDataScraperService', () => {
  let service: MarketDataScraperService;
  let portfolioService: { findAll: jest.Mock; findWatchlist: jest.Mock };
  let tiingoService: { fetchMarketData: jest.Mock };
  let marketDataService: { getLatestDate: jest.Mock; upsertMany: jest.Mock };

  beforeEach(() => {
    portfolioService = {
      findAll: jest.fn().mockResolvedValue([{ ticker: 'AAPL' }]),
      findWatchlist: jest.fn().mockResolvedValue([{ ticker: 'TSLA' }]),
    };
    tiingoService = {
      fetchMarketData: jest.fn().mockResolvedValue([]),
    };
    marketDataService = {
      getLatestDate: jest.fn().mockResolvedValue(null),
      upsertMany: jest.fn().mockResolvedValue(0),
    };

    service = new MarketDataScraperService(
      portfolioService as any,
      tiingoService as any,
      marketDataService as any,
    );
  });

  it('backfills 90 days when a ticker has no stored history yet', async () => {
    portfolioService.findAll.mockResolvedValue([{ ticker: 'AAPL' }]);
    portfolioService.findWatchlist.mockResolvedValue([]);
    marketDataService.getLatestDate.mockResolvedValue(null);

    await service.scrapeAll();

    const today = new Date();
    const expectedStart = new Date(today);
    expectedStart.setUTCDate(expectedStart.getUTCDate() - 90);

    expect(tiingoService.fetchMarketData).toHaveBeenCalledWith(
      'AAPL',
      formatDate(expectedStart),
      formatDate(today),
    );
  });

  it('scrapes incrementally from the day after the last stored point', async () => {
    portfolioService.findAll.mockResolvedValue([{ ticker: 'AAPL' }]);
    portfolioService.findWatchlist.mockResolvedValue([]);
    const latestDate = new Date();
    latestDate.setUTCDate(latestDate.getUTCDate() - 5);
    marketDataService.getLatestDate.mockResolvedValue(latestDate);

    await service.scrapeAll();

    const expectedStart = new Date(latestDate);
    expectedStart.setUTCDate(expectedStart.getUTCDate() + 1);

    expect(tiingoService.fetchMarketData).toHaveBeenCalledWith(
      'AAPL',
      formatDate(expectedStart),
      formatDate(new Date()),
    );
  });

  it('dedupes tickers present in both holdings and the watchlist', async () => {
    portfolioService.findAll.mockResolvedValue([{ ticker: 'AAPL' }]);
    portfolioService.findWatchlist.mockResolvedValue([{ ticker: 'AAPL' }]);

    const summary = await service.scrapeAll();

    expect(tiingoService.fetchMarketData).toHaveBeenCalledTimes(1);
    expect(summary).toBe('1 tickers: 1 ok, 0 failed');
  });

  it('isolates a failing ticker so the rest of the batch still runs', async () => {
    portfolioService.findAll.mockResolvedValue([
      { ticker: 'BADTICKER' },
      { ticker: 'AAPL' },
    ]);
    portfolioService.findWatchlist.mockResolvedValue([]);
    tiingoService.fetchMarketData.mockImplementation((ticker: string) => {
      if (ticker === 'BADTICKER') {
        throw new Error('Tiingo rejected the request');
      }
      return Promise.resolve([]);
    });

    const summary = await service.scrapeAll();

    expect(tiingoService.fetchMarketData).toHaveBeenCalledWith(
      'BADTICKER',
      expect.any(String),
      expect.any(String),
    );
    expect(tiingoService.fetchMarketData).toHaveBeenCalledWith(
      'AAPL',
      expect.any(String),
      expect.any(String),
    );
    expect(summary).toBe('2 tickers: 1 ok, 1 failed');
  });

  it('does not call Tiingo when already up to date for the day', async () => {
    portfolioService.findAll.mockResolvedValue([{ ticker: 'AAPL' }]);
    portfolioService.findWatchlist.mockResolvedValue([]);
    marketDataService.getLatestDate.mockResolvedValue(new Date());

    await service.scrapeAll();

    expect(tiingoService.fetchMarketData).not.toHaveBeenCalled();
  });
});
