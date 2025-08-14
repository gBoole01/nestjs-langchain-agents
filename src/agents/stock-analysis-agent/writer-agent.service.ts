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
        temperature: 0.4, // Higher for better writing quality
        maxOutputTokens: 8192,
      });

      const prompt = ChatPromptTemplate.fromMessages([
        [
          'system',
          `You are a professional financial writer specializing in creating clear, concise, and objective stock analysis reports. Your goal is to translate raw data and insights from other agents into a polished, easy-to-read report for a general audience.

**Your Task:**
1.  **Synthesize:** Combine the provided data analysis and news analysis into a single, coherent narrative.
2.  **Structure:** Format the final output into a professional report with the following sections, using clear headings:
    -   **Executive Summary:** A brief, high-level overview of the stock's recent performance and key takeaways.
    -   **Technical Analysis:** Insights derived from the price action, volume, and identified trends.
    -   **Market Activity & News Impact:** An assessment of significant news, market sentiment, and how they influenced the stock.
    -   **Conclusion:** A final summary of the overall assessment.
3.  **Style:** Write in a formal but accessible tone. Avoid technical jargon where possible, or explain it simply. Do not add any new information not present in the provided analysis. Ensure your tone is objective and factual.`,
        ],
        new MessagesPlaceholder('agent_scratchpad'),
        ['human', '{input}'],
      ]);

      const agent = await createToolCallingAgent({
        llm: model,
        tools: [],
        prompt,
      });

      this.agentExecutor = new AgentExecutor({
        agent,
        tools: [],
        maxIterations: 3,
        verbose: false,
      });

      this.isInitialized = true;
      this.logger.log('Writer Agent initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Writer agent:', error.message);
      this.isInitialized = false;
    }
  }

  async writeReport(
    ticker: string,
    date: string,
    dataAnalysis: DataAnalysisResult,
    newsAnalysis: NewsAnalysisResult,
    memory: Record<string, any>,
  ): Promise<AgentResult> {
    try {
      if (!this.isInitialized || !this.agentExecutor) {
        await this.initializeAgent();
        if (!this.isInitialized) {
          return { success: false, error: 'Agent initialization failed' };
        }
      }

      const input = `
Create a comprehensive financial analysis report for ticker ${ticker} as of ${date}.

Use the following information as your source:

### Technical Data Analysis:
${JSON.stringify(dataAnalysis, null, 2)}

### News and Sentiment Analysis:
${JSON.stringify(newsAnalysis, null, 2)}

### Previous Analysis Memory:
${JSON.stringify(memory, null, 2)}

**Report Structure:**
-   **Executive Summary:** Start with a brief, punchy summary.
-   **Technical Analysis:** Elaborate on the price trends, volume, and support/resistance levels.
-   **Market Activity & News Impact:** Discuss how recent news and market sentiment have affected the stock.
-   **Conclusion:** Provide a final, balanced assessment.

Your report must be based exclusively on the provided data. Do not make up any facts or figures.
`;

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
