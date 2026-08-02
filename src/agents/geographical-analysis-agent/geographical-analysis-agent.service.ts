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

const FRESHNESS_WINDOW_MONTHS = 3;

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
      rawData: Annotation<string>(),
      historicalContext: Annotation<string>(),
      finalReport: Annotation<string>(),
    });

    this.workflow = new StateGraph(GeographicalAnalysisState)
      .addNode('fetch_new_data', async (state) => {
        this.logger.log(
          `Step 1: Calling Research Team for fresh data on "${state.region}"...`,
        );
        const rawData = await this.researchTeam.runQuery(
          `Latest economic outlook, growth, inflation, trade and geopolitical risk for region: ${state.region}`,
        );
        return { rawData: rawData };
      })

      .addNode('process_data', async (state) => {
        this.logger.log(
          'Step 2: Storing new data and retrieving historical context...',
        );
        await this.archivist.storeRawData(state.region, state.rawData);
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
            `You are a highly skilled regional economist. Your task is to write a comprehensive economic outlook report for the region: {region}.
             Use the following new data and historical context to inform your analysis.
             New Data: {raw_data}
             Historical Context: {historical_context}`,
          ],
          [
            'human',
            'Please write a well-structured and insightful economic outlook report for {region}.',
          ],
        ]);
        const chain = prompt.pipe(this.model);
        const finalReport = await chain.invoke({
          region: state.region,
          raw_data: state.rawData,
          historical_context: state.historicalContext,
        });
        return { finalReport: finalReport.content };
      })

      .addNode('archive_final_report', async (state) => {
        this.logger.log('Step 4: Archiving the final report...');
        await this.archivist.storeFinalReport(state.region, state.finalReport);
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
   * within the last 3 months. Also true while a full "run all regions"
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
    return this.broaderReportsService.hasReportWithinWindow(
      'geographical',
      FRESHNESS_WINDOW_MONTHS,
      region,
    );
  }

  /**
   * Runs the full geographical analysis workflow (research -> critique loop ->
   * synthesize -> archive) for a single monitored region.
   */
  async runAnalysis(region: string): Promise<string> {
    this.logger.log(`Running geographical analysis for region: ${region}`);
    const result = await this.workflow.invoke({ region });
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
          `Skipping ${region}: analysis already fresh within the last ${FRESHNESS_WINDOW_MONTHS} months.`,
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
}
