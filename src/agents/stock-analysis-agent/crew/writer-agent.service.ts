import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createAgent } from 'langchain';
import { geminiOnFailedAttempt } from 'src/common/llm/gemini-rate-limit-retry.util';
import {
  AgentResult,
  DataAnalysisResult,
  NewsAnalysisResult,
} from '../stock-analysis-agent.types';

export interface WriteReportInput {
  ticker: string;
  date: string;
  dataAnalysis: DataAnalysisResult;
  newsAnalysis: NewsAnalysisResult;
  portfolioAnalysis: string;
  archivistReport: string;
  globalReport: string;
  geoReport: string;
  sectorReport: string;
  feedback?: string;
}

@Injectable()
export class WriterAgentService implements OnModuleInit {
  private readonly logger = new Logger(WriterAgentService.name);
  private agent;
  private isInitialized = false;

  constructor(private readonly configService: ConfigService) {}

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
        tools: [],
        systemPrompt: `You are a professional financial journalist tasked with writing a comprehensive report for a stock.
Your report must be:
-   Objective and factual, based only on the provided data.
-   Well-structured with clear headings.
-   Easy to read for a non-expert audience.
-   Insightful, explaining the "why" behind the market movements.
-   **Crucially, you must incorporate the user's personal portfolio data to provide actionable, tailored advice in the conclusion.**

Report Structure:
-   **Executive Summary:** A brief, punchy summary of the stock's recent performance.
-   **Technical Analysis:** Elaborate on the price trends, volume, and support/resistance levels.
-   **Market Activity & News Impact:** Discuss how recent news and market sentiment have affected the stock.
-   **Broader Context:** Situate the stock within the relevant global macroeconomic, regional and sector outlook provided to you.
-   **Conclusion & Portfolio Action:** Provide a final, balanced assessment and, based on the user's portfolio, offer a concrete, actionable recommendation.

You will be provided with technical data, news analysis, a previous report, and broader global/regional/sector context. If you are provided with revision feedback, you MUST incorporate it to improve your draft.
`,
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
   * @param input The report inputs: ticker/date, technical + news analysis,
   * portfolio holdings, prior archivist report, broader global/regional/sector
   * context, and optional critic feedback to incorporate.
   * @returns An AgentResult containing the generated report or an error.
   */
  async writeReport(input: WriteReportInput): Promise<AgentResult> {
    const {
      ticker,
      date,
      dataAnalysis,
      newsAnalysis,
      portfolioAnalysis,
      archivistReport,
      globalReport,
      geoReport,
      sectorReport,
      feedback,
    } = input;

    try {
      if (!this.isInitialized || !this.agent) {
        await this.initializeAgent();
        if (!this.isInitialized) {
          return { success: false, error: 'Agent initialization failed' };
        }
      }

      let promptInput = `
Create a comprehensive financial analysis report for ticker ${ticker} as of ${date}.

Use the following information as your source:

### Technical Data Analysis:
${JSON.stringify(dataAnalysis, null, 2)}

### News and Sentiment Analysis:
${JSON.stringify(newsAnalysis, null, 2)}

### Archivist Report:
${archivistReport}

### Global Economic Context:
${globalReport}

### Regional/Geographical Context:
${geoReport}

### Sector Context:
${sectorReport}

### User's Portfolio:
${portfolioAnalysis}
`;

      if (feedback) {
        promptInput += `
### Revision Feedback:
Your previous draft was not satisfactory. Please revise your report based on the following feedback:
"${feedback}"

Ensure you address all points and resubmit a high-quality, final report.
`;
      }

      const result = await this.agent.invoke({
        messages: [{ role: 'user', content: promptInput }],
      });
      const lastMessage = result.messages[result.messages.length - 1];
      const output =
        typeof lastMessage.content === 'string'
          ? lastMessage.content
          : JSON.stringify(lastMessage.content);

      return {
        success: true,
        data: output,
        metadata: { agent: 'writer', timestamp: new Date().toISOString() },
      };
    } catch (error) {
      this.logger.error('Report writing failed:', error.message);
      return { success: false, error: error.message };
    }
  }
}
