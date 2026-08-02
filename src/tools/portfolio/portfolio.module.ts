import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';
import { PortfolioTool } from './portfolio.tool';

@Module({
  imports: [ConfigModule],
  controllers: [PortfolioController],
  providers: [PortfolioService, PortfolioTool, Logger],
  exports: [PortfolioService, PortfolioTool],
})
export class PortfolioModule {}
