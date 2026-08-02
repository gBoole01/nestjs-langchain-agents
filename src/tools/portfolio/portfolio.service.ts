import { InjectModel } from '@nestjs/mongoose';
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Model } from 'mongoose';
import { CreateHoldingDto } from './dto/create-holding.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateWatchlistItemDto } from './dto/create-watchlist-item.dto';
import { UpdateHoldingDto } from './dto/update-holding.dto';
import { Holding, HoldingDocument } from './models/holding.model';
import { Order, OrderDocument } from './models/order.model';
import {
  WatchedTicker,
  WatchedTickerDocument,
} from './models/watched-ticker.model';

const MONGO_DUPLICATE_KEY_ERROR_CODE = 11000;

@Injectable()
export class PortfolioService implements OnModuleInit {
  private readonly logger = new Logger(PortfolioService.name);

  constructor(
    @InjectModel(Holding.name)
    private readonly holdingModel: Model<HoldingDocument>,
    @InjectModel(WatchedTicker.name)
    private readonly watchedTickerModel: Model<WatchedTickerDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedIfEmpty();
  }

  /**
   * data/portfolio.json and data/watchlist.json hold the real, hand-maintained
   * holdings/watchlist that predate the Mongo-backed CRUD API. Seed from them
   * once per collection so existing data isn't lost, but never re-seed a
   * collection that already has documents (would duplicate or clobber edits).
   */
  private async seedIfEmpty(): Promise<void> {
    const dataDir = join(__dirname, '..', '..', '..', 'data');

    const holdingCount = await this.holdingModel.countDocuments();
    if (holdingCount === 0) {
      const seed = JSON.parse(
        readFileSync(join(dataDir, 'portfolio.json'), 'utf-8'),
      );
      if (seed.length > 0) {
        await this.holdingModel.insertMany(seed);
        this.logger.log(`Seeded ${seed.length} holdings from portfolio.json`);
      }
    }

    const watchlistCount = await this.watchedTickerModel.countDocuments();
    if (watchlistCount === 0) {
      const seed = JSON.parse(
        readFileSync(join(dataDir, 'watchlist.json'), 'utf-8'),
      );
      if (seed.length > 0) {
        await this.watchedTickerModel.insertMany(seed);
        this.logger.log(
          `Seeded ${seed.length} watchlist items from watchlist.json`,
        );
      }
    }
  }

  findAll(): Promise<HoldingDocument[]> {
    return this.holdingModel.find().exec();
  }

  findWatchlist(): Promise<WatchedTickerDocument[]> {
    return this.watchedTickerModel.find().exec();
  }

  async createHolding(dto: CreateHoldingDto): Promise<HoldingDocument> {
    try {
      return await this.holdingModel.create(dto);
    } catch (error) {
      if (error.code === MONGO_DUPLICATE_KEY_ERROR_CODE) {
        throw new ConflictException(`Holding for ${dto.ticker} already exists`);
      }
      throw error;
    }
  }

  async updateHolding(
    ticker: string,
    dto: UpdateHoldingDto,
  ): Promise<HoldingDocument> {
    const updated = await this.holdingModel
      .findOneAndUpdate({ ticker }, dto, { new: true })
      .exec();
    if (!updated) {
      throw new NotFoundException(`Holding ${ticker} not found`);
    }
    return updated;
  }

  async removeHolding(ticker: string): Promise<void> {
    const result = await this.holdingModel.deleteOne({ ticker }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Holding ${ticker} not found`);
    }
  }

  async createWatchlistItem(
    dto: CreateWatchlistItemDto,
  ): Promise<WatchedTickerDocument> {
    try {
      return await this.watchedTickerModel.create(dto);
    } catch (error) {
      if (error.code === MONGO_DUPLICATE_KEY_ERROR_CODE) {
        throw new ConflictException(`${dto.ticker} already on watchlist`);
      }
      throw error;
    }
  }

  async removeWatchlistItem(ticker: string): Promise<void> {
    const result = await this.watchedTickerModel.deleteOne({ ticker }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Watchlist item ${ticker} not found`);
    }
  }

  findAllOrders(): Promise<OrderDocument[]> {
    return this.orderModel.find().sort({ executedAt: -1 }).exec();
  }

  findOrdersByTicker(ticker: string): Promise<OrderDocument[]> {
    return this.orderModel.find({ ticker }).sort({ executedAt: -1 }).exec();
  }

  /**
   * Placing an order is the source of truth for position changes: a buy
   * creates the holding if it doesn't exist yet (or increments its shares),
   * a sell decrements it. Sells that would take shares negative are
   * rejected outright rather than clamped, so the holding never drifts out
   * of sync with the recorded order history.
   */
  async placeOrder(dto: CreateOrderDto): Promise<OrderDocument> {
    const holding = await this.holdingModel.findOne({ ticker: dto.ticker }).exec();

    if (dto.side === 'sell' && (!holding || holding.shares < dto.shares)) {
      throw new ConflictException(
        `Insufficient shares of ${dto.ticker} to sell: holding has ${holding?.shares ?? 0}, order requests ${dto.shares}`,
      );
    }

    const order = await this.orderModel.create({
      ticker: dto.ticker,
      side: dto.side,
      shares: dto.shares,
      price: dto.price,
      ...(dto.executedAt ? { executedAt: new Date(dto.executedAt) } : {}),
    });

    const shareDelta = dto.side === 'buy' ? dto.shares : -dto.shares;
    if (holding) {
      await this.holdingModel
        .updateOne(
          { ticker: dto.ticker },
          { $inc: { shares: shareDelta }, $set: { currentPrice: dto.price } },
        )
        .exec();
    } else {
      await this.holdingModel.create({
        ticker: dto.ticker,
        shares: shareDelta,
        currentPrice: dto.price,
      });
    }

    return order;
  }

  /**
   * Looks up the region/sector for a ticker across both the portfolio and
   * the watchlist, so the stock analysis graph knows which geographical and
   * sectorial reports are relevant context.
   */
  async findRegionAndSector(
    ticker: string,
  ): Promise<{ region?: string; sector?: string }> {
    const holding = await this.holdingModel.findOne({ ticker }).exec();
    if (holding) {
      return { region: holding.region, sector: holding.sector };
    }
    const watched = await this.watchedTickerModel.findOne({ ticker }).exec();
    return { region: watched?.region, sector: watched?.sector };
  }

  async isTracked(ticker: string): Promise<boolean> {
    const [inHoldings, inWatchlist] = await Promise.all([
      this.holdingModel.exists({ ticker }),
      this.watchedTickerModel.exists({ ticker }),
    ]);
    return Boolean(inHoldings || inWatchlist);
  }
}
