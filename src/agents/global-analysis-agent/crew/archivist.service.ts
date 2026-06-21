// src/agents/global-analysis-agent/crew/archivist.service.ts
import { Document } from '@langchain/core/documents';
import { Embeddings } from '@langchain/core/embeddings';
import { VectorStore } from '@langchain/core/vectorstores';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ArchivistService {
  private readonly logger = new Logger(ArchivistService.name);

  constructor(
    private readonly vectorStore: VectorStore,
    private readonly embeddings: Embeddings,
  ) {}

  async storeRawData(rawData: string): Promise<void> {
    this.logger.log('Archiving raw data...');
    const documents = [new Document({ pageContent: rawData })];
    await this.vectorStore.addDocuments(documents);
    this.logger.log('Raw data archiving complete.');
  }

  async storeFinalReport(finalReport: string): Promise<void> {
    this.logger.log('Archiving final report to vector store...');
    const documents = [new Document({ pageContent: finalReport })];
    await this.vectorStore.addDocuments(documents);
    this.logger.log('Final report successfully archived.');
  }

  async retrieveData(query: string): Promise<string> {
    this.logger.log(
      `Retrieving relevant historical data for query: "${query}"`,
    );
    const results = await this.vectorStore.similaritySearch(query, 5);

    if (!results || results.length === 0) {
      return 'No relevant reports found in the archive.';
    }

    return results.map((doc) => doc.pageContent).join('\n\n---\n\n');
  }
}
