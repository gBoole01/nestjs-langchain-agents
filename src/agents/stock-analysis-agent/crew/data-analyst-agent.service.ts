import { isAIMessage } from '@langchain/core/messages';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createAgent } from 'langchain';
import { geminiOnFailedAttempt } from 'src/common/llm/gemini-rate-limit-retry.util';
import { FetchStockDataTool } from 'src/tools/tiingo/fetch-stock-data.tool';
import { AgentResult, AnalysisRequest } from '../stock-analysis-agent.types';

@Injectable()
export class DataAnalystAgentService implements OnModuleInit {
  private readonly logger = new Logger(DataAnalystAgentService.name);
  private agent;
  private isInitialized = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly fetchStockDataTool: FetchStockDataTool,
  ) {}

  async onModuleInit() {
    await this.initializeAgent();
  }

  private async initializeAgent(): Promise<void> {
    try {
      const googleApiKey = this.configService.get<string>('GEMINI_API_KEY');
      const geminiModel = this.configService.get<string>('GEMINI_MODEL');
      if (!googleApiKey) {
        this.logger.error('GEMINI_API_KEY is not set');
        return;
      }

      const model = new ChatGoogleGenerativeAI({
        apiKey: googleApiKey,
        model: geminiModel,
        temperature: 0.1,
        maxOutputTokens: 8192,
        maxRetries: 8,
        onFailedAttempt: geminiOnFailedAttempt,
      });

      this.agent = createAgent({
        model,
        tools: [this.fetchStockDataTool.getTool()],
        systemPrompt: `You are a highly skilled financial data analyst. Your primary function is to perform technical analysis on stock market data to provide actionable insights.

**Your Workflow:**
1.  **Data Retrieval:** For any given stock ticker and date range, you MUST use the \`fetch_stock_market_data\` tool to retrieve real historical stock data.
2.  **Technical Analysis:** Based on the retrieved data, perform a comprehensive technical analysis. Focus on key metrics and patterns.
3.  **Insight Generation:** Synthesize your analysis into clear, concise, and structured insights. Your final output must be a well-structured summary.

**Constraints & Rules:**
-   **No Hallucination:** You MUST never provide analysis or numbers without first successfully retrieving real data using the tool.
-   **Tool-First Approach:** Always prioritize using the \`fetch_stock_market_data\` tool immediately upon receiving a request.
-   **Structured Output:** Present your final analysis in a clear, formatted summary. Include sections for key metrics, price trends, and observations.
-   **Error Handling:** If the tool fails or no data is returned, explicitly state that data could not be retrieved and do not proceed with any analysis.

Your goal is to provide a professional, data-driven report based on factual information from the tool.`,
      });

      this.isInitialized = true;
      this.logger.log('Improved Data Analyst Agent initialized successfully');
    } catch (error) {
      this.logger.error(
        'Failed to initialize Improved Data Analyst agent:',
        error.message,
      );
      this.isInitialized = false;
    }
  }

  async analyzeData(request: AnalysisRequest): Promise<AgentResult> {
    try {
      if (!this.isInitialized || !this.agent) {
        await this.initializeAgent();
        if (!this.isInitialized) {
          return { success: false, error: 'Agent initialization failed' };
        }
      }

      const query = `Analyze the stock performance for ticker ${request.ticker} for the period from one month prior to ${request.date} up to ${request.date}.

Follow these steps precisely:
1.  **Retrieve Data:** Use the \`fetch_stock_market_data\` tool with the ticker "${request.ticker}" and the specified date range.
2.  **Calculate Key Metrics:**
    -   Identify the **opening price**, **closing price**, **highest price**, and **lowest price** for the requested period.
    -   Calculate the **monthly volume trend**.
3.  **Identify Trends:**
    -   Describe the overall **price trend** (e.g., upward, downward, volatile) over the month.
    -   Note any significant **support and resistance levels** based on the data.
4.  **Synthesize Report:** Present your findings in a structured report format, clearly labeling each section. Your report should include:
    -   **Summary:** A brief overview of the stock's performance.
    -   **Key Statistics:** The high, low, open, and close prices for the period.
    -   **Market Activity:** Observations on trading volume.
    -   **Technical Observations:** Insights on price trends and support/resistance levels.

Here is the archivist report:
${request.archivistReport}

You MUST NOT provide any analysis if the tool call fails.`;

      this.logger.log(`Executing data analysis query: ${query}`);

      const result = await this.agent.invoke({
        messages: [{ role: 'user', content: query }],
      });
      const lastMessage = result.messages[result.messages.length - 1];
      const output =
        typeof lastMessage.content === 'string'
          ? lastMessage.content
          : JSON.stringify(lastMessage.content);

      const toolCalls = result.messages.filter(
        (message) => isAIMessage(message) && message.tool_calls?.length,
      );
      if (toolCalls.length > 0) {
        this.logger.log('Tool calls made:');
        toolCalls.forEach((message, index) => {
          this.logger.log(
            `Step ${index + 1}: ${JSON.stringify(message.tool_calls, null, 2)}`,
          );
        });
      }

      return {
        success: true,
        data: output,
        metadata: {
          agent: 'data-analyst',
          timestamp: new Date().toISOString(),
          toolCalls,
        },
      };
    } catch (error) {
      this.logger.error('Data analysis failed:', error.message);
      return { success: false, error: error.message };
    }
  }
}
