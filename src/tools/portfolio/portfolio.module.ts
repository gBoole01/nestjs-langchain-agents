import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { Holding, HoldingSchema } from './models/holding.model';
import { Order, OrderSchema } from './models/order.model';
import {
  WatchedTicker,
  WatchedTickerSchema,
} from './models/watched-ticker.model';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';
import { PortfolioTool } from './portfolio.tool';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Holding.name, schema: HoldingSchema },
      { name: WatchedTicker.name, schema: WatchedTickerSchema },
      { name: Order.name, schema: OrderSchema },
    ]),
  ],
  controllers: [PortfolioController],
  providers: [PortfolioService, PortfolioTool, Logger],
  exports: [PortfolioService, PortfolioTool],
})
export class PortfolioModule {}
