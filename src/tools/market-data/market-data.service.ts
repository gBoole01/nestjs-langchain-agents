import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  MarketDataPoint,
  MarketDataPointDocument,
} from './models/market-data.model';

@Injectable()
export class MarketDataService {
  constructor(
    @InjectModel(MarketDataPoint.name)
    private readonly marketDataModel: Model<MarketDataPointDocument>,
  ) {}

  async getPriceHistory(
    ticker: string,
    startDate: string,
    endDate: string,
  ): Promise<MarketDataPointDocument[]> {
    const rangeStart = new Date(startDate);
    const rangeEnd = new Date(endDate);
    rangeEnd.setUTCHours(23, 59, 59, 999);

    return this.marketDataModel
      .find({
        ticker,
        date: { $gte: rangeStart, $lte: rangeEnd },
      })
      .sort({ date: 1 })
      .exec();
  }

  async getLatestDate(ticker: string): Promise<Date | null> {
    const latest = await this.marketDataModel
      .findOne({ ticker })
      .sort({ date: -1 })
      .select('date')
      .exec();
    return latest?.date ?? null;
  }

  async upsertMany(ticker: string, points: any[]): Promise<number> {
    if (points.length === 0) {
      return 0;
    }

    const operations = points.map((point) => ({
      updateOne: {
        filter: { ticker, date: new Date(point.date) },
        update: {
          $set: {
            ticker,
            date: new Date(point.date),
            open: point.open,
            high: point.high,
            low: point.low,
            close: point.close,
            adjOpen: point.adjOpen,
            adjHigh: point.adjHigh,
            adjLow: point.adjLow,
            adjClose: point.adjClose,
            volume: point.volume,
          },
        },
        upsert: true,
      },
    }));

    const result = await this.marketDataModel.bulkWrite(operations);
    return result.upsertedCount + result.modifiedCount;
  }
}
