import { BaseMessage } from '@langchain/core/messages';
import { Annotation, StateGraph } from '@langchain/langgraph';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DiscordService } from 'src/integrations/discord/discord.service';
import { ArchivistAgentService } from './crew/archivist-agent.service';
import { CriticAgentService } from './crew/critic-agent.service';
import { DataAnalystAgentService } from './crew/data-analyst-agent.service';
import { JournalistAgentService } from './crew/journalist-agent.service';
import { WriterAgentService } from './crew/writer-agent.service';

const AgentState = Annotation.Root({
  // The 'messages' channel is for managing conversation history
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  // Custom channels for our workflow
  ticker: Annotation<string>(),
  date: Annotation<string>(),
  archivist_report: Annotation<string>(),
  data_report: Annotation<string>(),
  news_report: Annotation<string>(),
  writer_draft: Annotation<string>(),
  critic_verdict: Annotation<'PASS' | 'FAIL'>(),
  critic_feedback: Annotation<string>(),
});

@Injectable()
export class StockAnalysisAgentGraphService implements OnModuleInit {
  private readonly logger = new Logger(StockAnalysisAgentGraphService.name);
  private agent: any | null = null;

  constructor(
    private readonly discordService: DiscordService,
    private readonly dataAnalystAgent: DataAnalystAgentService,
    private readonly journalistAgent: JournalistAgentService,
    private readonly writerAgent: WriterAgentService,
    private readonly criticAgent: CriticAgentService,
    private readonly archivistAgent: ArchivistAgentService,
  ) {}

  async onModuleInit() {
    await this.initializeAgent();
    this.logger.log('Orchestrator Agent initialized');
  }

  private async initializeAgent() {
    try {
      const workflow = new StateGraph(AgentState)
        .addNode('archivist', (state) => this.fetchArchivistReport(state))
        .addNode('parallel_analysis', (state) =>
          this.runParallelAnalysis(state),
        )
        .addNode('writer', (state) => this.writeReport(state))
        .addNode('critic', (state) => this.critiqueReport(state))
        .addNode('save_report', (state) => {
          this.archivistAgent.saveReport(state.ticker, state.writer_draft);
          return {};
        })
        .addEdge('__start__', 'archivist')
        .addEdge('archivist', 'parallel_analysis')
        .addEdge('parallel_analysis', 'writer')
        .addEdge('writer', 'critic')
        .addConditionalEdges('critic', (state) =>
          state.critic_verdict === 'PASS' ? 'save_report' : 'writer',
        )
        .addEdge('save_report', '__end__');
      this.agent = workflow.compile();
      this.logger.log('Stock Analysis Agent initialized successfully');
    } catch (error) {
      this.logger.error(
        'Failed to initialize Stock Analysis agent:',
        error.message,
      );
    }
  }

  async runAnalysisForTickers(tickers: string[]) {
    for (const ticker of tickers) {
      await this.runAgent(ticker);
    }
  }

  async runAgent(ticker: string): Promise<void> {
    if (!this.agent) {
      this.logger.warn('Agent is not initialized. Cannot run agent.');
      return;
    }

    try {
      this.logger.log('Testing agent with sample query...');
      const result = await this.agent.invoke({
        ticker,
        date: new Date().toISOString().split('T')[0],
      });
      this.discordService.sendToDiscord(result.writer_draft);
    } catch (error) {
      this.logger.error('Agent test failed:', error.message);
    }
  }

  // Node to get the archivist's report
  fetchArchivistReport = async (state) => {
    const report = await this.archivistAgent.getInformedOpinion(state.ticker);
    return { archivist_report: report };
  };

  // Node to run data and news analysis in parallel
  // This would internally handle Promise.all()
  runParallelAnalysis = async (state) => {
    const [dataResult, newsResult] = await Promise.all([
      this.dataAnalystAgent.analyzeData({
        ticker: state.ticker,
        date: state.date,
      }),
      this.journalistAgent.analyzeNews({
        ticker: state.ticker,
        date: state.date,
      }),
    ]);
    // Handle success/failure as you did in your code
    return { data_report: dataResult.data, news_report: newsResult.data };
  };

  // Node for the Writer Agent
  writeReport = async (state) => {
    // Use state.data_report, state.news_report, etc.
    const draft = await this.writerAgent.writeReport(
      state.ticker,
      state.date,
      state.data_report,
      state.news_report,
      state.archivist_report,
      state.critic_feedback,
    );
    return { writer_draft: draft.data };
  };

  // Node for the Critic Agent
  critiqueReport = async (state) => {
    const verdict = await this.criticAgent.critiqueReport(
      state.writer_draft,
      state.data_report,
      state.news_report,
      state.archivist_report,
    );
    // Return the verdict and feedback for the next step
    return {
      critic_verdict: verdict.verdict,
      critic_feedback: verdict.feedback,
    };
  };
}
