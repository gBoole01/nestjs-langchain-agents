import { Document } from '@langchain/core/documents';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { StructuredToolInterface } from '@langchain/core/tools';
import {
  ChatGoogleGenerativeAI,
  GoogleGenerativeAIEmbeddings,
} from '@langchain/google-genai';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { ChromaClient, EmbeddingFunction } from 'chromadb';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { Model } from 'mongoose';
import { ReportRetrievalTool } from 'src/tools/rag/report-retrieval.tool';
import { Report, ReportDocument } from '../models/reports.model';
import { AgentResult } from '../stock-analysis-agent.types';

@Injectable()
export class ArchivistAgentService implements OnModuleInit {
  private readonly logger = new Logger(ArchivistAgentService.name);
  private agentExecutor: AgentExecutor | null = null;
  private isInitialized = false;
  private chromaClient: ChromaClient | null = null;
  private embeddings: GoogleGenerativeAIEmbeddings | null = null;
  private chromaCollection: any;

  constructor(
    @InjectModel(Report.name) private reportModel: Model<ReportDocument>,
    private readonly reportRetrievalTool: ReportRetrievalTool,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    try {
      this.chromaClient = new ChromaClient({ path: 'http://localhost:8000' });

      this.embeddings = new GoogleGenerativeAIEmbeddings({
        apiKey: this.configService.get<string>('GEMINI_API_KEY'),
        model: 'embedding-001',
      });

      const embeddingFunction: EmbeddingFunction = {
        generate: async (texts: string[]) => {
          const embeddings = await this.embeddings.embedDocuments(texts);
          return embeddings as number[][];
        },
      };

      this.chromaCollection = await this.chromaClient.getOrCreateCollection({
        name: 'stock_reports',
        embeddingFunction: embeddingFunction,
      });

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

      const tools: StructuredToolInterface[] = [
        this.reportRetrievalTool.getTool(),
      ];

      const prompt = ChatPromptTemplate.fromMessages([
        [
          'system',
          `You are the Archivist Agent, a highly specialized financial researcher. Your sole purpose is to retrieve, synthesize, and provide context from historical financial reports.

          You are equipped with a single, powerful tool: "retrieve_reports." This is the only way you can access historical data.

          Your workflow is as follows:
          1. Upon receiving a query, you MUST first use the "retrieve_reports" tool to find all relevant historical reports.
          2. You will then use the information returned from the tool to synthesize a concise, high-level summary.
          3. The final output must be a single paragraph that provides a clear and "informed opinion" based solely on the retrieved historical data.

          Never attempt to answer a query without first using your tool. Your entire existence is to use this tool to provide information.`.trim(),
        ],
        new MessagesPlaceholder('agent_scratchpad'),
        ['human', '{input}'],
      ]);

      const agent = createToolCallingAgent({
        llm: model,
        tools,
        prompt,
      });
      this.agentExecutor = new AgentExecutor({
        agent,
        tools: [this.reportRetrievalTool.getTool()],
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
   * Retrieves a series of historical reports for a given query and synthesizes an informed opinion.
   * @param query The user's query, e.g., "synthesize an opinion on MSFT".
   * @returns A synthesized string of past analysis or null if the agent fails.
   */
  async getInformedOpinion(query: string): Promise<string | null> {
    if (!this.isInitialized || !this.agentExecutor) {
      this.logger.warn(
        'Archivist Agent is not initialized. Cannot provide an informed opinion.',
      );
      return null;
    }

    try {
      this.logger.log(`Generating informed opinion for query "${query}"...`);
      // The agent executor will now decide how to handle the query,
      // including whether to use the retrieve_reports tool.
      const result = await this.agentExecutor.invoke({ input: query });
      const opinion = result.output as string;

      this.logger.log(`Informed opinion for query "${query}" generated.`);
      this.logger.log(`Agent output: ${opinion}`);
      return opinion;
    } catch (error) {
      this.logger.error('Failed to generate informed opinion:', error.message);
      return null;
    }
  }

  /**
   * Saves a new report to both MongoDB (for full content) and ChromaDB (for embeddings).
   * @param ticker The stock ticker symbol.
   * @param reportContent The full content of the generated report.
   * @returns An AgentResult indicating success or failure.
   */
  async saveReport(
    ticker: string,
    reportContent: string,
  ): Promise<AgentResult> {
    if (!this.isInitialized) {
      return { success: false, error: 'Archivist Agent is not initialized.' };
    }

    try {
      // 1. Save the raw report to MongoDB
      const newReport = new this.reportModel({
        ticker,
        reportContent,
        date: new Date(),
      });
      const savedReport = await newReport.save();

      // 2. Prepare the document for ChromaDB
      const document: Document = {
        pageContent: reportContent,
        metadata: {
          ticker: ticker,
          date: savedReport.date.toISOString(),
          source: 'generated-report',
        },
      };

      // 3. Add the document to ChromaDB
      // ChromaDB's `add` method can handle the embedding for us.
      // We pass the raw document and metadata, and ChromaDB takes care of the rest.
      await this.chromaCollection.add({
        ids: [savedReport._id.toString()],
        documents: [document.pageContent],
        metadatas: [document.metadata],
      });

      this.logger.log(`Report for ticker ${ticker} saved to both databases.`);
      return { success: true, data: 'Report saved successfully.' };
    } catch (error) {
      this.logger.error('Failed to save report:', error.message);
      // Optional: Add a rollback mechanism here if you need to delete the Mongo record on failure
      return { success: false, error: error.message };
    }
  }
}
