import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DiscordService } from 'src/integrations/discord/discord.service';
import { DataAnalystAgentService } from './data-analyst-agent.service';
import { JournalistAgentService } from './journalist-agent.service';
import { AnalysisRequest } from './stock-analysis-agent.types';
import { WriterAgentService } from './writer-agent.service';

@Injectable()
export class StockAnalysisAgentService implements OnModuleInit {
  private readonly logger = new Logger(StockAnalysisAgentService.name);
  private readonly tickers = ['PLTR', 'NVDA', 'TSLA'];

  constructor(
    private readonly dataAnalystAgent: DataAnalystAgentService,
    private readonly journalistAgent: JournalistAgentService,
    private readonly writerAgent: WriterAgentService,
    private readonly discordService: DiscordService,
  ) {}

  async onModuleInit() {
    this.logger.log('Orchestrator Agent initialized');

    await this.runAnalysisForTickers(this.tickers);
  }

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async runAnalysisForTickers(tickers: string[]) {
    for (const ticker of tickers) {
      await this.runAgent(ticker);
    }
  }

  async runAgent(ticker: string): Promise<void> {
    try {
      this.logger.log('Testing agent with sample query...');

      const result = await this.runCompleteAnalysis(ticker);
      if (typeof result === 'string') {
        await this.discordService.sendToDiscord(result);

        this.logger.log('Agent test completed successfully');
      } else {
        throw new Error(
          `Wrong response type : ${JSON.stringify(result, null, 2)}`,
        );
      }
    } catch (error) {
      this.logger.error('Agent test failed:', error.message);
      await this.discordService.sendToDiscord(
        `❌ **Agent Test Failed**\n\nError: ${error.message}`,
      );
    }
  }

  async runCompleteAnalysis(ticker: string): Promise<string> {
    const date = new Date().toISOString().split('T')[0];
    const request: AnalysisRequest = { ticker, date };

    try {
      this.logger.log(`Starting complete analysis for ${ticker}`);

      // Step 1: Run data analysis and news analysis in parallel
      const [dataResult, newsResult] = await Promise.all([
        this.dataAnalystAgent.analyzeData(request),
        this.journalistAgent.analyzeNews(request),
      ]);

      // Check if both analyses succeeded
      if (!dataResult.success) {
        throw new Error(`Data analysis failed: ${dataResult.error}`);
      }
      if (!newsResult.success) {
        throw new Error(`News analysis failed: ${newsResult.error}`);
      }

      this.logger.log('Data and news analysis completed successfully');

      // Step 2: Generate final report
      const reportResult = await this.writerAgent.writeReport(
        ticker,
        date,
        dataResult.data,
        newsResult.data,
      );

      if (!reportResult.success) {
        throw new Error(`Report generation failed: ${reportResult.error}`);
      }

      this.logger.log('Complete analysis finished successfully');

      // Send to Discord if available
      await this.discordService.sendToDiscord(
        `📊 **Multi-Agent Analysis Complete**\n\n**Ticker:** ${ticker}\n\n${reportResult.data}`,
      );

      return reportResult.data;
    } catch (error) {
      this.logger.error('Complete analysis failed:', error.message);

      await this.discordService.sendToDiscord(
        `❌ **Multi-Agent Analysis Failed**\n\n**Ticker:** ${ticker}\n**Error:** ${error.message}`,
      );

      return `Analysis failed: ${error.message}`;
    }
  }

  async getSystemStatus(): Promise<Record<string, any>> {
    return {
      orchestrator: { status: 'ready' },
      dataAnalyst: { status: 'ready' },
      journalist: { status: 'ready' },
      writer: { status: 'ready' },
      timestamp: new Date().toISOString(),
    };
  }
}
