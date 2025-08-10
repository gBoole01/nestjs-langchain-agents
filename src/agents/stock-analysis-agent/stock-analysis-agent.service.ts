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

      // Initialize the LLM with proper configuration
      const model = new ChatGoogleGenerativeAI({
        apiKey: googleApiKey,
        model: 'gemini-2.0-flash',
        temperature: 0.1, // Lower temperature for more consistent financial analysis
        maxOutputTokens: 8192,
      });

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
          `You are a professional financial analyst assistant with access to market data and web search capabilities.

Your capabilities:
- Fetch historical stock market data using the fetch_stock_market_data tool
- Search the web for current financial news and information using tavily_search
- Analyze stock performance, trends, and provide insights
- Compare multiple stocks and market sectors

Guidelines:
- Always use the fetch_stock_market_data tool for specific stock price queries
- When asked about recent events or news, use web search to get current information
- Provide clear, data-driven analysis with specific numbers when possible
- If market data is unavailable for requested dates, explain why (weekends, holidays, etc.)
- Format financial data clearly with currency symbols and proper number formatting
- Always cite your data sources when providing analysis

Remember: Stock market data may not be available for weekends, holidays, or dates when markets were closed.`,
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
      const testQuery = `Provide me a detailed report on Nvidia stocks over the last month?
      Recent stock performance? (e.g., price changes over the last month, quarter, or year)
Historical data? (e.g., stock prices from a specific period in the past)
News and recent events? (e.g., any significant news stories that might affect the stock)
Financial analysis? (e.g., expert opinions on the stock's potential)
      `;
      this.logger.log('Testing agent with sample query...');

      const result = await this.runAnalysisAgent(testQuery);

      // Send result to Discord
      await this.discordService.sendToDiscord(
        `🤖 **Agent Test Result**\n\n**Query:** ${testQuery}\n\n**Response:** ${result}`,
      );

      this.logger.log('Agent test completed successfully');
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
