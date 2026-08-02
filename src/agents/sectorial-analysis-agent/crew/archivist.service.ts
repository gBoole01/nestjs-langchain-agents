import { Document } from '@langchain/core/documents';
import { Embeddings } from '@langchain/core/embeddings';
import { VectorStore } from '@langchain/core/vectorstores';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { BroaderReportsService } from 'src/agents/broader-analysis/broader-reports.service';
import { BroaderReportSections } from 'src/agents/broader-analysis/broader-report.types';
import { SECTORIAL_VECTOR_STORE } from 'src/langchain-core.module';

@Injectable()
export class ArchivistService {
  private readonly logger = new Logger(ArchivistService.name);

  constructor(
    @Inject(SECTORIAL_VECTOR_STORE) private readonly vectorStore: VectorStore,
    private readonly embeddings: Embeddings,
    private readonly broaderReportsService: BroaderReportsService,
  ) {}

  async storeRawData(
    sector: string,
    rawData: string,
    period: string,
  ): Promise<void> {
    this.logger.log(`Archiving raw data for sector "${sector}"...`);
    const documents = [
      new Document({ pageContent: rawData, metadata: { sector, period } }),
    ];
    await this.vectorStore.addDocuments(documents);
    this.logger.log('Raw data archiving complete.');
  }

  async storeFinalReport(
    sector: string,
    finalReport: BroaderReportSections,
    period: string,
  ): Promise<void> {
    this.logger.log(`Archiving final report for sector "${sector}"...`);
    const documents = finalReport.sections.map(
      (section) =>
        new Document({
          pageContent: section.content,
          metadata: { sector, period, heading: section.heading },
        }),
    );
    await this.vectorStore.addDocuments(documents);
    await this.broaderReportsService.save(
      'sectorial',
      sector,
      finalReport.sections,
      period,
    );
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
