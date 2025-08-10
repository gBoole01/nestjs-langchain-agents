import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FetchStockDataTool } from './fetch-stock-data.tool';
import { TiingoService } from './tiingo.service';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [TiingoService, FetchStockDataTool],
  exports: [TiingoService, FetchStockDataTool],
})
export class TiingoModule {}
