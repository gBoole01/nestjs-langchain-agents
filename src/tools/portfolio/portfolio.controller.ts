import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CreateHoldingDto } from './dto/create-holding.dto';
import { CreateWatchlistItemDto } from './dto/create-watchlist-item.dto';
import { UpdateHoldingDto } from './dto/update-holding.dto';
import { PortfolioService } from './portfolio.service';

@Controller('portfolio')
export class PortfolioController {
  constructor(
    private readonly portfolioService: PortfolioService,
    private readonly catalogService: CatalogService,
  ) {}

  @Get()
  findAll() {
    return this.portfolioService.findAll();
  }

  @Get('watchlist')
  findWatchlist() {
    return this.portfolioService.findWatchlist();
  }

  @Get('catalog')
  findCatalog() {
    return this.catalogService.findAll();
  }

  @Post()
  @HttpCode(201)
  createHolding(@Body() dto: CreateHoldingDto) {
    return this.portfolioService.createHolding(dto);
  }

  @Patch(':ticker')
  updateHolding(
    @Param('ticker') ticker: string,
    @Body() dto: UpdateHoldingDto,
  ) {
    return this.portfolioService.updateHolding(ticker, dto);
  }

  @Delete(':ticker')
  @HttpCode(204)
  removeHolding(@Param('ticker') ticker: string) {
    return this.portfolioService.removeHolding(ticker);
  }

  @Post('watchlist')
  @HttpCode(201)
  createWatchlistItem(@Body() dto: CreateWatchlistItemDto) {
    return this.portfolioService.createWatchlistItem(dto);
  }

  @Delete('watchlist/:ticker')
  @HttpCode(204)
  removeWatchlistItem(@Param('ticker') ticker: string) {
    return this.portfolioService.removeWatchlistItem(ticker);
  }
}
