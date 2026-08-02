import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { Annotation, END, StateGraph } from '@langchain/langgraph';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { BroaderReportsService } from 'src/agents/broader-analysis/broader-reports.service';
import {
  broaderReportSchema,
  BroaderReportSections,
} from 'src/agents/broader-analysis/broader-report.types';
import { renderBroaderReportMarkdown } from 'src/agents/broader-analysis/broader-report.util';
import { geminiOnFailedAttempt } from 'src/common/llm/gemini-rate-limit-retry.util';
import { AnalysisRunsService } from 'src/runs/analysis-runs.service';
import { ArchivistService } from './crew/archivist.service';
import { ResearchOrchestratorService } from './crew/research-orchestrator.service';
import {
  addPeriods,
  Cadence,
  enumeratePeriods,
  getCurrentPeriod,
  getPeriodBounds,
  getPeriodLabel,
  periodsPerYear,
} from 'src/agents/broader-analysis/period.util';

interface SectorGroupConfig {
  group: string;
  frequency: Cadence;
  backfillYears: number;
  sectors: string[];
}

interface SectorInfo {
  sector: string;
  group: string;
  frequency: Cadence;
  backfillYears: number;
}

/**
 * This agent will run for each monitored activity sector.
 * Then it will store the results in a database.
 * He will also expose its results to other agents.
 * TIMEFRAME: each sector group re-runs at most once per its own cadence
 * (monthly/quarterly/weekly, see data/sectors.json and hasFreshReport).
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
      finalReport: Annotation<BroaderReportSections>(),
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
        const chain = prompt.pipe(
          this.model.withStructuredOutput(broaderReportSchema),
        );
        const finalReport = await chain.invoke({
          sector: state.sector,
          period_label: getPeriodLabel(state.period),
          raw_data: state.rawData,
          historical_context: state.historicalContext,
        });
        return { finalReport };
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
   * Lists every sector group monitored via data/sectors.json, along with its
   * cadence (frequency) and backfill depth (backfillYears).
   */
  listSectorGroups(): SectorGroupConfig[] {
    const filePath = join(__dirname, '..', '..', '..', 'data', 'sectors.json');
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  }

  /**
   * Flattens data/sectors.json into one entry per monitored sector, each
   * carrying the cadence/backfill settings of its group.
   */
  listSectors(): SectorInfo[] {
    return this.listSectorGroups().flatMap((group) =>
      group.sectors.map((sector) => ({
        sector,
        group: group.group,
        frequency: group.frequency,
        backfillYears: group.backfillYears,
      })),
    );
  }

  private getSectorConfig(sector: string): SectorInfo {
    const found = this.listSectors().find((s) => s.sector === sector);
    if (!found) {
      throw new NotFoundException(`Unknown sector: ${sector}`);
    }
    return found;
  }

  /**
   * True if the given sector already has a report (or a run in progress)
   * for its current reporting period (cadence depends on the sector's
   * group, see data/sectors.json). Also true while a full "run all sectors"
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
    const { frequency } = this.getSectorConfig(sector);
    const cutoff = getPeriodBounds(getCurrentPeriod(frequency)).start;
    return this.broaderReportsService.hasReportWithinWindow(
      'sectorial',
      cutoff,
      sector,
    );
  }

  /**
   * Runs the full sectorial analysis workflow (research -> critique loop ->
   * synthesize -> archive) for a single monitored sector and period
   * (defaults to the current period for that sector's own cadence).
   */
  async runAnalysis(sector: string, period?: string): Promise<string> {
    const resolvedPeriod =
      period ?? getCurrentPeriod(this.getSectorConfig(sector).frequency);
    this.logger.log(
      `Running sectorial analysis for sector: ${sector}, period: ${resolvedPeriod}`,
    );
    const result = await this.workflow.invoke({
      sector,
      period: resolvedPeriod,
    });
    this.logger.log('Sectorial analysis complete.');
    return result.finalReport
      ? renderBroaderReportMarkdown(
          sector,
          getPeriodLabel(resolvedPeriod),
          result.finalReport,
        )
      : 'No report generated.';
  }

  /**
   * Runs the full workflow for every sector listed in data/sectors.json.
   */
  async runAnalysisForAllSectors(): Promise<void> {
    const sectors = this.listSectors();
    for (const { sector, frequency } of sectors) {
      if (await this.hasFreshReport(sector)) {
        this.logger.log(
          `Skipping ${sector}: analysis already fresh for the current ${frequency}.`,
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
   * sector context but must not trigger the research workflow.
   */
  async getContext(sector: string): Promise<string> {
    return this.archivist.retrieveData(sector);
  }

  /**
   * Default backfill range for a sector, derived from its own cadence and
   * backfillYears (see data/sectors.json).
   */
  private defaultBackfillRange(sector: string): { from: string; to: string } {
    const { frequency, backfillYears } = this.getSectorConfig(sector);
    const lookbackPeriods = backfillYears * periodsPerYear(frequency);
    const to = addPeriods(getCurrentPeriod(frequency), -1);
    const from = addPeriods(to, -(lookbackPeriods - 1));
    return { from, to };
  }

  /**
   * Lists the periods (in the sector's own cadence) within its default
   * backfill window that don't have a report yet, so the frontend can offer
   * them for selection instead of requiring the user to type period labels
   * by hand.
   */
  async getMissingPeriods(sector: string): Promise<string[]> {
    const { from, to } = this.defaultBackfillRange(sector);
    const periods = enumeratePeriods(from, to);
    const missing: string[] = [];
    for (const period of periods) {
      const exists = await this.broaderReportsService.hasReportForPeriod(
        'sectorial',
        sector,
        period,
      );
      if (!exists) {
        missing.push(period);
      }
    }
    return missing;
  }

  /**
   * Generates the missing sectorial analysis reports for past periods across
   * the given (or all monitored) sectors, so stock analysis has historical
   * sector context to draw on. Each sector's lookback depth and cadence
   * (month/quarter/week) come from its group in data/sectors.json, so an
   * explicit `from`/`to`/`periods` override is only accepted when every
   * targeted sector shares the same cadence. Skips any sector/period that
   * already has a report.
   */
  async backfillAllSectors(
    from?: string,
    to?: string,
    sectors?: string[],
    periods?: string[],
  ): Promise<{ ranPeriods: string[]; skippedPeriods: string[] }> {
    const targetSectors = sectors?.length
      ? sectors
      : this.listSectors().map((s) => s.sector);

    if (from || to || periods?.length) {
      const cadences = new Set(
        targetSectors.map((sector) => this.getSectorConfig(sector).frequency),
      );
      if (cadences.size > 1) {
        throw new BadRequestException(
          'Explicit from/to/periods backfill override requires all targeted sectors to share the same frequency (month/quarter/week)',
        );
      }
    }

    const ranPeriods: string[] = [];
    const skippedPeriods: string[] = [];
    for (const sector of targetSectors) {
      let sectorPeriods: string[];
      if (periods?.length) {
        sectorPeriods = periods;
      } else {
        const { frequency, backfillYears } = this.getSectorConfig(sector);
        const lookbackPeriods = backfillYears * periodsPerYear(frequency);
        const resolvedTo = to ?? addPeriods(getCurrentPeriod(frequency), -1);
        const resolvedFrom =
          from ?? addPeriods(resolvedTo, -(lookbackPeriods - 1));
        sectorPeriods = enumeratePeriods(resolvedFrom, resolvedTo);
      }

      for (const period of sectorPeriods) {
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
