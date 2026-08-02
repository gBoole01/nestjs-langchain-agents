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
import { CreateHoldingDto } from './dto/create-holding.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateWatchlistItemDto } from './dto/create-watchlist-item.dto';
import { UpdateHoldingDto } from './dto/update-holding.dto';
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

  @Get('orders')
  findAllOrders() {
    return this.portfolioService.findAllOrders();
  }

  @Get('orders/:ticker')
  findOrdersByTicker(@Param('ticker') ticker: string) {
    return this.portfolioService.findOrdersByTicker(ticker);
  }

  @Post('orders')
  @HttpCode(201)
  placeOrder(@Body() dto: CreateOrderDto) {
    return this.portfolioService.placeOrder(dto);
  }
}
