import { Annotation, END, StateGraph } from '@langchain/langgraph';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InternalCriticAgent } from './internal-critic-agent.service';
import { ToolExecutorAgent } from './tool-executor-agent.service';

// Define the state schema for our research workflow

@Injectable()
export class ResearchOrchestratorService implements OnModuleInit {
  private readonly logger = new Logger(ResearchOrchestratorService.name);
  private workflow;

  constructor(
    private readonly toolExecutor: ToolExecutorAgent,
    private readonly internalCritic: InternalCriticAgent,
  ) {}

  async onModuleInit() {
    this.initializeWorkflow();
    this.logger.log('Research Orchestrator Service initialized with LangGraph');
  }

  private initializeWorkflow() {
    const ResearchState = Annotation.Root({
      query: Annotation<string>(),
      rawData: Annotation<string>(),
      criticVerdict: Annotation<'PASS' | 'FAIL'>(),
      criticFeedback: Annotation<string>(),
    });

    this.workflow = new StateGraph(ResearchState)
      .addNode('fetch_data', async (state) => {
        this.logger.log(`Fetching data for query: "${state.query}"`);
        const rawData = await this.toolExecutor.executeTools(state.query);
        return { rawData: rawData };
      })

      .addNode('critique_data', async (state) => {
        this.logger.log('Critiquing the fetched data...');
        const critique = await this.internalCritic.evaluateData(state.rawData);
        return {
          criticVerdict: critique.verdict,
          criticFeedback: critique.feedback,
        };
      })

      .addEdge('__start__', 'fetch_data')
      .addEdge('fetch_data', 'critique_data')

      // This is the conditional loop we designed
      .addConditionalEdges('critique_data', (state) => state.criticVerdict, {
        PASS: END, // If data is good, end the process and return
        FAIL: 'fetch_data', // If data is bad, loop back and re-fetch
      })
      .compile();
  }

  /**
   * Runs the research workflow.
   * @param query The user's query for the report.
   * @returns The validated raw data.
   */
  async runQuery(query: string): Promise<string> {
    const result = await this.workflow.invoke({ query });
    return result.rawData;
  }
}
