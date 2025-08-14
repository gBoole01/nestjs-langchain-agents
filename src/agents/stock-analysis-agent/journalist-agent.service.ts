import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { StructuredToolInterface } from '@langchain/core/tools';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { SerperNewsTool } from 'src/tools/serper/serper-news.tool';
import { SerperWebTool } from 'src/tools/serper/serper-web.tool';
import { WebScrapingTool } from 'src/tools/web-scraping/web-scraping.tool';
import { AgentResult, AnalysisRequest } from './stock-analysis-agent.types';

@Injectable()
export class JournalistAgentService implements OnModuleInit {
  private readonly logger = new Logger(JournalistAgentService.name);
  private agentExecutor: AgentExecutor | null = null;
  private isInitialized = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly serperNewsTool: SerperNewsTool,
    private readonly serperWebTool: SerperWebTool,
    private readonly webScrapingTool: WebScrapingTool,
  ) {}

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
        temperature: 0.3,
        maxOutputTokens: 8192,
      });

      const tools: StructuredToolInterface[] = [
        this.serperNewsTool.getTool(),
        this.serperWebTool.getTool(),
        this.webScrapingTool.getTool(),
      ];

      const prompt = ChatPromptTemplate.fromMessages([
        [
          'system',
          `You are a professional financial journalist specializing in market news and sentiment analysis. Your role is to provide a comprehensive, data-backed summary of significant news and events affecting a given stock.

**Your Workflow:**
1.  **News Gathering:** You MUST use the \`serper_news_search\` tool to find recent and relevant news articles for the requested stock ticker.
2.  **Context & Deep Dive:** If the initial news search lacks detail, use the \`serper_web_search\` tool or the \`web_scraping_tool\` on promising URLs to gather more context.
3.  **Recap:** Analyse the content of the previous report to have a comprehensive overview of the stock's performance.
3.  **Analysis:** Analyze the content of the articles to determine sentiment (positive, negative, neutral) and potential market impact.
4.  **Reporting:** Synthesize your findings into a structured report.

**Constraints & Rules:**
-   **Structured Output:** Your final response must be a clear, concise report with distinct sections.
-   **No Hallucination:** If no news can be found, you MUST explicitly state this. Do not invent news stories or analysis.
-   **Actionable Insights:** Focus on the "why"—explaining the potential implications of the news for the stock's price and investor sentiment.
`,
        ],
        new MessagesPlaceholder('agent_scratchpad'),
        ['human', '{input}'],
      ]);

      const agent = await createToolCallingAgent({ llm: model, tools, prompt });
      this.agentExecutor = new AgentExecutor({
        agent,
        tools,
        maxIterations: 10,
        verbose: this.configService.get('NODE_ENV') === 'development',
        returnIntermediateSteps:
          this.configService.get('NODE_ENV') === 'development',
      });

      this.isInitialized = true;
      this.logger.log('Improved Journalist Agent initialized successfully');
    } catch (error) {
      this.logger.error(
        'Failed to initialize Improved Journalist agent:',
        error.message,
      );
      this.isInitialized = false;
    }
  }

  async analyzeNews(request: AnalysisRequest): Promise<AgentResult> {
    try {
      if (!this.isInitialized || !this.agentExecutor) {
        await this.initializeAgent();
        if (!this.isInitialized) {
          return { success: false, error: 'Agent initialization failed' };
        }
      }

      const query = `
Perform a thorough news and sentiment analysis for ticker ${request.ticker} as of ${request.date}.

Your previous analysis memory MUST be used to inform your analysis. Do not invent news stories or analysis.
Here is the previous analysis memory:
${JSON.stringify(request.memory, null, 2)}


Follow these steps precisely:
1.  **Initial Search:** Use the \`serper_news_search\` tool with queries such as "${request.ticker} stock news", "${request.ticker} earnings report", and "${request.ticker} major announcements" to find the latest articles.
2.  **Detailed Investigation:** Examine the search results. If any articles appear highly relevant but lack sufficient detail in their snippets, use the \`web_scraping_tool\` to retrieve their full content.
3.  **Sentiment Analysis:** Assess the sentiment of the gathered news. Is the general tone positive, negative, or mixed?
4.  **Impact Assessment:** Describe the potential impact of the news on the stock's price and investor perception.
5.  **Synthesize Report:** Present your findings in a structured report format with the following sections:
    -   **Headline Summary:** A brief summary of the most significant news.
    -   **Key News Items:** A bulleted list of articles with a short description of the news and its sentiment.
    -   **Market Impact Analysis:** A paragraph explaining the potential effects on the stock.
    -   **Overall Sentiment:** Your final assessment of the market sentiment based on your findings.

You MUST NOT provide an analysis if no news articles are found. Instead, simply report that no recent news was discovered.
`;
      this.logger.log(`Executing news analysis query: ${query}`);

      const result = await this.agentExecutor.invoke({ input: query });

      // Log intermediate steps to see what tools were called
      if (result.intermediateSteps) {
        this.logger.log('News analysis tool calls made:');
        result.intermediateSteps.forEach((step, index) => {
          this.logger.log(
            `Step ${index + 1}: ${JSON.stringify(step, null, 2)}`,
          );
        });
      }

      return {
        success: true,
        data: result.output,
        metadata: {
          agent: 'journalist',
          timestamp: new Date().toISOString(),
          toolCalls: result.intermediateSteps || [],
        },
      };
    } catch (error) {
      this.logger.error('News analysis failed:', error.message);
      return { success: false, error: error.message };
    }
  }
}
