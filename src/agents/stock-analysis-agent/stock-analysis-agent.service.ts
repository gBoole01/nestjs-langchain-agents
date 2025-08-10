import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { StructuredToolInterface } from '@langchain/core/tools';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { DiscordService } from 'src/integrations/discord/discord.service';
import { SerperNewsTool } from 'src/tools/serper/serper-news.tool';
import { SerperWebTool } from 'src/tools/serper/serper-web.tool';
import { FetchStockDataTool } from 'src/tools/tiingo/fetch-stock-data.tool';
import { WebScrapingTool } from 'src/tools/web-scraping/web-scraping.tool';

@Injectable()
export class StockAnalysisAgentService implements OnModuleInit {
  private readonly logger = new Logger(StockAnalysisAgentService.name);
  private agentExecutor: AgentExecutor | null = null;
  private isInitialized = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly discordService: DiscordService,
    private readonly fetchStockDataTool: FetchStockDataTool,
    private readonly serperNewsTool: SerperNewsTool,
    private readonly serperWebTool: SerperWebTool,
    private readonly webScrapingTool: WebScrapingTool,
  ) {}

  async onModuleInit() {
    await this.initializeAgent();

    // Test the agent after initialization
    if (this.isInitialized) {
      await this.testAgent();
    }
  }

  /**
   * Initializes the LangChain agent with a set of tools.
   * This is called during module initialization to ensure the agent is ready for use.
   */
  private async initializeAgent(): Promise<void> {
    try {
      const googleApiKey = this.configService.get<string>('GEMINI_API_KEY');
      const tavilyApiKey = this.configService.get<string>('TAVILY_API_KEY');

      // Make sure API keys are available
      if (!googleApiKey) {
        this.logger.error(
          'GEMINI_API_KEY is not set in environment variables.',
        );
        return;
      }

      if (!tavilyApiKey) {
        this.logger.error(
          'TAVILY_API_KEY is not set in environment variables.',
        );
        return;
      }

      const model = new ChatGoogleGenerativeAI({
        apiKey: googleApiKey,
        model: 'gemini-2.0-flash',
        temperature: 0.1, // Lower temperature for more consistent financial analysis
        maxOutputTokens: 8192,
      });
      // const model = new Ollama({
      //   model: 'phi3',
      //   temperature: 0.1,
      //   baseUrl: 'http://localhost:11434',
      // });

      // Define the tools the agent can use
      const tools: StructuredToolInterface[] = [
        // new TavilySearch({ maxResults: 5, tavilyApiKey }),
        this.fetchStockDataTool.getTool(),
        this.serperNewsTool.getTool(),
        this.serperWebTool.getTool(),
        this.webScrapingTool.getTool(),
      ];

      // Enhanced prompt for financial analysis
      const prompt = ChatPromptTemplate.fromMessages([
        [
          'system',
          `You are a highly skilled and objective financial analyst agent named 'FinBot'.
Your primary function is to provide comprehensive, data-driven analysis of a given publicly traded company. You will be provided with a single stock ticker symbol and the current date. Your goal is to use the available tools to gather all relevant information and then synthesize it into a structured financial analysis report.
Your analysis must be grounded in facts, figures, and verifiable news. Avoid speculative language, personal opinions, or any information that cannot be directly sourced from the data you retrieve.

TOOLS:
fetch_stock_market_data: Use this tool to get historical stock prices and trading volume for the given ticker. You can specify a date range.
serper_web_search: Use this for general queries about the company, its industry, or its financial reports.
serper_news_search: Use this to find the most recent news articles related to the ticker. This is crucial for understanding current market sentiment.
web_scraping_tool: Use this to extract and summarize the full content of a URL you have identified from a search result.

INSTRUCTIONS:
Upon receiving a ticker, immediately use the available tools to gather the following information:
Last closing price, daily high, and daily low.
Recent trading volume.
A summary of the most relevant news articles from the last 2-3 weeks.
General information about the company's recent performance.
Synthesize the gathered information into a structured report.
Format your final response using Markdown. It must contain the following three sections in this exact order:

Summary: A brief, high-level overview of the stock's recent performance. Include the latest closing price and a concise explanation of the key factors driving its performance (e.g., earnings report, market trends).
News Impact: A bulleted list of 3-5 key recent news items. Each bullet point should be a brief, one-sentence summary of the news item and its potential impact on the stock. Use the web_scraping_tool to get the full context of promising news links.
Sentiment: A single paragraph describing the overall market sentiment toward the stock (e.g., bullish, bearish, neutral). Base this sentiment on the data and news you have retrieved.

Example of desired output structure:
## [Ticker] Stock Analysis - [Current Date]
**Summary:**
...
**News Impact:**
* ...
* ...
* ...
**Sentiment:**
...

You will follow these instructions precisely to deliver a professional, objective, and well-structured financial analysis.
          `,
        ],
        new MessagesPlaceholder('agent_scratchpad'),
        ['human', '{input}'],
      ]);

      // Create the agent
      const agent = await createToolCallingAgent({
        llm: model,
        tools,
        prompt,
      });

      // Create the executor with enhanced configuration
      this.agentExecutor = new AgentExecutor({
        agent,
        tools,
        maxIterations: 10,
        verbose: this.configService.get('NODE_ENV') === 'development',
        returnIntermediateSteps: false,
      });

      this.isInitialized = true;
      this.logger.log('Stock Analysis Agent initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize agent:', error.message);
      this.isInitialized = false;
    }
  }

  /**
   * Runs the agent with a user-provided query.
   * @param query The user's prompt.
   * @returns A promise that resolves to the final answer from the agent.
   */
  async runAnalysisAgent(query: string): Promise<string> {
    try {
      if (!this.isInitialized || !this.agentExecutor) {
        await this.initializeAgent();
        if (!this.isInitialized || !this.agentExecutor) {
          throw new Error(
            'Agent initialization failed. Please check your API keys and try again.',
          );
        }
      }

      this.logger.log(`Executing query: ${query}`);

      const result = await this.agentExecutor.invoke({
        input: query.trim(),
      });

      this.logger.log('Query executed successfully');
      return result.output || 'No response generated.';
    } catch (error) {
      this.logger.error('Agent execution failed:', error.message);

      // Return a more helpful error message
      if (error.message.includes('API key')) {
        return 'API configuration error. Please check your API keys.';
      } else if (
        error.message.includes('network') ||
        error.message.includes('fetch')
      ) {
        return 'Network error occurred while fetching data. Please try again.';
      } else {
        return `An error occurred while processing your request: ${error.message}`;
      }
    }
  }

  /**
   * Test the agent functionality after initialization
   */
  private async testAgent(): Promise<void> {
    try {
      const testQuery = `PLTR ${new Date().toISOString().split('T')[0]}`;
      this.logger.log('Testing agent with sample query...');

      const result = await this.runAnalysisAgent(testQuery);
      if (typeof result === 'string') {
        await this.discordService.sendToDiscord(
          `🤖 **Agent Test Result**\n\n**Query:** ${testQuery}\n\n**Response:** ${result}`,
        );

        this.logger.log('Agent test completed successfully');
      } else {
        throw new Error(
          `Wrong response type : ${JSON.stringify(result, null, 2)}`,
        );
      }
    } catch (error) {
      this.logger.error('Agent test failed:', error.message);
      await this.discordService.sendToDiscord(
        `❌ **Agent Test Failed**\n\nError: ${error.message}`,
      );
    }
  }

  /**
   * Get the current status of the agent
   */
  getAgentStatus(): { initialized: boolean; ready: boolean } {
    return {
      initialized: this.isInitialized,
      ready: this.isInitialized && !!this.agentExecutor,
    };
  }

  /**
   * Reinitialize the agent (useful for error recovery)
   */
  async reinitialize(): Promise<boolean> {
    this.logger.log('Reinitializing agent...');
    this.isInitialized = false;
    this.agentExecutor = null;

    await this.initializeAgent();
    return this.isInitialized;
  }
}
