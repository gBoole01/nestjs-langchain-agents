import { MarketDataService } from './market-data.service';

describe('MarketDataService', () => {
  let service: MarketDataService;
  let mockModel: {
    find: jest.Mock;
    findOne: jest.Mock;
    bulkWrite: jest.Mock;
  };

  beforeEach(() => {
    mockModel = {
      find: jest.fn(),
      findOne: jest.fn(),
      bulkWrite: jest.fn(),
    };
    service = new MarketDataService(mockModel as any);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('queries stored points within the requested date range', async () => {
    const exec = jest.fn().mockResolvedValue([{ ticker: 'AAPL' }]);
    const sort = jest.fn().mockReturnValue({ exec });
    mockModel.find.mockReturnValue({ sort });

    const result = await service.getPriceHistory(
      'AAPL',
      '2025-01-01',
      '2025-01-31',
    );

    expect(mockModel.find).toHaveBeenCalledWith(
      expect.objectContaining({ ticker: 'AAPL' }),
    );
    expect(result).toEqual([{ ticker: 'AAPL' }]);
  });

  it('returns null when no points are stored yet for a ticker', async () => {
    const exec = jest.fn().mockResolvedValue(null);
    const select = jest.fn().mockReturnValue({ exec });
    const sort = jest.fn().mockReturnValue({ select });
    mockModel.findOne.mockReturnValue({ sort });

    const result = await service.getLatestDate('NEWTICKER');

    expect(result).toBeNull();
  });

  it('upserts each point via a single bulkWrite call', async () => {
    mockModel.bulkWrite.mockResolvedValue({
      upsertedCount: 1,
      modifiedCount: 0,
    });

    const count = await service.upsertMany('AAPL', [
      { date: '2025-01-01', close: 100 },
    ]);

    expect(mockModel.bulkWrite).toHaveBeenCalledTimes(1);
    expect(count).toBe(1);
  });

  it('skips the bulkWrite call when there are no points to upsert', async () => {
    const count = await service.upsertMany('AAPL', []);

    expect(mockModel.bulkWrite).not.toHaveBeenCalled();
    expect(count).toBe(0);
  });
});
