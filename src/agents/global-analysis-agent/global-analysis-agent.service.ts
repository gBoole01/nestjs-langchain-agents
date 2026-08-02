import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { Annotation, END, StateGraph } from '@langchain/langgraph';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ArchivistService } from './crew/archivist.service';
import { ResearchOrchestratorService } from './crew/research-orchestrator.service';

@Injectable()
export class GlobalAnalysisAgentService implements OnModuleInit {
  private readonly logger = new Logger(GlobalAnalysisAgentService.name);
  private workflow;
  private model: ChatGoogleGenerativeAI;

  constructor(
    private readonly configService: ConfigService,
    private readonly researchTeam: ResearchOrchestratorService,
    private readonly archivist: ArchivistService,
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
    });
    this.initializeWorkflow();
    this.logger.log('Global Analyst Service initialized with LangGraph');
  }

  private initializeWorkflow() {
    // Define the state schema using Annotation.Root
    const GlobalAnalysisState = Annotation.Root({
      query: Annotation<string>(),
      rawData: Annotation<string>(),
      historicalContext: Annotation<string>(),
      finalReport: Annotation<string>(),
    });

    // The entire workflow is built in a single, chained sequence
    this.workflow = new StateGraph(GlobalAnalysisState)
      // Node 1: Call the Research Team to fetch new data
      .addNode('fetch_new_data', async (state) => {
        this.logger.log('Step 1: Calling Research Team for fresh data...');
        const rawData = await this.researchTeam.runQuery(state.query);
        return { rawData: rawData };
      })

      // Node 2: Store the fetched raw data and retrieve historical context
      .addNode('process_data', async (state) => {
        this.logger.log(
          'Step 2: Storing new data and retrieving historical context...',
        );
        await this.archivist.storeRawData(state.rawData);
        const historicalContext = await this.archivist.retrieveData(
          state.query,
        );
        return { historicalContext: historicalContext };
      })

      // Node 3: Synthesize the final report using all data
      .addNode('synthesize_report', async (state) => {
        this.logger.log('Step 3: Synthesizing the final report...');
        const prompt = ChatPromptTemplate.fromMessages([
          [
            'system',
            `You are a highly skilled macroeconomic analyst. Your task is to write a comprehensive global economic report.
             Use the following new data and historical context to inform your analysis.
             New Data: ${state.rawData}
             Historical Context: ${state.historicalContext}`,
          ],
          [
            'human',
            'Please write a well-structured and insightful global economic outlook report.',
          ],
        ]);
        const chain = prompt.pipe(this.model);
        const finalReport = await chain.invoke({});
        return { finalReport: finalReport.content };
      })

      // Node 4: Archive the final report
      .addNode('archive_final_report', async (state) => {
        this.logger.log('Step 4: Archiving the final report...');
        await this.archivist.storeFinalReport(state.finalReport);
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
   * Runs the entire global analysis workflow.
   * @param query The user's query for the report (e.g., "global economic outlook").
   */
  async runAnalysis(query: string): Promise<string> {
    this.logger.log(`Running global analysis for query: ${query}`);
    const result = await this.workflow.invoke({ query });
    this.logger.log('Global analysis complete.');
    return result.finalReport || 'No report generated.';
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
