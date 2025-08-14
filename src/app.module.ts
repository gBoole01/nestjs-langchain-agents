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
        const MONGO_PORT = configService.get<string>('MONGO_PORT') ?? '';
        const MONGO_PROTOCOL = configService.get<string>('MONGO_PROTOCOL');
        const MONGO_APP_NAME = configService.get<string>('MONGO_APP_NAME');

        if (
          !MONGO_USERNAME ||
          !MONGO_PASSWORD ||
          !MONGO_INITDB_DATABASE ||
          !MONGO_HOST
        ) {
          logger.error(
            'Missing MongoDB connection environment variables! Please check your .env file.',
          );
          throw new Error('MongoDB connection configuration missing.');
        }

        let extraArgs = '';
        let dbConnectionURL = '';
        if (MONGO_PROTOCOL === 'mongodb+srv') {
          extraArgs = `?w=majority&appName=${MONGO_APP_NAME}`;
          dbConnectionURL = `${MONGO_PROTOCOL}://${MONGO_USERNAME}:${MONGO_PASSWORD}@${MONGO_HOST}/${MONGO_INITDB_DATABASE}?${extraArgs}`;
        } else if (MONGO_PROTOCOL === 'mongodb') {
          if (MONGO_PORT === '') {
            logger.error(
              'Missing MongoDB port environment variable! Please check your .env file.',
            );
            throw new Error('MongoDB port configuration missing.');
          }
          extraArgs = '?authSource=admin';
          dbConnectionURL = `${MONGO_PROTOCOL}://${MONGO_USERNAME}:${MONGO_PASSWORD}@${MONGO_HOST}/${MONGO_INITDB_DATABASE}?${extraArgs}`;
        } else {
          throw new Error('Invalid value for MONGO_PROTOCOL.');
        }

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
