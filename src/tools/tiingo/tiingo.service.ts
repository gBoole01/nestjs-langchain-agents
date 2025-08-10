import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class TiingoService {
  private readonly logger = new Logger(TiingoService.name);
  private readonly apiUrl = 'https://api.tiingo.com/tiingo/daily';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Fetches market data for a given ticker symbol from the Tiingo API.
   * @param ticker The stock ticker symbol (e.g., 'AAPL').
   * @param startDate The start date for the data (format 'YYYY-MM-DD').
   * @param endDate The end date for the data (format 'YYYY-MM-DD').
   * @returns A promise that resolves to an array of market data points.
   */
  async fetchMarketData(
    ticker: string,
    startDate: string,
    endDate: string,
  ): Promise<any[]> {
    const tiingoApiKey = this.configService.get<string>('TIINGO_API_KEY');

    if (!tiingoApiKey) {
      this.logger.error(
        'TIINGO_API_KEY is not set in the environment variables.',
      );
      throw new Error(
        'TIINGO_API_KEY is not set in the environment variables.',
      );
    }

    const url = `${this.apiUrl}/${ticker}/prices?startDate=${startDate}&endDate=${endDate}&token=${tiingoApiKey}`;

    try {
      const response = await firstValueFrom(this.httpService.get<any[]>(url));
      return response.data;
    } catch (error) {
      this.logger.error(
        'Failed to fetch market data from Tiingo:',
        error.response?.data || error.message,
      );
      return [];
    }
  }
}
