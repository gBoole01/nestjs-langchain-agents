import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChromaClient, EmbeddingFunction } from 'chromadb';

@Injectable()
export class ReportRetrievalService {
  private chromaClient: ChromaClient;
  private embeddings: GoogleGenerativeAIEmbeddings;
  private chromaCollection: any;

  constructor(
    private readonly configService: ConfigService,
    private logger: Logger,
  ) {
    this.chromaClient = new ChromaClient({ path: 'http://localhost:8000' });

    this.embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: this.configService.get<string>('GEMINI_API_KEY'),
      model: 'embedding-001',
    });
  }

  async onModuleInit() {
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

  async retrieveReports(query: string): Promise<string> {
    try {
      // The query function will use the pre-configured embedding function
      const results = await this.chromaCollection.query({
        queryTexts: [query],
        nResults: 5, // Retrieve the top 5 most relevant documents
      });

      // If no documents are returned, handle gracefully
      if (!results.documents || results.documents[0].length === 0) {
        return 'No relevant reports found in the archive.';
      }

      // Extract and combine the page content from the query result
      const relevantReports = results.documents[0].join('\n\n---\n\n');

      return relevantReports;
    } catch (error) {
      this.logger.error(
        'Failed to retrieve reports from ChromaDB:',
        error.message,
      );
      throw new Error('An error occurred while retrieving historical reports.');
    }
  }
}
