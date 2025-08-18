import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChromaClient } from 'chromadb';

@Injectable()
export class ReportRetrievalService {
  private chromaClient: ChromaClient;
  private embeddings: GoogleGenerativeAIEmbeddings;

  constructor(private readonly configService: ConfigService) {
    this.chromaClient = new ChromaClient({ path: 'http://localhost:8000' });
    this.embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: this.configService.get<string>('GEMINI_API_KEY'),
      model: 'embedding-001',
    });
  }

  async retrieveReports(query: string) {
    // 1. Generate an embedding for the query
    const queryEmbedding = await this.embeddings.embedQuery(query);

    // 2. Perform a similarity search in ChromaDB
    const collection = await this.chromaClient.getCollection({
      name: 'stock_reports',
    });
    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: 5,
    });

    // 3. Extract the relevant documents and return them
    return results.documents;
  }
}
