import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import {
  AgentResult,
  DataAnalysisResult,
  NewsAnalysisResult,
} from './stock-analysis-agent.types';

@Injectable()
export class WriterAgentService implements OnModuleInit {
  private readonly logger = new Logger(WriterAgentService.name);
  private agentExecutor: AgentExecutor | null = null;
  private isInitialized = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    await this.initializeAgent();
  }

  private async initializeAgent(): Promise<void> {
    try {
      const googleApiKey = this.configService.get<string>('GEMINI_API_KEY');
      if (!googleApiKey) {
        this.logger.error('GEMINI_API_KEY is not set');
        return;
      }

      const model = new ChatGoogleGenerativeAI({
        apiKey: googleApiKey,
        model: 'gemini-2.0-flash',
        temperature: 0.5,
        maxOutputTokens: 8192,
      });

      const prompt = ChatPromptTemplate.fromMessages([
        [
          'system',
          `You are a professional financial journalist tasked with writing a comprehensive report for a stock.
          Your report must be:
          -   Objective and factual, based only on the provided data.
          -   Well-structured with clear headings.
          -   Easy to read for a non-expert audience.
          -   Insightful, explaining the "why" behind the market movements.

          Report Structure:
          -   **Executive Summary:** A brief, punchy summary of the stock's recent performance.
          -   **Technical Analysis:** Elaborate on the price trends, volume, and support/resistance levels.
          -   **Market Activity & News Impact:** Discuss how recent news and market sentiment have affected the stock.
          -   **Conclusion:** Provide a final, balanced assessment.

          You will be provided with technical data, news analysis, and a previous report for context. If you are provided with revision feedback, you MUST incorporate it to improve your draft.
          `,
        ],
        new MessagesPlaceholder('agent_scratchpad'),
        ['human', '{input}'],
      ]);

      const agent = createToolCallingAgent({
        llm: model,
        tools: [],
        prompt,
      });
      this.agentExecutor = new AgentExecutor({
        agent,
        tools: [],
        verbose: this.configService.get('NODE_ENV') === 'development',
        returnIntermediateSteps:
          this.configService.get('NODE_ENV') === 'development',
      });

      this.isInitialized = true;
      this.logger.log('Writer Agent initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Writer agent:', error.message);
      this.isInitialized = false;
    }
  }

  /**
   * Generates or revises a financial report based on new data and previous memory.
   * @param ticker The stock ticker symbol.
   * @param date The current date of the analysis.
   * @param dataAnalysis The technical data analysis result.
   * @param newsAnalysis The news and sentiment analysis result.
   * @param memory The previous report memory for context.
   * @param feedback Optional feedback from a critic to revise the report.
   * @returns An AgentResult containing the generated report or an error.
   */
  async writeReport(
    ticker: string,
    date: string,
    dataAnalysis: DataAnalysisResult,
    newsAnalysis: NewsAnalysisResult,
    memory: Record<string, any>,
    feedback?: string,
  ): Promise<AgentResult> {
    try {
      if (!this.isInitialized || !this.agentExecutor) {
        await this.initializeAgent();
        if (!this.isInitialized) {
          return { success: false, error: 'Agent initialization failed' };
        }
      }

      let input = `
Create a comprehensive financial analysis report for ticker ${ticker} as of ${date}.

Use the following information as your source:

### Technical Data Analysis:
${JSON.stringify(dataAnalysis, null, 2)}

### News and Sentiment Analysis:
${JSON.stringify(newsAnalysis, null, 2)}

### Previous Analysis Memory:
${JSON.stringify(memory, null, 2)}
`;

      if (feedback) {
        input += `
### Revision Feedback:
Your previous draft was not satisfactory. Please revise your report based on the following feedback:
"${feedback}"

Ensure you address all points and resubmit a high-quality, final report.
`;
      }

      const result = await this.agentExecutor.invoke({ input });

      return {
        success: true,
        data: result.output,
        metadata: { agent: 'writer', timestamp: new Date().toISOString() },
      };
    } catch (error) {
      this.logger.error('Report writing failed:', error.message);
      return { success: false, error: error.message };
    }
  }
}
