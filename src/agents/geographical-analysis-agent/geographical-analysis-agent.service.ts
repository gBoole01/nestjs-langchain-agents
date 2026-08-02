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
  getPeriodBounds,
  getPeriodLabel,
} from 'src/agents/broader-analysis/period.util';

// 5 years of quarters, aligned with standard economic cycle analysis.
const BACKFILL_LOOKBACK_PERIODS = 20;

/**
 * This agent will run for each monitored geographical area.
 * Then it will store the results in a database.
 * He will also expose its results to other agents.
 * TIMEFRAME: re-run at most once every 3 months per region (see hasFreshReport).
 */
@Injectable()
export class GeographicalAnalysisAgentService implements OnModuleInit {
  private readonly logger = new Logger(GeographicalAnalysisAgentService.name);
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
    this.logger.log('Geographical Analysis Agent initialized with LangGraph');
  }

  private initializeWorkflow() {
    const GeographicalAnalysisState = Annotation.Root({
      region: Annotation<string>(),
      period: Annotation<string>(),
      rawData: Annotation<string>(),
      historicalContext: Annotation<string>(),
      finalReport: Annotation<string>(),
    });

    this.workflow = new StateGraph(GeographicalAnalysisState)
      .addNode('fetch_new_data', async (state) => {
        this.logger.log(
          `Step 1: Calling Research Team for data on "${state.region}" for ${state.period}...`,
        );
        const rawData = await this.researchTeam.runQuery(
          `Economic outlook, growth, inflation, trade and geopolitical risk for region: ${state.region}, for ${getPeriodLabel(state.period)}`,
        );
        return { rawData: rawData };
      })

      .addNode('process_data', async (state) => {
        this.logger.log(
          'Step 2: Storing new data and retrieving historical context...',
        );
        await this.archivist.storeRawData(
          state.region,
          state.rawData,
          state.period,
        );
        const historicalContext = await this.archivist.retrieveData(
          state.region,
        );
        return { historicalContext: historicalContext };
      })

      .addNode('synthesize_report', async (state) => {
        this.logger.log('Step 3: Synthesizing the final report...');
        const prompt = ChatPromptTemplate.fromMessages([
          [
            'system',
            `You are a highly skilled regional economist. Your task is to write a comprehensive economic outlook report for the region: {region}, for the period {period_label}.
             Use the following new data and historical context to inform your analysis.
             If this period is not the current one, frame the report as a retrospective analysis of that period rather than a forward-looking outlook.
             New Data: {raw_data}
             Historical Context: {historical_context}`,
          ],
          [
            'human',
            'Please write a well-structured and insightful economic outlook report for {region} for {period_label}.',
          ],
        ]);
        const chain = prompt.pipe(this.model);
        const finalReport = await chain.invoke({
          region: state.region,
          period_label: getPeriodLabel(state.period),
          raw_data: state.rawData,
          historical_context: state.historicalContext,
        });
        return { finalReport: finalReport.content };
      })

      .addNode('archive_final_report', async (state) => {
        this.logger.log('Step 4: Archiving the final report...');
        await this.archivist.storeFinalReport(
          state.region,
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
   * True if the given region already has a report (or a run in progress)
   * for the current quarter. Also true while a full "run all regions"
   * sweep is in progress, since it may currently be processing this region.
   */
  async hasFreshReport(region: string): Promise<boolean> {
    if (
      this.analysisRunsService.hasPendingRun('geo-analysis-all') ||
      this.analysisRunsService.hasPendingRun(
        'geo-analysis',
        (input) => input.region === region,
      )
    ) {
      return true;
    }
    const cutoff = getPeriodBounds(getCurrentPeriod('quarter')).start;
    return this.broaderReportsService.hasReportWithinWindow(
      'geographical',
      cutoff,
      region,
    );
  }

  /**
   * Runs the full geographical analysis workflow (research -> critique loop ->
   * synthesize -> archive) for a single monitored region and quarter period
   * (defaults to the current one).
   */
  async runAnalysis(
    region: string,
    period: string = getCurrentPeriod('quarter'),
  ): Promise<string> {
    this.logger.log(
      `Running geographical analysis for region: ${region}, period: ${period}`,
    );
    const result = await this.workflow.invoke({ region, period });
    this.logger.log('Geographical analysis complete.');
    return result.finalReport || 'No report generated.';
  }

  /**
   * Lists every region monitored via data/geographies.json.
   */
  listRegions(): { region: string }[] {
    const filePath = join(
      __dirname,
      '..',
      '..',
      '..',
      'data',
      'geographies.json',
    );
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  }

  /**
   * Runs the full workflow for every region listed in data/geographies.json.
   */
  async runAnalysisForAllRegions(): Promise<void> {
    const geographies = this.listRegions();
    for (const { region } of geographies) {
      if (await this.hasFreshReport(region)) {
        this.logger.log(
          `Skipping ${region}: analysis already fresh for the current quarter.`,
        );
        continue;
      }
      await this.runAnalysis(region);
    }
  }

  /**
   * Cheap, read-only retrieval of the most relevant archived reports for a
   * region, without re-running the full research/critique/synthesis pipeline.
   * Used by other agents (e.g. the daily stock analysis graph) that need
   * geographical context but must not trigger the monthly research workflow.
   */
  async getContext(region: string): Promise<string> {
    return this.archivist.retrieveData(region);
  }

  /**
   * Default quarter range covered by a backfill/missing-periods check: the
   * 20 quarters (5 years) before the current one.
   */
  private defaultBackfillRange(): { from: string; to: string } {
    const to = addPeriods(getCurrentPeriod('quarter'), -1);
    const from = addPeriods(to, -(BACKFILL_LOOKBACK_PERIODS - 1));
    return { from, to };
  }

  /**
   * Lists the quarters within the default backfill window that don't have a
   * report yet for the given region, so the frontend can offer them for
   * selection instead of requiring the user to type period labels by hand.
   */
  async getMissingPeriods(region: string): Promise<string[]> {
    const { from, to } = this.defaultBackfillRange();
    const periods = enumeratePeriods(from, to);
    const missing: string[] = [];
    for (const period of periods) {
      const exists = await this.broaderReportsService.hasReportForPeriod(
        'geographical',
        region,
        period,
      );
      if (!exists) {
        missing.push(period);
      }
    }
    return missing;
  }

  /**
   * Generates the missing geographical analysis reports for past quarters
   * across the given (or all monitored) regions, so stock analysis has
   * historical regional context to draw on. When `periods` is given, runs
   * exactly those periods for each targeted region; otherwise defaults to
   * the 20 quarters (5 years) before the current one (or the given
   * `from`/`to` range). Skips any region/period that already has a report.
   */
  async backfillAllRegions(
    from?: string,
    to?: string,
    regions?: string[],
    periods?: string[],
  ): Promise<{ ranPeriods: string[]; skippedPeriods: string[] }> {
    const targetRegions = regions?.length
      ? regions
      : this.listRegions().map((r) => r.region);

    let targetPeriods: string[];
    if (periods?.length) {
      targetPeriods = periods;
    } else {
      const resolvedTo = to ?? addPeriods(getCurrentPeriod('quarter'), -1);
      const resolvedFrom =
        from ?? addPeriods(resolvedTo, -(BACKFILL_LOOKBACK_PERIODS - 1));
      targetPeriods = enumeratePeriods(resolvedFrom, resolvedTo);
    }

    const ranPeriods: string[] = [];
    const skippedPeriods: string[] = [];
    for (const region of targetRegions) {
      for (const period of targetPeriods) {
        if (
          await this.broaderReportsService.hasReportForPeriod(
            'geographical',
            region,
            period,
          )
        ) {
          this.logger.log(
            `Skipping ${region}/${period}: report already exists.`,
          );
          skippedPeriods.push(`${region}:${period}`);
          continue;
        }
        await this.runAnalysis(region, period);
        ranPeriods.push(`${region}:${period}`);
      }
    }
    return { ranPeriods, skippedPeriods };
  }
}
