import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import {
  NewsSearchParameters,
  NewsSearchResult,
  SerperResponse,
} from './serper.types';

@Injectable()
export class SerperNewsService {
  private readonly logger = new Logger(SerperNewsService.name);
  private readonly apiUrl = 'https://google.serper.dev/news';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Searches the news for information using a third-party search API.
   * @param params The search query parameters.
   * @returns A structured array of news results.
   */
  async newsSearchTool(
    params: NewsSearchParameters,
  ): Promise<NewsSearchResult[]> {
    const serperApiKey = this.configService.get<string>('SERPER_API_KEY');

    if (!serperApiKey) {
      this.logger.error(
        'SERPER_API_KEY is not set in the environment variables.',
      );
      throw new Error(
        'SERPER_API_KEY is not set in the environment variables.',
      );
    }

    const tbsMapping = {
      last_hour: 'qdr:h',
      last_day: 'qdr:d',
      last_week: 'qdr:w',
      last_month: 'qdr:m',
      last_year: 'qdr:y',
    } as const;

    const body = {
      q: params.query,
      gl: params.language,
      location: params.viewFrom,
      hl: params.language,
      autocorrect: false,
      tbs: params.period ? tbsMapping[params.period] : undefined,
    };

    try {
      const headers = {
        'X-API-KEY': serperApiKey,
        'Content-Type': 'application/json',
      };

      const response = await firstValueFrom(
        this.httpService.post<SerperResponse>(this.apiUrl, body, { headers }),
      );

      if (!response.data.news) {
        this.logger.warn('No news results found for the given query.');
        return [];
      }

      return response.data.news.map((result) => ({
        title: result.title,
        link: result.link,
        snippet: result.snippet || result.section || '',
      }));
    } catch (error) {
      this.logger.error(
        'Failed to perform news search:',
        error.response?.data || error.message,
      );
      return [];
    }
  }
}
