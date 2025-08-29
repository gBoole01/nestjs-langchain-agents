import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { ChromaClient, EmbeddingFunction } from 'chromadb';
import { Model } from 'mongoose';
import { ReportDocument } from 'src/agents/stock-analysis-agent/models/reports.model';

@Injectable()
export class ReportRetrievalService {
  private chromaClient: ChromaClient;
  private embeddings: GoogleGenerativeAIEmbeddings;
  private chromaCollection: any;
  private isProduction = false;

  constructor(
    private readonly configService: ConfigService,
    @InjectModel('Report') private readonly reportModel: Model<ReportDocument>,
    private logger: Logger,
  ) {
    this.isProduction = this.configService.get('NODE_ENV') === 'production';
    this.embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: this.configService.get<string>('GEMINI_API_KEY'),
      model: 'embedding-001',
    });

    if (!this.isProduction) {
      this.chromaClient = new ChromaClient({ path: 'http://localhost:8000' });
    }
  }

  async onModuleInit() {
    if (!this.isProduction) {
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
    }
  }

  async retrieveReports(query: string): Promise<string> {
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
