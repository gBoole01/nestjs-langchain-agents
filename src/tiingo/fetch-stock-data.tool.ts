import { tool } from '@langchain/core/tools';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { TiingoService } from './tiingo.service';

/**
 * Zod schema for the input of the FetchStockDataTool.
 */
const fetchStockDataSchema = z.object({
  ticker: z.string().describe('The stock ticker symbol (e.g., AAPL, GOOGL).'),
  startDate: z.string().describe('The start date in YYYY-MM-DD format.'),
  endDate: z.string().describe('The end date in YYYY-MM-DD format.'),
});

/**
 * Service that creates a stock data fetching tool using the modern tool() function.
 * This is the recommended approach in LangChain v0.2.7+.
 */
@Injectable()
export class FetchStockDataTool {
  constructor(private readonly tiingoService: TiingoService) {}

  getTool() {
    return tool(
      async (input) => {
        try {
          console.log('FetchStockDataTool called with input:', input);
          const { ticker, startDate, endDate } = input;

          // Validate date format (basic check)
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
            return JSON.stringify({
              error: 'Invalid date format. Please use YYYY-MM-DD format.',
              ticker,
              startDate,
              endDate,
            });
          }

          // Validate that startDate is before endDate
          if (new Date(startDate) > new Date(endDate)) {
            return JSON.stringify({
              error: 'Start date must be before end date.',
              ticker,
              startDate,
              endDate,
            });
          }

          const data = await this.tiingoService.fetchMarketData(
            ticker.toUpperCase(),
            startDate,
            endDate,
          );

          if (!data || data.length === 0) {
            return JSON.stringify({
              message: `No market data found for ticker ${ticker.toUpperCase()} between ${startDate} and ${endDate}. This could be due to weekends, holidays, or invalid ticker symbol.`,
              ticker: ticker.toUpperCase(),
              startDate,
              endDate,
              dataPoints: 0,
            });
          }

          // Return formatted data with summary
          const formattedData = {
            ticker: ticker.toUpperCase(),
            startDate,
            endDate,
            dataPoints: data.length,
            data: data.map((point) => ({
              date: point.date,
              open: Number((point.adjOpen || point.open)?.toFixed(2)),
              high: Number((point.adjHigh || point.high)?.toFixed(2)),
              low: Number((point.adjLow || point.low)?.toFixed(2)),
              close: Number((point.adjClose || point.close)?.toFixed(2)),
              volume: point.volume,
            })),
            summary: {
              firstDate: data[0]?.date,
              lastDate: data[data.length - 1]?.date,
              firstClose: Number(
                (data[0]?.adjClose || data[0]?.close)?.toFixed(2),
              ),
              lastClose: Number(
                (
                  data[data.length - 1]?.adjClose ||
                  data[data.length - 1]?.close
                )?.toFixed(2),
              ),
              priceChange:
                data.length > 1
                  ? Number(
                      (
                        (data[data.length - 1]?.adjClose ||
                          data[data.length - 1]?.close) -
                        (data[0]?.adjClose || data[0]?.close)
                      ).toFixed(2),
                    )
                  : 0,
              percentChange:
                data.length > 1
                  ? Number(
                      (
                        (((data[data.length - 1]?.adjClose ||
                          data[data.length - 1]?.close) -
                          (data[0]?.adjClose || data[0]?.close)) /
                          (data[0]?.adjClose || data[0]?.close)) *
                        100
                      ).toFixed(2),
                    )
                  : 0,
            },
          };

          return JSON.stringify(formattedData, null, 2);
        } catch (error) {
          return JSON.stringify({
            error: 'Failed to fetch market data',
            message: error.message,
            ticker: input.ticker,
            startDate: input.startDate,
            endDate: input.endDate,
          });
        }
      },
      {
        name: 'fetch_stock_market_data',
        description: `
          Fetch historical stock market data for a given ticker symbol.
          This tool retrieves daily market data including open, high, low, close prices and trading volume.
          It also provides summary statistics including price changes and percentage changes over the period.
          
          Use this tool when users ask for:
          - Stock prices for specific dates or date ranges
          - Historical market data and trends
          - Price changes and performance analysis
          - Trading volume information
          
          The tool returns formatted JSON data with detailed market information and summary statistics.
        `.trim(),
        schema: fetchStockDataSchema,
      },
    );
  }
}
