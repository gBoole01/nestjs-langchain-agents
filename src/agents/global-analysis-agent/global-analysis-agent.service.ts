import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { Annotation, END, StateGraph } from '@langchain/langgraph';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

const GLOBAL_ANALYSIS_SUBJECT = 'global economic outlook';
const FRESHNESS_WINDOW_MONTHS = 6;
const BACKFILL_LOOKBACK_PERIODS = 8;

@Injectable()
export class GlobalAnalysisAgentService implements OnModuleInit {
  private readonly logger = new Logger(GlobalAnalysisAgentService.name);
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
    this.logger.log('Global Analyst Service initialized with LangGraph');
  }

  private initializeWorkflow() {
    // Define the state schema using Annotation.Root
    const GlobalAnalysisState = Annotation.Root({
      period: Annotation<string>(),
      rawData: Annotation<string>(),
      historicalContext: Annotation<string>(),
      finalReport: Annotation<string>(),
    });

    // The entire workflow is built in a single, chained sequence
    this.workflow = new StateGraph(GlobalAnalysisState)
      // Node 1: Call the Research Team to fetch new data
      .addNode('fetch_new_data', async (state) => {
        this.logger.log(
          `Step 1: Calling Research Team for data on ${state.period}...`,
        );
        const rawData = await this.researchTeam.runQuery(
          `${GLOBAL_ANALYSIS_SUBJECT} for ${getPeriodLabel(state.period)}`,
        );
        return { rawData: rawData };
      })

      // Node 2: Store the fetched raw data and retrieve historical context
      .addNode('process_data', async (state) => {
        this.logger.log(
          'Step 2: Storing new data and retrieving historical context...',
        );
        await this.archivist.storeRawData(state.rawData, state.period);
        const historicalContext = await this.archivist.retrieveData(
          GLOBAL_ANALYSIS_SUBJECT,
        );
        return { historicalContext: historicalContext };
      })

      // Node 3: Synthesize the final report using all data
      .addNode('synthesize_report', async (state) => {
        this.logger.log('Step 3: Synthesizing the final report...');
        const prompt = ChatPromptTemplate.fromMessages([
          [
            'system',
            `You are a highly skilled macroeconomic analyst. Your task is to write a comprehensive global economic report for the period {period_label}.
             Use the following new data and historical context to inform your analysis.
             If this period is not the current one, frame the report as a retrospective analysis of that period rather than a forward-looking outlook.
             New Data: {raw_data}
             Historical Context: {historical_context}`,
          ],
          [
            'human',
            'Please write a well-structured and insightful global economic outlook report for {period_label}.',
          ],
        ]);
        const chain = prompt.pipe(this.model);
        const finalReport = await chain.invoke({
          period_label: getPeriodLabel(state.period),
          raw_data: state.rawData,
          historical_context: state.historicalContext,
        });
        return { finalReport: finalReport.content };
      })

      // Node 4: Archive the final report
      .addNode('archive_final_report', async (state) => {
        this.logger.log('Step 4: Archiving the final report...');
        await this.archivist.storeFinalReport(
          GLOBAL_ANALYSIS_SUBJECT,
          state.finalReport,
          state.period,
        );
        return {};
      })

      // Define the graph's edges (the flow)
      .addEdge('__start__', 'fetch_new_data')
      .addEdge('fetch_new_data', 'process_data')
      .addEdge('process_data', 'synthesize_report')
      .addEdge('synthesize_report', 'archive_final_report')
      .addEdge('archive_final_report', END)

      // Compile the final graph
      .compile();
  }
  /**
   * True if the global analysis has already run (or is currently running)
   * within the last 6 months.
   */
  async hasFreshReport(): Promise<boolean> {
    if (this.analysisRunsService.hasPendingRun('global-analysis')) {
      return true;
    }
    return this.broaderReportsService.hasReportWithinWindow(
      'global',
      FRESHNESS_WINDOW_MONTHS,
    );
  }

  /**
   * Runs the entire global analysis workflow against the broad world
   * economic situation, for the given semester period (defaults to the
   * current one). Unlike the geographical/sectorial agents, there is only
   * one global subject to analyze.
   * TIMEFRAME: re-run at most once every 6 months (see hasFreshReport).
   */
  async runAnalysis(
    period: string = getCurrentPeriod('semester'),
  ): Promise<string> {
    this.logger.log(`Running global analysis for ${period}...`);
    const result = await this.workflow.invoke({ period });
    this.logger.log('Global analysis complete.');
    return result.finalReport || 'No report generated.';
  }

  /**
   * Generates the missing global analysis reports for past semesters, so
   * stock analysis has historical macro context to draw on. Defaults to the
   * 8 semesters (~5 years) before the current one, skipping any period that
   * already has a report.
   */
  async backfill(
    from?: string,
    to?: string,
  ): Promise<{ ranPeriods: string[]; skippedPeriods: string[] }> {
    const resolvedTo = to ?? addPeriods(getCurrentPeriod('semester'), -1);
    const resolvedFrom =
      from ?? addPeriods(resolvedTo, -(BACKFILL_LOOKBACK_PERIODS - 1));
    const periods = enumeratePeriods(resolvedFrom, resolvedTo);

    const ranPeriods: string[] = [];
    const skippedPeriods: string[] = [];
    for (const period of periods) {
      if (
        await this.broaderReportsService.hasReportForPeriod(
          'global',
          GLOBAL_ANALYSIS_SUBJECT,
          period,
        )
      ) {
        this.logger.log(`Skipping ${period}: report already exists.`);
        skippedPeriods.push(period);
        continue;
      }
      await this.runAnalysis(period);
      ranPeriods.push(period);
    }
    return { ranPeriods, skippedPeriods };
  }

  /**
   * Cheap, read-only retrieval of the most relevant archived global economic
   * reports, without re-running the full research/critique/synthesis
   * pipeline. Used by other agents (e.g. the daily stock analysis graph)
   * that need macro context but must not trigger a fresh global analysis run.
   */
  async getContext(query: string): Promise<string> {
    return this.archivist.retrieveData(query);
  }
}
