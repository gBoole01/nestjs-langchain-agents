import { Controller, Get } from '@nestjs/common';
// import { StockAnalysisAgentService } from './agents/stock-analysis-agent/stock-analysis-agent.service';
import { GlobalAnalysisAgentService } from './agents/global-analysis-agent/global-analysis-agent.service';

@Controller()
export class AppController {
  constructor(
    private readonly globalAnalysisAgentService: GlobalAnalysisAgentService,
    // private readonly stockAnalysisAgentGraphService: StockAnalysisAgentGraphService,
  ) {}

  @Get()
  async runAnalysis(): Promise<void> {
    await this.globalAnalysisAgentService.runAnalysis(
      'global economic outlook for 2025 Q1',
    );

    // const tickers = ['NVDA']; // Consume less API calls in development
    // // const tickers = ['PLTR', 'NVDA', 'TSLA'];
    // // This is the procedural way to run the analysis
    // // await this.stockAnalysisAgentService.runAnalysisForTickers(tickers);
    // // This is the declarative way to run the analysis
    // await this.stockAnalysisAgentGraphService.runAnalysisForTickers(tickers);
  }
}
