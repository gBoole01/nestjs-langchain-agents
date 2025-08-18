import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DiscordService } from 'src/integrations/discord/discord.service';
import { ArchivistAgentService } from './crew/archivist-agent.service';
import { CriticAgentService } from './crew/critic-agent.service';
import { DataAnalystAgentService } from './crew/data-analyst-agent.service';
import { JournalistAgentService } from './crew/journalist-agent.service';
import { WriterAgentService } from './crew/writer-agent.service';
import { AnalysisRequest } from './stock-analysis-agent.types';

@Injectable()
export class StockAnalysisAgentService implements OnModuleInit {
  private readonly logger = new Logger(StockAnalysisAgentService.name);

  constructor(
    private readonly dataAnalystAgent: DataAnalystAgentService,
    private readonly journalistAgent: JournalistAgentService,
    private readonly writerAgent: WriterAgentService,
    private readonly criticAgent: CriticAgentService,
    private readonly archivistAgent: ArchivistAgentService,
    private readonly discordService: DiscordService,
  ) {}

  async onModuleInit() {
    this.logger.log('Orchestrator Agent initialized');
  }

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

    try {
      this.logger.log(`Starting complete analysis for ${ticker}`);

      // Step 1: Call the Archivist to get a synthesized memory of past reports
      const archivistReport =
        await this.archivistAgent.getInformedOpinion(ticker);
      const request: AnalysisRequest = { ticker, date, archivistReport };
      this.logger.log(`Archivist provided report: ${archivistReport}`);

      // Step 2: Run data analysis and news analysis in parallel
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

      // Step 3: Generate final report and submit to Critic Agent
      let finalReport = '';
      let currentDraft = '';
      let critiqueVerdict: { verdict: 'PASS' | 'FAIL'; feedback?: string } = {
        verdict: 'FAIL',
      };
      let iterationCount = 0;
      const MAX_ITERATIONS = 5;

      while (
        critiqueVerdict.verdict === 'FAIL' &&
        iterationCount < MAX_ITERATIONS
      ) {
        iterationCount++;

        // Call the Writer Agent
        const writerResult = await this.writerAgent.writeReport(
          ticker,
          date,
          dataResult.data,
          newsResult.data,
          archivistReport,
          critiqueVerdict.feedback,
        );

        if (!writerResult.success) {
          throw new Error(`Report generation failed: ${writerResult.error}`);
        }
        const report = writerResult.data;
        this.logger.log(
          `Writer Agent produced draft (Iteration ${iterationCount}):\n${report}`,
        );

        // Call the Critic Agent to evaluate the report
        critiqueVerdict = await this.criticAgent.critiqueReport(
          report,
          dataResult.data,
          newsResult.data,
          archivistReport,
        );

        if (critiqueVerdict.verdict === 'PASS') {
          finalReport = report;
          this.logger.log(
            `Critic Agent passed the report after ${iterationCount} iterations.`,
          );
        } else {
          currentDraft = report;
          this.logger.warn(
            `Critic Agent failed the report. Feedback: ${critiqueVerdict.feedback}`,
          );
        }
      }

      // Step 4: Save the final report and return it
      if (critiqueVerdict.verdict === 'FAIL') {
        this.logger.warn(
          'Report failed to pass critique after max iterations, saving the final draft to memory.',
        );
        // Save the last draft, even if it failed the critique
        await this.archivistAgent.saveReport(ticker, currentDraft);
        return currentDraft;
      } else {
        // Save the successful report to the database
        await this.archivistAgent.saveReport(ticker, finalReport);
        return finalReport;
      }
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
