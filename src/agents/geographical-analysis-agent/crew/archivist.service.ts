import { Document } from '@langchain/core/documents';
import { Embeddings } from '@langchain/core/embeddings';
import { VectorStore } from '@langchain/core/vectorstores';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { GEOGRAPHICAL_VECTOR_STORE } from 'src/langchain-core.module';

@Injectable()
export class ArchivistService {
  private readonly logger = new Logger(ArchivistService.name);

  constructor(
    @Inject(GEOGRAPHICAL_VECTOR_STORE)
    private readonly vectorStore: VectorStore,
    private readonly embeddings: Embeddings,
  ) {}

  async storeRawData(region: string, rawData: string): Promise<void> {
    this.logger.log(`Archiving raw data for region "${region}"...`);
    const documents = [
      new Document({ pageContent: rawData, metadata: { region } }),
    ];
    await this.vectorStore.addDocuments(documents);
    this.logger.log('Raw data archiving complete.');
  }

  async storeFinalReport(region: string, finalReport: string): Promise<void> {
    this.logger.log(`Archiving final report for region "${region}"...`);
    const documents = [
      new Document({ pageContent: finalReport, metadata: { region } }),
    ];
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
