import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import {
  SerperResponse,
  WebSearchParameters,
  WebSearchResult,
} from './serper.types';

@Injectable()
export class SerperWebService {
  private readonly logger = new Logger(SerperWebService.name);
  private readonly apiUrl = 'https://google.serper.dev/search';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Searches the web for information using a third-party search API.
   * @param params The search query parameters.
   * @returns A structured array of search results.
   */
  async webSearchTool(params: WebSearchParameters): Promise<WebSearchResult[]> {
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
      tbs: tbsMapping[params.period],
    };

    try {
      const headers = {
        'X-API-KEY': serperApiKey,
        'Content-Type': 'application/json',
      };

      const response = await firstValueFrom(
        this.httpService.post<SerperResponse>(this.apiUrl, body, { headers }),
      );

      return response.data.organic.map((result) => ({
        title: result.title,
        link: result.link,
        snippet: result.snippet,
      }));
    } catch (error) {
      this.logger.error(
        'Failed to perform web search:',
        error.response?.data || error.message,
      );
      return [];
    }
  }
}
