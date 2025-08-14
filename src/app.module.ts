import { HttpModule } from '@nestjs/axios';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ReportSchema } from './agents/stock-analysis-agent/models/reports.model';
import { StockAnalysisAgentModule } from './agents/stock-analysis-agent/stock-analysis-agent.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DiscordModule } from './integrations/discord/discord.module';
import { SerperModule } from './tools/serper/serper.module';
import { TiingoModule } from './tools/tiingo/tiingo.module';
import { WebScrapingModule } from './tools/web-scraping/web-scraping.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const logger = new Logger('MongooseModule');
        const MONGO_USERNAME = configService.get<string>('MONGO_USERNAME');
        const MONGO_PASSWORD = configService.get<string>('MONGO_PASSWORD');
        const MONGO_INITDB_DATABASE = configService.get<string>(
          'MONGO_INITDB_DATABASE',
        );
        const MONGO_HOST = configService.get<string>('MONGO_HOST');
        const MONGO_PORT = configService.get<string>('MONGO_PORT');

        if (
          !MONGO_USERNAME ||
          !MONGO_PASSWORD ||
          !MONGO_INITDB_DATABASE ||
          !MONGO_HOST ||
          !MONGO_PORT
        ) {
          logger.error(
            'Missing MongoDB connection environment variables! Please check your .env file.',
          );
          throw new Error('MongoDB connection configuration missing.');
        }

        const dbConnectionURL = `mongodb://${MONGO_USERNAME}:${MONGO_PASSWORD}@${MONGO_HOST}:${MONGO_PORT}/${MONGO_INITDB_DATABASE}?authSource=admin`;
        logger.log(`Attempting to connect to MongoDB: ${dbConnectionURL}`);

        return {
          uri: dbConnectionURL,
        };
      },
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([{ name: 'Report', schema: ReportSchema }]),
    HttpModule,
    DiscordModule,
    SerperModule,
    WebScrapingModule,
    TiingoModule,
    StockAnalysisAgentModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
