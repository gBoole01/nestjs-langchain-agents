// src/tools/retrieve-reports.tool.ts

import { tool } from '@langchain/core/tools';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { ReportRetrievalService } from './report-retrieval.service';

/**
 * Zod schema for the input of the RetrieveReportsTool.
 */
const reportRetrievalSchema = z.object({
  query: z
    .string()
    .describe('The search query or topic to find relevant historical reports.'),
});

@Injectable()
export class ReportRetrievalTool {
  constructor(
    private readonly reportRetrievalService: ReportRetrievalService,
  ) {}

  getTool() {
    return tool(
      async (input) => {
        try {
          console.log('RetrieveReportsTool called with input:', input);
          const { query } = input;
          const relevantReports =
            await this.reportRetrievalService.retrieveReports(query);
          return JSON.stringify(relevantReports, null, 2);
        } catch (error) {
          return JSON.stringify({
            error: 'Failed to retrieve reports',
            message: error.message,
            query: input.query,
          });
        }
      },
      {
        name: 'retrieve_reports',
        description: `
          A tool to search the database for the most relevant historical reports related to a given query.
          This tool is essential for providing context to the agent about past performance and analysis.
          
          Use this tool when users ask for:
          - A summary of past stock performance
          - A historical overview of a company's analysis
          - Any information that requires looking up historical data.
          
          The tool returns a JSON object containing a list of relevant reports.
        `.trim(),
        schema: reportRetrievalSchema,
      },
    );
  }
}
