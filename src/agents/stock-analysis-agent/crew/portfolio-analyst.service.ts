import { isAIMessage } from '@langchain/core/messages';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createAgent } from 'langchain';
import { geminiOnFailedAttempt } from 'src/common/llm/gemini-rate-limit-retry.util';
import { PortfolioTool } from 'src/tools/portfolio/portfolio.tool';
import { AgentResult } from '../stock-analysis-agent.types';

@Injectable()
export class PortfolioAnalystAgentService implements OnModuleInit {
  private readonly logger = new Logger(PortfolioAnalystAgentService.name);
  private agent;
  private isInitialized = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly portfolioTool: PortfolioTool,
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
        tools: [this.portfolioTool.getTool()],
        systemPrompt: `You are a highly skilled portfolio analyst. Your primary function is to analyze a user's entire stock portfolio to provide insights and summaries.

**Your Workflow:**
1.  **Data Retrieval:** You MUST use the \`get_portfolio\` tool immediately upon receiving a request. This is the only way you can access the portfolio holdings.
2.  **Portfolio Analysis:** Based on the retrieved data, perform a comprehensive analysis of the entire portfolio.
3.  **Insight Generation:** Synthesize your analysis into clear, concise, and structured insights. Your final output must be a well-structured summary.

**Constraints & Rules:**
-   **Tool-First Approach:** Always prioritize using the \`get_portfolio\` tool immediately upon receiving a request.
-   **Structured Output:** Present your final analysis in a clear, formatted summary. Include sections for portfolio composition, total value, and observations on the distribution of assets.
-   **No Hallucination:** You MUST never provide any analysis or numbers without first successfully retrieving the portfolio data using your tool.
-   **Error Handling:** If the tool fails or no data is returned, explicitly state that the portfolio could not be retrieved and do not proceed with any analysis.

Your goal is to provide a professional, data-driven report based on factual information from the tool.`,
      });

      this.isInitialized = true;
      this.logger.log('Portfolio Analyst Agent initialized successfully');
    } catch (error) {
      this.logger.error(
        'Failed to initialize Portfolio Analyst agent:',
        error.message,
      );
      this.isInitialized = false;
    }
  }

  async analyzePortfolio(): Promise<AgentResult> {
    try {
      if (!this.isInitialized || !this.agent) {
        await this.initializeAgent();
        if (!this.isInitialized) {
          return { success: false, error: 'Agent initialization failed' };
        }
      }

      const query = `Provide a full analysis of the current portfolio.`;

      this.logger.log(`Executing portfolio analysis query...`);

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
          agent: 'portfolio-analyst',
          timestamp: new Date().toISOString(),
          toolCalls,
        },
      };
    } catch (error) {
      this.logger.error('Portfolio analysis failed:', error.message);
      return { success: false, error: error.message };
    }
  }
}
