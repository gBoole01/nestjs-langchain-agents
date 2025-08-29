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
      model: 'embedding-001',
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
    if (!this.isInitialized || !this.agentExecutor) {
      this.logger.warn(
        'Archivist Agent is not initialized. Cannot provide an informed opinion.',
      );
      return null;
    }

    try {
      this.logger.log(`Generating informed opinion for query "${query}"...`);
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
   * Saves a new report to the appropriate database based on the environment.
   * @param ticker The stock ticker symbol.
   * @param reportContent The full content of the generated report.
   * @returns An AgentResult indicating success or failure.
   */
  async saveReport(
    ticker: string,
    reportContent: string,
  ): Promise<AgentResult> {
    if (!this.isInitialized || !this.embeddings) {
      return { success: false, error: 'Archivist Agent is not initialized.' };
    }

    try {
      const newReport = new this.reportModel({
        ticker,
        reportContent,
        date: new Date(),
      });
      const savedReport = await newReport.save();
      const [vector] = await this.embeddings.embedDocuments([reportContent]);

      if (this.isProduction) {
        await this.reportModel.findByIdAndUpdate(savedReport._id, {
          vector: vector as number[],
        });
      } else {
        const document: Document = {
          pageContent: reportContent,
          metadata: {
            ticker: ticker,
            date: savedReport.date.toISOString(),
            source: 'generated-report',
          },
        };
        await this.chromaCollection.add({
          ids: [savedReport._id.toString()],
          documents: [document.pageContent],
          metadatas: [document.metadata],
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
   * Retrieves relevant reports using the appropriate database for the environment.
   * @param query The user's search query.
   * @returns A JSON string of the most relevant reports.
   */
  async retrieveReports(query: string): Promise<string> {
    if (!this.isInitialized || !this.embeddings) {
      throw new Error('Archivist Agent is not initialized.');
    }

    try {
      const [queryVector] = await this.embeddings.embedDocuments([query]);

      if (this.isProduction) {
        const results = await this.reportModel
          .aggregate([
            {
              $vectorSearch: {
                index: 'vector_index',
                path: 'vector',
                queryVector: queryVector,
                numCandidates: 100,
                limit: 5,
              },
            },
            { $project: { reportContent: 1, _id: 0 } },
          ])
          .exec();

        if (!results || results.length === 0) {
          return 'No relevant reports found in the archive.';
        }
        return JSON.stringify(results.map((doc) => doc.reportContent));
      } else {
        const results = await this.chromaCollection.query({
          queryTexts: [query],
          nResults: 5,
        });

        if (!results.documents || results.documents[0].length === 0) {
          return 'No relevant reports found in the archive.';
        }
        return results.documents[0].join('\n\n---\n\n');
      }
    } catch (error) {
      this.logger.error('Failed to retrieve reports:', error.message);
      throw new Error('An error occurred while retrieving historical reports.');
    }
  }
}
