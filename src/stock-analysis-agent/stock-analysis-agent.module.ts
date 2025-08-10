import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TiingoModule } from '../tiingo/tiingo.module';
import { StockAnalysisAgentService } from './stock-analysis-agent.service';

@Module({
  imports: [TiingoModule, HttpModule, ConfigModule],
  providers: [StockAnalysisAgentService],
  exports: [StockAnalysisAgentService],
})
export class StockAnalysisAgentModule {}
