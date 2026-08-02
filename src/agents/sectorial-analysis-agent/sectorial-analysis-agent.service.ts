import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { Annotation, END, StateGraph } from '@langchain/langgraph';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { BroaderReportsService } from 'src/agents/broader-analysis/broader-reports.service';
import { geminiOnFailedAttempt } from 'src/common/llm/gemini-rate-limit-retry.util';
import { AnalysisRunsService } from 'src/runs/analysis-runs.service';
import { ArchivistService } from './crew/archivist.service';
import { ResearchOrchestratorService } from './crew/research-orchestrator.service';
import {
  addPeriods,
  enumeratePeriods,
  getCurrentPeriod,
  getPeriodLabel,
} from 'src/agents/broader-analysis/period.util';

const FRESHNESS_WINDOW_MONTHS = 3;
const BACKFILL_LOOKBACK_PERIODS = 8;

/**
 * This agent will run for each monitored activity sector.
 * Then it will store the results in a database.
 * He will also expose its results to other agents.
 * TIMEFRAME: re-run at most once every 3 months per sector (see hasFreshReport).
 */
@Injectable()
export class SectorialAnalysisAgentService implements OnModuleInit {
  private readonly logger = new Logger(SectorialAnalysisAgentService.name);
  private workflow;
  private model: ChatGoogleGenerativeAI;

  constructor(
    private readonly configService: ConfigService,
    private readonly researchTeam: ResearchOrchestratorService,
    private readonly archivist: ArchivistService,
    private readonly broaderReportsService: BroaderReportsService,
    private readonly analysisRunsService: AnalysisRunsService,
  ) {}

  async onModuleInit() {
    const googleApiKey = this.configService.get<string>('GEMINI_API_KEY');
    const geminiModel = this.configService.get<string>('GEMINI_MODEL');
    if (!googleApiKey) {
      this.logger.error('GEMINI_API_KEY is not set');
      return;
    }

    this.model = new ChatGoogleGenerativeAI({
      apiKey: googleApiKey,
      model: geminiModel,
      temperature: 0.1,
      maxOutputTokens: 8192,
      maxRetries: 8,
      onFailedAttempt: geminiOnFailedAttempt,
    });
    this.initializeWorkflow();
    this.logger.log('Sectorial Analysis Agent initialized with LangGraph');
  }

  private initializeWorkflow() {
    const SectorialAnalysisState = Annotation.Root({
      sector: Annotation<string>(),
      period: Annotation<string>(),
      rawData: Annotation<string>(),
      historicalContext: Annotation<string>(),
      finalReport: Annotation<string>(),
    });

    this.workflow = new StateGraph(SectorialAnalysisState)
      .addNode('fetch_new_data', async (state) => {
        this.logger.log(
          `Step 1: Calling Research Team for data on "${state.sector}" for ${state.period}...`,
        );
        const rawData = await this.researchTeam.runQuery(
          `Industry outlook, demand trends, competitive landscape and regulation for sector: ${state.sector}, for ${getPeriodLabel(state.period)}`,
        );
        return { rawData: rawData };
      })

      .addNode('process_data', async (state) => {
        this.logger.log(
          'Step 2: Storing new data and retrieving historical context...',
        );
        await this.archivist.storeRawData(
          state.sector,
          state.rawData,
          state.period,
        );
        const historicalContext = await this.archivist.retrieveData(
          state.sector,
        );
        return { historicalContext: historicalContext };
      })

      .addNode('synthesize_report', async (state) => {
        this.logger.log('Step 3: Synthesizing the final report...');
        const prompt = ChatPromptTemplate.fromMessages([
          [
            'system',
            `You are a highly skilled sector/industry analyst. Your task is to write a comprehensive outlook report for the sector: {sector}, for the period {period_label}.
             Use the following new data and historical context to inform your analysis.
             If this period is not the current one, frame the report as a retrospective analysis of that period rather than a forward-looking outlook.
             New Data: {raw_data}
             Historical Context: {historical_context}`,
          ],
          [
            'human',
            'Please write a well-structured and insightful sector outlook report for {sector} for {period_label}.',
          ],
        ]);
        const chain = prompt.pipe(this.model);
        const finalReport = await chain.invoke({
          sector: state.sector,
          period_label: getPeriodLabel(state.period),
          raw_data: state.rawData,
          historical_context: state.historicalContext,
        });
        return { finalReport: finalReport.content };
      })

      .addNode('archive_final_report', async (state) => {
        this.logger.log('Step 4: Archiving the final report...');
        await this.archivist.storeFinalReport(
          state.sector,
          state.finalReport,
          state.period,
        );
        return {};
      })

      .addEdge('__start__', 'fetch_new_data')
      .addEdge('fetch_new_data', 'process_data')
      .addEdge('process_data', 'synthesize_report')
      .addEdge('synthesize_report', 'archive_final_report')
      .addEdge('archive_final_report', END)

      .compile();
  }

