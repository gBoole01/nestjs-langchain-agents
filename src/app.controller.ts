import { Controller, Get } from '@nestjs/common';
import { StockAnalysisAgentService } from './agents/stock-analysis-agent/stock-analysis-agent.service';

@Controller()
export class AppController {
  constructor(
    private readonly stockAnalysisAgentService: StockAnalysisAgentService,
  ) {}

  @Get()
  async runAnalysis(): Promise<void> {
    // const tickers = ['PLTR']; // Consume less API calls in development
    const tickers = ['PLTR', 'NVDA', 'TSLA'];
    await this.stockAnalysisAgentService.runAnalysisForTickers(tickers);
  }
}
