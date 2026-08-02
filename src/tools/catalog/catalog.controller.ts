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
import { CreateCatalogInstrumentDto } from './dto/create-catalog-instrument.dto';
import { UpdateCatalogInstrumentDto } from './dto/update-catalog-instrument.dto';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  findAll() {
    return this.catalogService.findAll();
  }

  @Get(':ticker')
  findOne(@Param('ticker') ticker: string) {
    return this.catalogService.findOne(ticker);
  }

  @Post()
  @HttpCode(201)
  create(@Body() dto: CreateCatalogInstrumentDto) {
    return this.catalogService.create(dto);
  }

  @Patch(':ticker')
  update(
    @Param('ticker') ticker: string,
    @Body() dto: UpdateCatalogInstrumentDto,
  ) {
    return this.catalogService.update(ticker, dto);
  }

  @Delete(':ticker')
  @HttpCode(204)
  remove(@Param('ticker') ticker: string) {
    return this.catalogService.remove(ticker);
  }
}