  /**
   * True if the given sector already has a report (or a run in progress)
   * within the last 3 months. Also true while a full "run all sectors"
   * sweep is in progress, since it may currently be processing this sector.
   */
  async hasFreshReport(sector: string): Promise<boolean> {
    if (
      this.analysisRunsService.hasPendingRun('sector-analysis-all') ||
      this.analysisRunsService.hasPendingRun(
        'sector-analysis',
        (input) => input.sector === sector,
      )
    ) {
      return true;
    }
    return this.broaderReportsService.hasReportWithinWindow(
      'sectorial',
      FRESHNESS_WINDOW_MONTHS,
      sector,
    );
  }

  /**
   * Runs the full sectorial analysis workflow (research -> critique loop ->
   * synthesize -> archive) for a single monitored sector and quarter period
   * (defaults to the current one).
   */
  async runAnalysis(
    sector: string,
    period: string = getCurrentPeriod('quarter'),
  ): Promise<string> {
    this.logger.log(
      `Running sectorial analysis for sector: ${sector}, period: ${period}`,
    );
    const result = await this.workflow.invoke({ sector, period });
    this.logger.log('Sectorial analysis complete.');
    return result.finalReport || 'No report generated.';
  }

  /**
   * Lists every sector monitored via data/sectors.json.
   */
  listSectors(): { sector: string }[] {
    const filePath = join(__dirname, '..', '..', '..', 'data', 'sectors.json');
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  }

  /**
   * Runs the full workflow for every sector listed in data/sectors.json.
   */
  async runAnalysisForAllSectors(): Promise<void> {
    const sectors = this.listSectors();
    for (const { sector } of sectors) {
      if (await this.hasFreshReport(sector)) {
        this.logger.log(
          `Skipping ${sector}: analysis already fresh within the last ${FRESHNESS_WINDOW_MONTHS} months.`,
        );
        continue;
      }
      await this.runAnalysis(sector);
    }
  }

  /**
   * Cheap, read-only retrieval of the most relevant archived reports for a
   * sector, without re-running the full research/critique/synthesis pipeline.
   * Used by other agents (e.g. the daily stock analysis graph) that need
   * sector context but must not trigger the monthly research workflow.
   */
  async getContext(sector: string): Promise<string> {
    return this.archivist.retrieveData(sector);
  }

  /**
   * Generates the missing sectorial analysis reports for past quarters
   * across the given (or all monitored) sectors, so stock analysis has
   * historical sector context to draw on. Defaults to the 8 quarters
   * (~2 years) before the current one, skipping any sector/period that
   * already has a report.
   */
  async backfillAllSectors(
    from?: string,
    to?: string,
    sectors?: string[],
  ): Promise<{ ranPeriods: string[]; skippedPeriods: string[] }> {
    const targetSectors = sectors?.length
      ? sectors
      : this.listSectors().map((s) => s.sector);
    const resolvedTo = to ?? addPeriods(getCurrentPeriod('quarter'), -1);
    const resolvedFrom =
      from ?? addPeriods(resolvedTo, -(BACKFILL_LOOKBACK_PERIODS - 1));
    const periods = enumeratePeriods(resolvedFrom, resolvedTo);

    const ranPeriods: string[] = [];
    const skippedPeriods: string[] = [];
    for (const sector of targetSectors) {
      for (const period of periods) {
        if (
          await this.broaderReportsService.hasReportForPeriod(
            'sectorial',
            sector,
            period,
          )
        ) {
          this.logger.log(
            `Skipping ${sector}/${period}: report already exists.`,
          );
          skippedPeriods.push(`${sector}:${period}`);
          continue;
        }
        await this.runAnalysis(sector, period);
        ranPeriods.push(`${sector}:${period}`);
      }
    }
    return { ranPeriods, skippedPeriods };
  }
}
