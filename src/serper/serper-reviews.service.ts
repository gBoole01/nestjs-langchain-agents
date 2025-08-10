import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import {
  ReviewSearchParameters,
  ReviewSearchResult,
  SerperResponse,
} from './serper.types';

@Injectable()
export class SerperReviewsService {
  private readonly logger = new Logger(SerperReviewsService.name);
  private readonly apiUrl =
    '[https://google.serper.dev/reviews](https://google.serper.dev/reviews)';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Searches for reviews for a specific place using a third-party search API.
   * @param params The review search query parameters.
   * @returns A structured array of review results.
   */
  async reviewSearchTool(
    params: ReviewSearchParameters,
  ): Promise<ReviewSearchResult[]> {
    const serperApiKey = this.configService.get<string>('SERPER_API_KEY');

    if (!serperApiKey) {
      this.logger.error(
        'SERPER_API_KEY is not set in the environment variables.',
      );
      throw new Error(
        'SERPER_API_KEY is not set in the environment variables.',
      );
    }

    const body = {
      placeId: params.placeId,
      gl: params.language,
      hl: params.language,
      autocorrect: false,
    };

    try {
      const headers = {
        'X-API-KEY': serperApiKey,
        'Content-Type': 'application/json',
      };

      const response = await firstValueFrom(
        this.httpService.post<SerperResponse>(this.apiUrl, body, { headers }),
      );

      if (!response.data.reviews) {
        this.logger.warn('No reviews found for the given place ID.');
        return [];
      }

      return response.data.reviews.map((result) => ({
        rating: result.rating,
        isoDate: result.isoDate,
        snippet: result.snippet,
      }));
    } catch (error) {
      this.logger.error(
        'Failed to perform review search:',
        error.response?.data || error.message,
      );
      return [];
    }
  }
}
