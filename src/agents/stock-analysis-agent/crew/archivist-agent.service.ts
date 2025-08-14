// archivist-agent.service.ts
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { Model } from 'mongoose';
import { Report, ReportDocument } from '../models/reports.model';
import { AgentResult } from '../stock-analysis-agent.types';

@Injectable()
export class ArchivistAgentService implements OnModuleInit {
  private readonly logger = new Logger(ArchivistAgentService.name);
  private agentExecutor: AgentExecutor | null = null;
  private isInitialized = false;

  constructor(
    @InjectModel(Report.name) private reportModel: Model<ReportDocument>,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    try {
      // Initialize the Mongoose connection check
      await this.reportModel.countDocuments().exec();

      // Initialize the LLM agent for analysis
      await this.initializeAgent();

      this.isInitialized = true;
      this.logger.log('Archivist Agent initialized successfully.');
    } catch (error) {
      this.logger.error('Failed to initialize Archivist agent:', error.message);
      this.isInitialized = false;
    }
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
      });

      const prompt = ChatPromptTemplate.fromMessages([
        [
          'system',
          `You are the Archivist Agent, a wise and insightful historian of financial reports. Your role is to read a series of past reports for a specific stock and synthesize them into a concise, informed opinion.

          Your task is:
          1.  Read through the provided historical reports, which are already structured as a JSON array.
          2.  Identify key trends, shifts in market sentiment, and any recurring themes over time.
          3.  Generate a short, high-level summary that serves as a "memory" for the writer. This summary should not just be a concatenation of the reports but a true synthesis.
          4.  The final output must be a single paragraph, providing a clear and "informed opinion" on the stock's recent trajectory.
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
      this.logger.log('Critic Agent initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Critic agent:', error.message);
      this.isInitialized = false;
    }
  }

  /**
   * Retrieves a series of historical reports for a given ticker and synthesizes an informed opinion.
   * @param ticker The stock ticker symbol.
   * @returns A synthesized string of past analysis or null if no reports are found.
   */
  async getInformedOpinion(ticker: string): Promise<string | null> {
    if (!this.isInitialized || !this.agentExecutor) {
      this.logger.warn(
        'Archivist Agent is not initialized. Cannot provide an informed opinion.',
      );
      return null;
    }

    try {
      // Find the last 5 reports for the ticker, sorted by date.
      const historicalReports = await this.reportModel
        .find({ ticker })
        .sort({ date: -1 })
        .limit(5)
        .exec();

      if (historicalReports.length === 0) {
        this.logger.log(`No historical reports found for ticker: ${ticker}.`);
        return null;
      }

      // Format the reports into a JSON string for the LLM
      const input = `
        Please provide an informed opinion on the past performance of ticker ${ticker} based on these historical reports:
        ${JSON.stringify(historicalReports, null, 2)}
      `;

      const result = await this.agentExecutor.invoke({ input });
      const opinion = result.output as string;

      this.logger.log(`Informed opinion for ticker ${ticker} generated.`);
      return opinion;
    } catch (error) {
      this.logger.error('Failed to generate informed opinion:', error.message);
      return null;
    }
  }

  /**
   * Saves a new report to the database.
   * @param ticker The stock ticker symbol.
   * @param reportContent The full content of the generated report.
   * @returns An AgentResult indicating success or failure.
   */
  async saveReport(
    ticker: string,
    reportContent: string,
  ): Promise<AgentResult> {
    // ... (This method remains the same) ...
    if (!this.isInitialized) {
      return { success: false, error: 'Archivist Agent is not initialized.' };
    }

    try {
      const newReport = new this.reportModel({
        ticker,
        reportContent,
        date: new Date(),
      });
      await newReport.save();
      this.logger.log(`Report for ticker ${ticker} saved to database.`);
      return { success: true, data: 'Report saved successfully.' };
    } catch (error) {
      this.logger.error('Failed to save report:', error.message);
      return { success: false, error: error.message };
    }
  }
}
