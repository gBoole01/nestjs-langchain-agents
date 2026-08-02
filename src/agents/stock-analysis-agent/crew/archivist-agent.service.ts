import { Document } from '@langchain/core/documents';
import {
  ChatGoogleGenerativeAI,
  GoogleGenerativeAIEmbeddings,
} from '@langchain/google-genai';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { ChromaClient, EmbeddingFunction } from 'chromadb';
import { createAgent } from 'langchain';
import { Model } from 'mongoose';
import { geminiOnFailedAttempt } from 'src/common/llm/gemini-rate-limit-retry.util';
import { ReportRetrievalTool } from 'src/tools/rag/report-retrieval.tool';
import { Report, ReportDocument } from '../models/reports.model';
import { AgentResult, WriterReport } from '../stock-analysis-agent.types';

@Injectable()
export class ArchivistAgentService implements OnModuleInit {
  private readonly logger = new Logger(ArchivistAgentService.name);
  private agent;
  private isInitialized = false;
  private embeddings: GoogleGenerativeAIEmbeddings; // Remove 'null'
  private chromaCollection: any;
  private isProduction = false;

  constructor(
    @InjectModel(Report.name) private reportModel: Model<ReportDocument>,
    private readonly reportRetrievalTool: ReportRetrievalTool,
    private readonly configService: ConfigService,
  ) {
    this.isProduction = this.configService.get('NODE_ENV') === 'production';
    // Initialize embeddings here to ensure it's always set
    this.embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: this.configService.get<string>('GEMINI_API_KEY'),
      model: 'gemini-embedding-001',
    });
  }

  async onModuleInit() {
    try {
      if (!this.isProduction) {
        const chromaClient = new ChromaClient({
          path: 'http://localhost:8000',
        });
        const embeddingFunction: EmbeddingFunction = {
          generate: async (texts: string[]) => {
            const embeddings = await this.embeddings.embedDocuments(texts);
            return embeddings as number[][];
          },
        };
        this.chromaCollection = await chromaClient.getOrCreateCollection({
          name: 'stock_reports',
          embeddingFunction: embeddingFunction,
        });
      }

      await this.reportModel.countDocuments().exec();
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
        maxRetries: 8,
        onFailedAttempt: geminiOnFailedAttempt,
      });

      this.agent = createAgent({
        model,
        tools: [this.reportRetrievalTool.getTool()],
        systemPrompt: `You are the Archivist Agent, a highly specialized financial researcher. Your sole purpose is to retrieve, synthesize, and provide context from historical financial reports.

You are equipped with a single, powerful tool: "retrieve_reports." This is the only way you can access historical data.

Your workflow is as follows:
1. Upon receiving a query, you MUST first use the "retrieve_reports" tool to find all relevant historical reports.
2. You will then use the information returned from the tool to synthesize a concise, high-level summary.
3. The final output must be a single paragraph that provides a clear and "informed opinion" based solely on the retrieved historical data.

Never attempt to answer a query without first using your tool. Your entire existence is to use this tool to provide information.`,
      });

      this.isInitialized = true;
      this.logger.log('Archivist Agent initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Archivist agent:', error.message);
      this.isInitialized = false;
    }
  }

  /**
   * Retrieves a series of historical reports for a given query and synthesizes an informed opinion.
   * @param query The user's query, e.g., "synthesize an opinion on MSFT".
   * @returns A synthesized string of past analysis or null if the agent fails.
   */
  async getInformedOpinion(query: string): Promise<string | null> {
    if (!this.isInitialized || !this.agent) {
      this.logger.warn(
        'Archivist Agent is not initialized. Cannot provide an informed opinion.',
      );
      return null;
    }

    try {
      this.logger.log(`Generating informed opinion for query "${query}"...`);
      const result = await this.agent.invoke({
        messages: [{ role: 'user', content: query }],
      });
      const lastMessage = result.messages[result.messages.length - 1];
      const opinion =
        typeof lastMessage.content === 'string'
          ? lastMessage.content
          : JSON.stringify(lastMessage.content);

      this.logger.log(`Informed opinion for query "${query}" generated.`);
      this.logger.log(`Agent output: ${opinion}`);
      return opinion;
    } catch (error) {
      this.logger.error('Failed to generate informed opinion:', error.message);
      return null;
    }
  }

  /**
   * Saves a new report to the appropriate database based on the environment.
   * Each section is embedded individually so retrieval can match on
   * topically-focused vectors instead of one blended whole-report vector.
   * @param ticker The stock ticker symbol.
   * @param report The structured report produced by the Writer agent.
   * @returns An AgentResult indicating success or failure.
   */
  async saveReport(ticker: string, report: WriterReport): Promise<AgentResult> {
    if (!this.isInitialized || !this.embeddings) {
      return { success: false, error: 'Archivist Agent is not initialized.' };
    }

    try {
      const date = new Date();
      const sectionVectors = await this.embeddings.embedDocuments(
        report.sections.map((section) => section.content),
      );

      const sections = report.sections.map((section, index) => ({
        heading: section.heading,
        content: section.content,
        ...(this.isProduction ? { vector: sectionVectors[index] } : {}),
      }));

      const newReport = new this.reportModel({
        ticker,
        date,
        sections,
        overallSentiment: report.overallSentiment,
        priceTrend: report.priceTrend,
      });
      const savedReport = await newReport.save();

      if (!this.isProduction) {
        const documents: Document[] = report.sections.map((section) => ({
          pageContent: section.content,
          metadata: {
            ticker,
            date: date.toISOString(),
            heading: section.heading,
            sentiment: report.overallSentiment,
            priceTrend: report.priceTrend,
            reportId: savedReport._id.toString(),
            source: 'generated-report',
          },
        }));
        await this.chromaCollection.add({
          ids: report.sections.map(
            (_, index) => `${savedReport._id.toString()}-${index}`,
          ),
          documents: documents.map((document) => document.pageContent),
          metadatas: documents.map((document) => document.metadata),
        });
      }

      this.logger.log(`Report for ticker ${ticker} saved to database.`);
      return { success: true, data: 'Report saved successfully.' };
    } catch (error) {
      this.logger.error('Failed to save report:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Checks whether a report for the given ticker was already saved today (UTC).
   * @param ticker The stock ticker symbol.
   */
  async hasReportToday(ticker: string): Promise<boolean> {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

    return Boolean(
      await this.reportModel.exists({
        ticker,
        date: { $gte: startOfDay, $lt: endOfDay },
      }),
    );
  }

  /**
   * Lists archived reports, most recent first, optionally filtered by ticker.
   * @param ticker Optional ticker to filter by.
   */
  async listReports(ticker?: string): Promise<ReportDocument[]> {
    const filter = ticker ? { ticker } : {};
    return this.reportModel
      .find(filter)
      .select('-sections.vector')
      .sort({ date: -1 })
      .exec();
  }

  /**
   * Retrieves a single archived report by id.
   * @param id The Mongo document id.
   */
  async getReportById(id: string): Promise<ReportDocument | null> {
    return this.reportModel.findById(id).select('-sections.vector').exec();
  }
}
