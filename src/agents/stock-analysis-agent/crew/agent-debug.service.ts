import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SerperNewsTool } from 'src/tools/serper/serper-news.tool';
import { SerperWebTool } from 'src/tools/serper/serper-web.tool';
import { FetchStockDataTool } from 'src/tools/tiingo/fetch-stock-data.tool';

@Injectable()
export class AgentDebugService implements OnModuleInit {
  private readonly logger = new Logger(AgentDebugService.name);

  constructor(
    private readonly fetchStockDataTool: FetchStockDataTool,
    private readonly serperNewsTool: SerperNewsTool,
    private readonly serperWebTool: SerperWebTool,
  ) {}

  onModuleInit() {
    this.logger.log('Agent Debug Service initialized');
  }

  /**
   * Test individual tools to ensure they're working
   */
  async testTools(ticker: string): Promise<void> {
    this.logger.log(`Testing tools for ticker: ${ticker}`);

    // Test stock data tool
    try {
      this.logger.log('Testing FetchStockDataTool...');
      const stockTool = this.fetchStockDataTool.getTool();
      const stockResult = await stockTool.invoke({
        ticker: ticker,
        startDate: '2025-01-01',
        endDate: '2025-01-02',
      });
      this.logger.log(
        `Stock data result: ${JSON.stringify(stockResult, null, 2)}`,
      );
    } catch (error) {
      this.logger.error(`Stock data tool failed: ${error.message}`);
    }

    // Test news search tool
    try {
      this.logger.log('Testing SerperNewsTool...');
      const newsTool = this.serperNewsTool.getTool();
      const newsResult = await newsTool.invoke({
        query: `${ticker} stock news earnings`,
      });
      this.logger.log(
        `News search result: ${JSON.stringify(newsResult, null, 2)}`,
      );
    } catch (error) {
      this.logger.error(`News search tool failed: ${error.message}`);
    }

    // Test web search tool
    try {
      this.logger.log('Testing SerperWebTool...');
      const webTool = this.serperWebTool.getTool();
      const webResult = await webTool.invoke({
        query: `${ticker} stock price today`,
      });
      this.logger.log(
        `Web search result: ${JSON.stringify(webResult, null, 2)}`,
      );
    } catch (error) {
      this.logger.error(`Web search tool failed: ${error.message}`);
    }
  }
}
