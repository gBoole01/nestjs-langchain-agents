import { Controller, Get } from '@nestjs/common';
import { PortfolioService } from './portfolio.service';

@Controller('portfolio')
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Get()
  findAll() {
    return this.portfolioService.findAll();
  }

  @Get('watchlist')
  findWatchlist() {
    return this.portfolioService.findWatchlist();
  }
}
