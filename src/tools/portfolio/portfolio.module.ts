import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PortfolioService } from './portfolio.service';
import { PortfolioTool } from './portfolio.tool';

@Module({
  imports: [ConfigModule],
  controllers: [],
  providers: [PortfolioService, PortfolioTool, Logger],
  exports: [PortfolioService, PortfolioTool],
})
export class PortfolioModule {}
