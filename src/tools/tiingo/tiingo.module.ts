import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TiingoService } from './tiingo.service';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [TiingoService],
  exports: [TiingoService],
})
export class TiingoModule {}
