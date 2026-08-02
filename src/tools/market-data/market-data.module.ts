import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { TiingoModule } from '../tiingo/tiingo.module';
import { FetchStockDataTool } from './fetch-stock-data.tool';
import { MarketDataController } from './market-data.controller';
import { MarketDataScraperService } from './market-data-scraper.service';
import { MarketDataService } from './market-data.service';
import {
  MarketDataPoint,
  MarketDataPointSchema,
} from './models/market-data.model';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MarketDataPoint.name, schema: MarketDataPointSchema },
    ]),
    TiingoModule,
    PortfolioModule,
  ],
  controllers: [MarketDataController],
  providers: [MarketDataService, MarketDataScraperService, FetchStockDataTool],
  exports: [MarketDataService, FetchStockDataTool],
})
export class MarketDataModule {}
